/**
 * Turning a repair log into a finished letter.
 *
 * A letter file (letters/*.yaml) holds the wording. This module supplies the values: dates
 * and day counts from the timeline, missed promises, and the paragraphs for every state or
 * federal rule that applies, each citing the law. The wording uses the Tenantkit template
 * language, so a letter file can never do anything except produce text.
 */
import { addDays, formatDate, type ISODate } from './civil-date.ts';
import { daysWithout, dayNumber, missedPromises } from './clock.ts';
import {
	KIND_INFO,
	MEDICAID_PAYERS,
	MEDICARE_PAYERS,
	PAYER_LABELS,
	PROBLEM_PHRASES,
	chairDescription,
	firstEntry,
	sortedEntries,
	type Profile,
	type Repair
} from './model.ts';
import { deadlinesForLetter, type DeadlineCheck, type RulesForRepair } from './rules.ts';
import type { LetterDef, Recipient } from './schema.ts';
import {
	normalizeSegments,
	parseTemplate,
	renderNodes,
	segmentsToText,
	type RenderScope,
	type Segment,
	type TemplateNode
} from './template.ts';
import { buildTimeline, describeItem, describeMissedPromise, sentence } from './timeline.ts';

/** Names every letter template may use, with the placeholder shown when a value is missing. */
export const LETTER_VARIABLES = {
	my_name: 'Your name',
	my_address: 'Your address',
	my_phone: 'Your phone',
	my_email: 'Your email',
	letter_date: 'Date',
	recipient_name: 'Recipient',
	supplier_name: 'Supplier name',
	account_number: 'Account number',
	payer_name: 'Insurance name',
	payer_kind: 'Insurance type',
	member_id: 'Member ID',
	claim_number: 'Claim or authorization number',
	chair: 'Make and model of your chair',
	chair_serial: 'Serial number',
	problem: 'What is wrong',
	problem_details: 'Details of the problem',
	broke_date: 'Date the chair stopped working',
	day_number: 'Day number',
	days_without: 'Days without the chair',
	reported_date: 'Date you reported the problem',
	fixed_date: 'Date the chair was fixed',
	contact_count: 'Number of contacts',
	missed_promise_count: 'Number of missed promises',
	missed_promises: 'Missed promises',
	impact: 'How this has affected you',
	impact_list: 'Effects you logged',
	auth_requested_date: 'Date sent to insurance',
	parts_ordered_date: 'Date parts were ordered',
	state_name: 'Your state',
	state_rules: 'State and federal rules',
	response_date: 'Date you want an answer by',
	response_days: 'Days to respond',
	timeline_count: 'Number of timeline entries'
} as const;

/** Yes/no names for {{#if}} blocks. */
export const LETTER_FLAGS = [
	'is_stranded',
	'is_unsafe',
	'is_limited',
	'is_fixed',
	'is_medicare',
	'is_medicaid',
	'has_reported',
	'has_missed_promises',
	'has_state_rules',
	'has_impact',
	'has_loaner',
	'auth_pending',
	'auth_denied',
	'parts_pending',
	'has_phone',
	'has_email'
] as const;

/** Extra names a rule's letter paragraph may use. */
export const RULE_VARIABLES = {
	law_title: 'Name of the law',
	law_citation: 'Citation',
	deadline_title: 'Deadline',
	start_label: 'What started the clock',
	start_date: 'Start date',
	due_date: 'Due date',
	period_text: 'Time allowed',
	met_label: 'What stops the clock',
	met_date: 'Date it was met',
	days_late: 'Days late',
	days_left: 'Days left',
	days_used: 'Days used so far',
	paused_since: 'Date the clock paused',
	paused_for: 'Why the clock is paused',
	status: 'Status'
} as const;

export type LetterVariable = keyof typeof LETTER_VARIABLES;

export interface Addressee {
	name: string;
	address: string;
}

export interface LetterInput {
	letter: LetterDef;
	repair: Repair;
	profile: Profile;
	rules: RulesForRepair;
	stateName: string;
	today: ISODate;
	/** The letter's yes/no options, by id. Missing options use their defaults. */
	options?: Record<string, boolean>;
	/** Free text: how the delay has affected the person. */
	impact?: string;
	/** Days the recipient has to respond. Defaults to the letter's response_days. */
	responseDays?: number;
	/** For letters to a state office: who it goes to. */
	addressee?: Addressee;
	locale?: string;
}

