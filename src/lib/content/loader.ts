/**
 * Loads the YAML files in rules/ and letters/, checks them, and turns them into the plain
 * JSON the app uses. Problems are reported with file names and line numbers so volunteers
 * can fix a rule without reading code. Runs at build time only (see vite.config.ts).
 */
import { LineCounter, parseDocument, type Document } from 'yaml';
import type { z } from 'zod';
import { mergeHolidayRules, type HolidayDef } from '../engine/holidays.ts';
import { LETTER_FLAGS, LETTER_VARIABLES, RULE_VARIABLES } from '../engine/letters.ts';
import type { Jurisdiction } from '../engine/rules.ts';
import {
	HolidayCalendarFile,
	JurisdictionFile,
	LetterFile,
	RECIPIENTS,
	type HolidayCalendarDef,
	type LetterDef,
	type Recipient
} from '../engine/schema.ts';
import { parseTemplate, templateNames, TemplateError } from '../engine/template.ts';
import { US_STATES } from '../engine/states.ts';

/** File path (relative to the repository root, with "/") → file text. */
export type ContentFiles = Record<string, string>;

export interface ContentIssue {
	level: 'error' | 'warning';
	file: string;
	line?: number;
	path?: string;
	message: string;
}

export interface Content {
	/** State profiles, keyed by USPS code. */
	states: Record<string, Jurisdiction>;
	/** Federal (Medicare) rules. */
	federal: Jurisdiction;
	letters: Record<Recipient, LetterDef>;
}

interface ParsedFile<T> {
	file: string;
	data: T;
	doc: Document;
	lines: LineCounter;
}

type Path = readonly (string | number | symbol)[];

