/**
 * The format of the rules and letter files (rules/ and letters/).
 *
 * These schemas run at build time only: the content loader validates every YAML file, then
 * the app receives plain JSON. The JSON Schemas in schema/ are generated from these, so
 * editors can check files as people type (`npm run rules:schema`).
 */
import { z } from 'zod';
import { isISODate } from './civil-date.ts';
import { ENTRY_KINDS, PAYER_KINDS, SEVERITIES } from './model.ts';

export const SCHEMA_VERSION = 1;

const id = z
	.string()
	.regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, 'Use lowercase letters, numbers, - and _ only');

const isoDate = z
	.string()
	.refine((value) => isISODate(value), 'Use a real date written as YYYY-MM-DD');

const text = z.string().trim().min(1);

export const Source = z
	.object({
		label: text,
		url: z.url({ protocol: /^https$/ })
	})
	.strict();

export const Weekday = z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

export const HolidayDate = z.union([
	z
		.object({
			month: z.number().int().min(1).max(12),
			day: z.number().int().min(1).max(31),
			observed: z.enum(['none', 'nearest_weekday', 'sunday_to_monday']).optional()
		})
		.strict(),
	z
		.object({
			month: z.number().int().min(1).max(12),
			weekday: Weekday,
			nth: z
				.number()
				.int()
				.min(-1)
				.max(5)
				.refine((n) => n !== 0, 'Use 1-5, or -1 for the last one in the month'),
			offset_days: z.number().int().optional()
		})
		.strict()
]);

export const Holiday = z
	.object({
		id,
		name: text,
		date: HolidayDate,
		since: z.number().int().min(1900).optional(),
		until: z.number().int().min(1900).optional()
	})
	.strict();

export const HolidayCalendarFile = z
	.object({
		schema_version: z.literal(SCHEMA_VERSION),
		id,
		name: text,
		holidays: z.array(Holiday).min(1),
		sources: z.array(Source).min(1)
	})
	.strict();

export const HolidayConfig = z
	.object({
		extends: z.array(id).default(['us-federal']),
		add: z.array(Holiday).default([]),
		remove: z.array(id).default([])
	})
	.strict();

export const LAW_STATUSES = ['in_force', 'enacted', 'pending', 'failed'] as const;
export const ROLES = ['supplier', 'manufacturer', 'insurer', 'medicaid', 'medicare'] as const;
export const RECIPIENTS = ['supplier', 'insurer', 'agency'] as const;
export type Recipient = (typeof RECIPIENTS)[number];

export const Law = z
	.object({
		id,
		title: text.describe('Official or common name of the law'),
		bill: text.describe('Bill and session law number, e.g. "HB22-1031 (2022)"'),
		citation: text.describe('Where it is codified, e.g. "C.R.S. § 6-1-1503"'),
		status: z.enum(LAW_STATUSES),
		effective: isoDate.optional().describe('When it took (or takes) effect'),
		url: z.url({ protocol: /^https$/ }).describe('Primary source: the statute or enrolled bill'),
		summary: text,
		applies_to: z.array(z.enum(ROLES)).min(1)
	})
	.strict();

export const Conditions = z
	.object({
		payers: z.array(z.enum(PAYER_KINDS)).min(1).optional(),
		severities: z.array(z.enum(SEVERITIES)).min(1).optional()
	})
	.strict();

export const TIMELINE_EVENTS = ['broke', ...ENTRY_KINDS] as const;

export const Deadline = z
	.object({
		id,
		law: id.describe('The id of the law in this file that sets the deadline'),
		title: text,
		who: z.enum(ROLES),
		description: text.describe('Plain-language explanation shown in the app'),
		quote: text.optional().describe('The exact words of the law'),
		starts: z
			.object({
				events: z.array(z.enum(TIMELINE_EVENTS)).min(1),
				when: z
					.enum(['first', 'latest'])
					.default('first')
					.describe(
						'first: the clock starts at the earliest of these events. latest: it starts once all of them have happened.'
					),
				label: text.describe('What starts the clock, e.g. "you reported the problem"')
			})
			.strict(),
		period: z
			.object({
				days: z.number().int().positive(),
				count: z.enum(['calendar', 'business'])
			})
			.strict(),
		met_by: z.array(z.enum(ENTRY_KINDS)).min(1),
		met_label: text.describe('What stops the clock, e.g. "a technician visit"'),
		applies_if: Conditions.optional(),
		recipients: z
			.array(z.enum(RECIPIENTS))
			.min(1)
			.default([...RECIPIENTS]),
		letter: text.describe('Paragraph added to letters while this deadline matters')
	})
	.strict();

export const Protection = z
	.object({
		id,
		law: id,
		title: text,
		description: text,
		applies_if: Conditions.optional(),
		recipients: z.array(z.enum(RECIPIENTS)).default([...RECIPIENTS]),
		letter: text.optional().describe('Paragraph added to letters to these recipients')
	})
	.strict();

export const Agency = z
	.object({
		id,
		name: text,
		handles: text.describe('What this office handles, in plain language'),
		url: z.url({ protocol: /^https$/ }).describe('Official complaint page'),
		phone: text.optional(),
		address: text.optional().describe('Mailing address, one line per line'),
		applies_if: Conditions.optional()
	})
	.strict();

export const JurisdictionFile = z
	.object({
		schema_version: z.literal(SCHEMA_VERSION),
		id: z.string().regex(/^(?:[A-Z]{2}|US)$/, 'Use the two-letter USPS code, or US for federal'),
		name: text,
		last_checked: isoDate.describe('The day someone last checked these rules against the source'),
		summary: text,
		laws: z.array(Law).default([]),
		deadlines: z.array(Deadline).default([]),
		protections: z.array(Protection).default([]),
		agencies: z.array(Agency).default([]),
		holidays: HolidayConfig.default({ extends: ['us-federal'], add: [], remove: [] }),
		sources: z.array(Source).default([])
	})
	.strict();

export const LetterOption = z
	.object({
		id,
		label: text,
		help: text.optional(),
		default: z.boolean().default(false)
	})
	.strict();

export const LetterFile = z
	.object({
		schema_version: z.literal(SCHEMA_VERSION),
		id,
		recipient: z.enum(RECIPIENTS),
		title: text,
		description: text,
		subject: text,
		body: text,
		closing: text.default('Sincerely,'),
		response_days: z.number().int().min(1).max(60).default(10),
		options: z.array(LetterOption).default([])
	})
	.strict();

export type SourceDef = z.output<typeof Source>;
export type HolidayCalendarDef = z.output<typeof HolidayCalendarFile>;
export type LawDef = z.output<typeof Law>;
export type ConditionsDef = z.output<typeof Conditions>;
export type DeadlineDef = z.output<typeof Deadline>;
export type ProtectionDef = z.output<typeof Protection>;
export type AgencyDef = z.output<typeof Agency>;
export type JurisdictionDef = z.output<typeof JurisdictionFile>;
export type LetterDef = z.output<typeof LetterFile>;
export type LetterOptionDef = z.output<typeof LetterOption>;
export type Role = (typeof ROLES)[number];