export interface EnclosureLine {
	heading: string;
	text: string;
}

export interface RenderedLetter {
	sender: Segment[][];
	date: string;
	recipient: Segment[][];
	references: string[];
	subject: Segment[];
	body: Segment[];
	closing: string;
	signature: Segment[];
	enclosure: EnclosureLine[];
	/** Short label for the enclosure, e.g. "Repair timeline (12 entries)". */
	enclosureLabel: string;
}

const templateCache = new Map<string, TemplateNode[]>();

function parsed(source: string): TemplateNode[] {
	let nodes = templateCache.get(source);
	if (!nodes) {
		nodes = parseTemplate(source);
		templateCache.set(source, nodes);
	}
	return nodes;
}

function render(source: string, scope: RenderScope): Segment[] {
	return normalizeSegments(renderNodes(parsed(source), scope));
}

function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** Who the letter is addressed to. */
export function addresseeFor(
	input: Pick<LetterInput, 'letter' | 'repair' | 'addressee'>
): Addressee {
	const { letter, repair } = input;
	switch (letter.recipient) {
		case 'supplier':
			return { name: repair.supplier.name, address: repair.supplier.address };
		case 'insurer':
			return {
				name: repair.payer.name || PAYER_LABELS[repair.payer.kind],
				address: repair.payer.address
			};
		case 'agency':
			return input.addressee ?? { name: '', address: '' };
	}
}

function ruleParagraph(
	source: string,
	check: DeadlineCheck | undefined,
	law: { title: string; citation: string },
	parent: RenderScope,
	locale: string
): Segment[] {
	const long = (date: ISODate | undefined) => (date ? formatDate(date, locale, 'long') : undefined);
	const values: Record<string, string | undefined> = {
		law_title: law.title,
		law_citation: law.citation
	};
	if (check) {
		const period = check.deadline.period;
		Object.assign(values, {
			deadline_title: check.deadline.title,
			start_label: check.deadline.starts.label,
			start_date: long(check.start),
			due_date: long(check.due),
			period_text: plural(period.days, period.count === 'business' ? 'business day' : 'day'),
			met_label: check.deadline.met_label,
			met_date: long(check.metOn),
			days_late: check.daysLate !== undefined ? plural(check.daysLate, 'day') : undefined,
			days_left: check.daysLeft !== undefined ? plural(check.daysLeft, 'day') : undefined,
			days_used: check.daysUsed !== undefined ? String(check.daysUsed) : undefined,
			paused_since: long(check.pausedSince),
			paused_for: check.pausedFor,
			status: check.status
		});
	}
	const scope: RenderScope = {
		text: (name) => (name in values ? values[name] : parent.text(name)),
		raw: (name) => (name in values ? values[name] : parent.raw(name)),
		placeholder: (name) => parent.placeholder(name)
	};
	return render(source, scope);
}

/** The paragraphs for every rule that matters to this recipient, separated by blank lines. */
export function ruleParagraphs(input: LetterInput, scope: RenderScope, locale: string): Segment[] {
	const recipient: Recipient = input.letter.recipient;
	const paragraphs: Segment[][] = [];
	for (const check of deadlinesForLetter(input.rules.deadlines, recipient)) {
		paragraphs.push(ruleParagraph(check.deadline.letter, check, check.law, scope, locale));
	}
	for (const { protection, law } of input.rules.protections) {
		if (!protection.letter || !protection.recipients.includes(recipient)) continue;
		paragraphs.push(ruleParagraph(protection.letter, undefined, law, scope, locale));
	}
	const out: Segment[] = [];
	paragraphs.forEach((paragraph, index) => {
		if (index > 0) out.push({ type: 'text', text: '\n\n' });
		out.push(...paragraph);
	});
	return out;
}