function formatPath(path: Path): string {
	return path
		.map((part, index) =>
			typeof part === 'number' ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`
		)
		.join('');
}

function lineOf(source: ParsedFile<unknown>, path: Path): number | undefined {
	const keys = path.filter((part): part is string | number => typeof part !== 'symbol');
	for (let length = keys.length; length >= 0; length--) {
		const node = source.doc.getIn(keys.slice(0, length), true) as
			{ range?: [number, number, number] } | undefined;
		const offset = node?.range?.[0];
		if (offset !== undefined) return source.lines.linePos(offset).line;
	}
	return undefined;
}

class Reporter {
	readonly issues: ContentIssue[] = [];

	add(
		level: ContentIssue['level'],
		file: string,
		message: string,
		path?: Path,
		source?: ParsedFile<unknown>
	) {
		const issue: ContentIssue = { level, file, message };
		if (path && path.length > 0) issue.path = formatPath(path);
		const line = source ? lineOf(source, path ?? []) : undefined;
		if (line !== undefined) issue.line = line;
		this.issues.push(issue);
	}

	error(file: string, message: string, path?: Path, source?: ParsedFile<unknown>) {
		this.add('error', file, message, path, source);
	}

	warn(file: string, message: string, path?: Path, source?: ParsedFile<unknown>) {
		this.add('warning', file, message, path, source);
	}
}

function parseFile<S extends z.ZodType>(
	file: string,
	text: string,
	schema: S,
	report: Reporter
): ParsedFile<z.output<S>> | null {
	const lines = new LineCounter();
	const doc = parseDocument(text, { lineCounter: lines, prettyErrors: true, uniqueKeys: true });
	if (doc.errors.length > 0) {
		for (const error of doc.errors) {
			const issue: ContentIssue = {
				level: 'error',
				file,
				message: error.message.split('\n')[0] ?? error.message
			};
			const line = error.linePos?.[0]?.line;
			if (line !== undefined) issue.line = line;
			report.issues.push(issue);
		}
		return null;
	}
	const raw: unknown = doc.toJS();
	const parsedFile = { file, doc, lines, data: raw };
	const result = schema.safeParse(raw);
	if (!result.success) {
		for (const issue of result.error.issues) {
			report.error(file, friendlyMessage(issue.message), issue.path, parsedFile);
		}
		return null;
	}
	return { ...parsedFile, data: result.data };
}

function friendlyMessage(message: string): string {
	if (/expected string, received (number|boolean)/.test(message)) {
		return `${message}. Put the value in "quotes" so YAML reads it as text`;
	}
	return message;
}

function basename(file: string): string {
	return (
		file
			.split('/')
			.at(-1)
			?.replace(/\.ya?ml$/, '') ?? file
	);
}

/** Check a template parses and only uses names it is allowed to. */
function checkTemplate(
	source: ParsedFile<unknown>,
	path: Path,
	template: string,
	allowed: ReadonlySet<string>,
	report: Reporter
) {
	try {
		const names = templateNames(parseTemplate(template));
		for (const { name } of names) {
			if (!allowed.has(name)) {
				report.error(
					source.file,
					`Unknown name "{{${name}}}". Allowed: ${[...allowed].sort().join(', ')}`,
					path,
					source
				);
			}
		}
	} catch (error) {
		if (error instanceof TemplateError) report.error(source.file, error.message, path, source);
		else throw error;
	}
}

const LETTER_NAMES = new Set<string>([
	...Object.keys(LETTER_VARIABLES),
	...LETTER_FLAGS,
	'has_state_rules'
]);
const RULE_NAMES = new Set<string>([...LETTER_NAMES, ...Object.keys(RULE_VARIABLES)]);

export function loadContent(files: ContentFiles): { content: Content; issues: ContentIssue[] } {
	const report = new Reporter();
	const sorted = Object.keys(files).sort();

	const calendars = new Map<string, HolidayCalendarDef>();
	for (const file of sorted.filter((name) => name.startsWith('rules/holidays/'))) {
		const parsed = parseFile(file, files[file] ?? '', HolidayCalendarFile, report);
		if (!parsed) continue;
		if (parsed.data.id !== basename(file)) {
			report.error(file, `id "${parsed.data.id}" must match the file name`, ['id'], parsed);
		}
		calendars.set(parsed.data.id, parsed.data);
	}

	const jurisdictionFiles = sorted.filter(
		(name) => name.startsWith('rules/states/') || name === 'rules/federal.yaml'
	);
	const states: Record<string, Jurisdiction> = {};
	let federal: Jurisdiction | undefined;

	for (const file of jurisdictionFiles) {
		const parsed = parseFile(file, files[file] ?? '', JurisdictionFile, report);
		if (!parsed) continue;
		const data = parsed.data;
		const isFederal = file === 'rules/federal.yaml';

		if (isFederal ? data.id !== 'US' : data.id !== basename(file).toUpperCase()) {
			report.error(
				file,
				isFederal
					? 'The federal file must have id "US"'
					: `id "${data.id}" must match the file name`,
				['id'],
				parsed
			);
		}
		if (!isFederal && !US_STATES.some((state) => state.code === data.id)) {
			report.error(file, `"${data.id}" is not a U.S. state or D.C.`, ['id'], parsed);
		}
		if (!isFederal) {
			const expected = US_STATES.find((state) => state.code === data.id)?.name;
			if (expected && expected !== data.name) {
				report.error(file, `name should be "${expected}"`, ['name'], parsed);
			}
		}

		const lawIds = new Set<string>();
		data.laws.forEach((law, index) => {
			if (lawIds.has(law.id))
				report.error(file, `Duplicate law id "${law.id}"`, ['laws', index, 'id'], parsed);
			lawIds.add(law.id);
			if (law.status === 'enacted' && !law.effective) {
				report.error(file, 'An enacted law needs its effective date', ['laws', index], parsed);
			}
		});

		const ids = new Set<string>();
		const checkId = (kind: string, value: string, path: Path) => {
			if (ids.has(value)) report.error(file, `Duplicate ${kind} id "${value}"`, path, parsed);
			ids.add(value);
		};
		data.deadlines.forEach((deadline, index) => {
			const path = ['deadlines', index] as const;
			checkId('deadline', deadline.id, [...path, 'id']);
			if (!lawIds.has(deadline.law)) {
				report.error(file, `Unknown law "${deadline.law}"`, [...path, 'law'], parsed);
			}
			checkTemplate(parsed, [...path, 'letter'], deadline.letter, RULE_NAMES, report);
		});
		data.protections.forEach((protection, index) => {
			const path = ['protections', index] as const;
			checkId('protection', protection.id, [...path, 'id']);
			if (!lawIds.has(protection.law)) {
				report.error(file, `Unknown law "${protection.law}"`, [...path, 'law'], parsed);
			}
			if (protection.letter) {
				checkTemplate(parsed, [...path, 'letter'], protection.letter, RULE_NAMES, report);
			}
		});
		data.agencies.forEach((agency, index) =>
			checkId('agency', agency.id, ['agencies', index, 'id'])
		);
		if (!isFederal && data.agencies.length === 0) {
			report.error(file, 'List at least one office people can complain to', ['agencies'], parsed);
		}
		if (data.laws.length > 0 && data.sources.length === 0) {
			report.warn(file, 'Add the sources you checked the rules against', ['sources'], parsed);
		}

		let holidayRules: HolidayDef[] = [];
		for (const [index, calendarId] of data.holidays.extends.entries()) {
			const calendar = calendars.get(calendarId);
			if (!calendar) {
				report.error(
					file,
					`Unknown holiday calendar "${calendarId}"`,
					['holidays', 'extends', index],
					parsed
				);
				continue;
			}
			holidayRules = [...holidayRules, ...calendar.holidays];
		}
		holidayRules = mergeHolidayRules(holidayRules, data.holidays.remove, data.holidays.add);

		const jurisdiction: Jurisdiction = { ...data, holidayRules };
		if (isFederal) federal = jurisdiction;
		else states[data.id] = jurisdiction;
	}
	if (!federal) report.error('rules/federal.yaml', 'The federal rules file is missing');

	const letters: Partial<Record<Recipient, LetterDef>> = {};
	for (const file of sorted.filter((name) => name.startsWith('letters/'))) {
		const parsed = parseFile(file, files[file] ?? '', LetterFile, report);
		if (!parsed) continue;
		const letter = parsed.data;
		if (letter.id !== basename(file)) {
			report.error(file, `id "${letter.id}" must match the file name`, ['id'], parsed);
		}
		if (letters[letter.recipient]) {
			report.error(
				file,
				`There is already a letter for "${letter.recipient}"`,
				['recipient'],
				parsed
			);
		}
		const allowed = new Set([...LETTER_NAMES, ...letter.options.map((option) => option.id)]);
		for (const option of letter.options) {
			if (LETTER_NAMES.has(option.id)) {
				report.error(file, `Option id "${option.id}" is a reserved name`, ['options'], parsed);
			}
		}
		checkTemplate(parsed, ['subject'], letter.subject, allowed, report);
		checkTemplate(parsed, ['body'], letter.body, allowed, report);
		letters[letter.recipient] = letter;
	}
	for (const recipient of RECIPIENTS) {
		if (!letters[recipient]) report.error('letters/', `No letter for "${recipient}"`);
	}

	const empty: Jurisdiction = {
		schema_version: 1,
		id: 'US',
		name: 'Federal',
		last_checked: '1970-01-01',
		summary: '',
		laws: [],
		deadlines: [],
		protections: [],
		agencies: [],
		holidays: { extends: [], add: [], remove: [] },
		sources: [],
		holidayRules: []
	};
	return {
		content: {
			states,
			federal: federal ?? empty,
			letters: letters as Record<Recipient, LetterDef>
		},
		issues: report.issues
	};
}

export function formatIssue(issue: ContentIssue): string {
	const where = `${issue.file}${issue.line !== undefined ? `:${issue.line}` : ''}`;
	const path = issue.path ? ` (${issue.path})` : '';
	return `${issue.level}  ${where}${path}  ${issue.message}`;
}
