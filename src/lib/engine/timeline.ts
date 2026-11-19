/**
 * The timeline: the day the chair broke followed by every entry, in date order, plus the
 * plain-language sentences letters and the PDF use to describe each one.
 */
import { formatDate, type ISODate } from './civil-date.ts';
import { dayNumber, promiseState, type PromiseState } from './clock.ts';
import {
	KIND_INFO,
	PARTY_LABELS,
	PROBLEM_LABELS,
	SEVERITY_LABELS,
	sortedEntries,
	supplierName,
	type Entry,
	type Repair,
	type TimelineKind
} from './model.ts';

export interface TimelineItem {
	/** Entry id, or "broke" for the first item. */
	id: string;
	kind: TimelineKind;
	date: ISODate;
	time?: string;
	day: number;
	title: string;
	/** Who was involved, e.g. "Maria at Numotion". */
	who?: string;
	note: string;
	reference?: string;
	promise?: { text: string; due: ISODate; state: PromiseState };
	entry?: Entry;
}

/** Who an entry involved, in words: "Maria at Numotion", "Numotion", "Medicaid". */
export function describeWho(entry: Entry, repair: Repair): string | undefined {
	const org =
		entry.party === 'supplier'
			? repair.supplier.name.trim()
			: entry.party === 'insurer'
				? repair.payer.name.trim()
				: '';
	const person = entry.person?.trim();
	if (person && org) return `${person} at ${org}`;
	if (person) return person;
	if (org) return org;
	if (entry.party === 'me' || entry.party === 'other') return undefined;
	return PARTY_LABELS[entry.party];
}

/** Trim text and end it with a full stop if it doesn't end with punctuation. */
export function sentence(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	return /[.!?…)"”]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function buildTimeline(repair: Repair, today: ISODate): TimelineItem[] {
	const broke: TimelineItem = {
		id: 'broke',
		kind: 'broke',
		date: repair.brokeOn,
		day: 1,
		title: KIND_INFO.broke.label,
		note: [PROBLEM_LABELS[repair.problem], repair.details, SEVERITY_LABELS[repair.severity]]
			.map(sentence)
			.filter(Boolean)
			.join(' ')
	};
	const items = sortedEntries(repair.entries).map((entry): TimelineItem => ({
		id: entry.id,
		kind: entry.kind,
		date: entry.date,
		time: entry.time,
		day: dayNumber(repair, entry.date),
		title: KIND_INFO[entry.kind].label,
		who: describeWho(entry, repair),
		note: entry.note.trim(),
		reference: entry.reference?.trim() || undefined,
		promise: entry.promise
			? {
					text: entry.promise.text.trim(),
					due: entry.promise.due,
					state: promiseState(entry.promise, today)
				}
			: undefined,
		entry
	}));
	return [broke, ...items];
}

export const PROMISE_LABELS: Record<PromiseState, string> = {
	kept: 'Kept',
	broken: 'Broken',
	overdue: 'Past due',
	due_today: 'Due today',
	pending: 'Not due yet'
};

function formatTime(time: string, locale: string): string {
	const [hours, minutes] = time.split(':').map(Number);
	const date = new Date(Date.UTC(2000, 0, 1, hours ?? 0, minutes ?? 0));
	return new Intl.DateTimeFormat(locale, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC'
	}).format(date);
}

/** One timeline item as a heading line and a description, for letters and the PDF. */
export function describeItem(
	item: TimelineItem,
	locale = 'en-US'
): { heading: string; text: string } {
	const when = formatDate(item.date, locale, 'medium');
	const heading = `${when}${item.time ? `, ${formatTime(item.time, locale)}` : ''} (Day ${item.day})`;
	const parts = [item.who ? `${item.title}: ${item.who}.` : `${item.title}.`];
	if (item.note) parts.push(sentence(item.note));
	if (item.promise) {
		const due = formatDate(item.promise.due, locale, 'medium');
		parts.push(
			`Promised: ${item.promise.text || 'to follow up'}, by ${due} (${PROMISE_LABELS[item.promise.state].toLowerCase()}).`
		);
	}
	if (item.reference) parts.push(`Reference: ${item.reference}.`);
	return { heading, text: parts.join(' ') };
}

/** A sentence about a promise that wasn't kept, for the "promises" part of a letter. */
export function describeMissedPromise(entry: Entry, repair: Repair, locale = 'en-US'): string {
	const promise = entry.promise;
	if (!promise) return '';
	const who = describeWho(entry, repair) ?? supplierName(repair);
	const said = formatDate(entry.date, locale, 'long');
	const due = formatDate(promise.due, locale, 'long');
	const ending =
		promise.outcome === 'broken' ? 'That did not happen.' : 'I have no record that it happened.';
	return `On ${said}, ${who} told me: ${promise.text || 'they would follow up'}, by ${due}. ${ending}`;
}