export function createLetterScope(input: LetterInput): RenderScope {
	const { repair, profile, letter, today } = input;
	const locale = input.locale ?? 'en-US';
	const long = (date: ISODate | undefined) => (date ? formatDate(date, locale, 'long') : undefined);
	const entries = sortedEntries(repair.entries);
	const has = (kind: string) => entries.some((entry) => entry.kind === kind);
	const missed = missedPromises(repair, today);
	const impacts = entries.filter((entry) => entry.kind === 'impact');
	const responseDays = input.responseDays ?? letter.response_days;
	const options = Object.fromEntries(
		letter.options.map((option) => [option.id, input.options?.[option.id] ?? option.default])
	);
	const addressee = addresseeFor(input);
	const reported = firstEntry(repair, ['reported']);
	const contacts = entries.filter((entry) =>
		['reported', 'call', 'message', 'visit', 'letter'].includes(entry.kind)
	).length;
	const authRequested = firstEntry(repair, ['auth_requested']);
	const partsOrdered = firstEntry(repair, ['parts_ordered']);
	const authDecided = entries.some(
		(entry) =>
			(entry.kind === 'auth_approved' || entry.kind === 'auth_denied') &&
			authRequested !== undefined &&
			entry.date >= authRequested.date
	);
	const impactText = input.impact?.trim() ?? '';
	const timelineCount = buildTimeline(repair, today).length;

	const textValues: Record<string, string | undefined> = {
		my_name: profile.name,
		my_address: profile.address,
		my_phone: profile.phone,
		my_email: profile.email,
		letter_date: long(today),
		recipient_name: addressee.name,
		supplier_name: repair.supplier.name ? repair.supplier.name : undefined,
		account_number: repair.supplier.account,
		payer_name: repair.payer.name || PAYER_LABELS[repair.payer.kind],
		payer_kind: PAYER_LABELS[repair.payer.kind],
		member_id: repair.payer.memberId,
		claim_number: repair.payer.claim,
		chair: chairDescription(repair) || 'power wheelchair',
		chair_serial: repair.chair.serial,
		problem: PROBLEM_PHRASES[repair.problem],
		problem_details: repair.details.trim() ? sentence(repair.details) : undefined,
		broke_date: long(repair.brokeOn),
		day_number: String(dayNumber(repair, repair.fixedOn ?? today)),
		days_without: plural(daysWithout(repair, today), 'day'),
		reported_date: long(reported?.date),
		fixed_date: long(repair.fixedOn),
		contact_count: plural(contacts, 'time'),
		missed_promise_count: plural(missed.length, 'promise'),
		missed_promises: missed
			.map((entry) => `- ${describeMissedPromise(entry, repair, locale)}`)
			.join('\n'),
		impact: impactText ? sentence(impactText) : undefined,
		impact_list: impacts
			.map((entry) => `- ${long(entry.date)}: ${sentence(entry.note || KIND_INFO.impact.label)}`)
			.join('\n'),
		auth_requested_date: long(authRequested?.date),
		parts_ordered_date: long(partsOrdered?.date),
		state_name: input.stateName,
		response_date: long(addDays(today, responseDays)),
		response_days: plural(responseDays, 'day'),
		timeline_count: plural(timelineCount, 'entry', 'entries')
	};
	const flags: Record<string, boolean> = {
		is_stranded: repair.severity === 'stranded',
		is_unsafe: repair.severity === 'unsafe',
		is_limited: repair.severity === 'limited',
		is_fixed: !!repair.fixedOn,
		is_medicare: MEDICARE_PAYERS.includes(repair.payer.kind),
		is_medicaid: MEDICAID_PAYERS.includes(repair.payer.kind),
		has_reported: !!reported,
		has_missed_promises: missed.length > 0,
		has_impact: impactText !== '' || impacts.length > 0,
		has_loaner: has('loaner'),
		auth_pending: !!authRequested && !authDecided,
		auth_denied: has('auth_denied'),
		parts_pending: !!partsOrdered && !has('parts_arrived'),
		has_phone: profile.phone.trim() !== '',
		has_email: profile.email.trim() !== '',
		...options
	};

	let stateRules: Segment[] | undefined;
	const scope: RenderScope = {
		text(name) {
			if (name === 'state_rules') {
				stateRules ??= ruleParagraphs(input, scope, locale);
				return stateRules.length > 0 ? stateRules : undefined;
			}
			const value = textValues[name];
			return value === undefined || value.trim() === '' ? undefined : value;
		},
		raw(name) {
			if (name === 'has_state_rules') {
				stateRules ??= ruleParagraphs(input, scope, locale);
				return stateRules.length > 0;
			}
			if (name in flags) return flags[name];
			const value = textValues[name];
			return value === undefined || value.trim() === '' ? undefined : value;
		},
		placeholder(name) {
			const label =
				(LETTER_VARIABLES as Record<string, string>)[name] ??
				(RULE_VARIABLES as Record<string, string>)[name] ??
				name;
			return `[${label}]`;
		}
	};
	return scope;
}

function lines(scope: RenderScope, name: string): Segment[][] {
	const segments = render(`{{${name}}}`, scope);
	return splitLines(segments).filter((line) => line.length > 0);
}

/** Split segments into lines, keeping value highlights. */
export function splitLines(segments: readonly Segment[]): Segment[][] {
	const out: Segment[][] = [[]];
	for (const segment of segments) {
		segment.text.split('\n').forEach((part, index) => {
			if (index > 0) out.push([]);
			if (part.trim() !== '') out.at(-1)?.push({ ...segment, text: part.trim() });
		});
	}
	return out;
}

export function renderLetter(input: LetterInput): RenderedLetter {
	const { repair, today } = input;
	const locale = input.locale ?? 'en-US';
	const scope = createLetterScope(input);
	const filled = (name: string) => scope.raw(name) !== undefined;
	const addressee = addresseeFor(input);

	const sender = [
		...lines(scope, 'my_name'),
		...lines(scope, 'my_address'),
		...(filled('my_phone') ? lines(scope, 'my_phone') : []),
		...(filled('my_email') ? lines(scope, 'my_email') : [])
	];
	const recipient: Segment[][] = [
		...(addressee.name.trim()
			? lines(scope, 'recipient_name')
			: [
					[{ type: 'value', name: 'recipient_name', text: '[Recipient]', missing: true } as Segment]
				]),
		...(addressee.address.trim()
			? splitLines([
					{ type: 'value', name: 'recipient_address', text: addressee.address, missing: false }
				]).filter((line) => line.length > 0)
			: [
					[
						{
							type: 'value',
							name: 'recipient_address',
							text: '[Mailing address]',
							missing: true
						} as Segment
					]
				])
	];

	const references: string[] = [];
	const { supplier, payer, chair } = repair;
	if (input.letter.recipient !== 'insurer' && supplier.account.trim())
		references.push(`Account number: ${supplier.account.trim()}`);
	if (input.letter.recipient !== 'supplier' && payer.memberId.trim())
		references.push(`Member ID: ${payer.memberId.trim()}`);
	if (payer.claim.trim()) references.push(`Claim or authorization number: ${payer.claim.trim()}`);
	if (chair.serial.trim()) references.push(`Wheelchair serial number: ${chair.serial.trim()}`);

	const enclosure = buildTimeline(repair, today).map((item) => describeItem(item, locale));

	return {
		sender,
		date: formatDate(today, locale, 'long'),
		recipient,
		references,
		subject: render(input.letter.subject, scope),
		body: render(input.letter.body, scope),
		closing: input.letter.closing,
		signature: lines(scope, 'my_name')[0] ?? [
			{ type: 'value', name: 'my_name', text: '[Your name]', missing: true }
		],
		enclosure,
		enclosureLabel: `Repair timeline (${plural(enclosure.length, 'entry', 'entries')})`
	};
}

const joinLines = (block: readonly Segment[][]) =>
	block.map((segments) => segmentsToText(segments)).join('\n');

/** The finished letter as plain text, for copying or saving. */
export function letterToText(letter: RenderedLetter): string {
	const parts = [
		joinLines(letter.sender),
		letter.date,
		joinLines(letter.recipient),
		[`Re: ${segmentsToText(letter.subject)}`, ...letter.references].join('\n'),
		segmentsToText(letter.body),
		`${letter.closing}\n\n\n${segmentsToText(letter.signature)}`,
		`Enclosure: ${letter.enclosureLabel}`,
		[
			letter.enclosureLabel.toUpperCase(),
			'',
			...letter.enclosure.map((line) => `${line.heading}\n${line.text}`)
		].join('\n')
	];
	return parts.join('\n\n') + '\n';
}

/** True when any part of the letter still shows a placeholder. */
export function missingValues(letter: RenderedLetter): string[] {
	const all = [
		...letter.sender.flat(),
		...letter.recipient.flat(),
		...letter.subject,
		...letter.body,
		...letter.signature
	];
	const names = all.flatMap((segment) =>
		segment.type === 'value' && segment.missing ? [segment.text] : []
	);
	return [...new Set(names)];
}
