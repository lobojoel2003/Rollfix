/**
 * The repair log: what Rollfix stores on the device.
 *
 * A repair starts the day the chair broke and ends the day it was fixed. Everything that
 * happens in between (calls, visits, promises, approvals, parts) is an entry on its timeline.
 */
import type { ISODate } from './civil-date.ts';

export const ENTRY_KINDS = [
	'reported',
	'call',
	'message',
	'visit',
	'no_show',
	'auth_requested',
	'auth_approved',
	'auth_denied',
	'parts_ordered',
	'parts_arrived',
	'loaner',
	'letter',
	'impact',
	'repaired',
	'note'
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** The day the chair broke. Not stored as an entry; every timeline starts with it. */
export type TimelineKind = EntryKind | 'broke';

export interface KindInfo {
	/** Short label for pickers and timeline headings. */
	label: string;
	/** Helper text in the "what happened?" picker. */
	hint: string;
	/** Who this usually involves, used as the default party. */
	party: Party;
}

export const KIND_INFO: Record<TimelineKind, KindInfo> = {
	broke: { label: 'Chair stopped working', hint: '', party: 'me' },
	reported: {
		label: 'Reported the problem',
		hint: 'The first time you told the supplier the chair needs repair.',
		party: 'supplier'
	},
	call: { label: 'Phone call', hint: 'You called them, or they called you.', party: 'supplier' },
	message: {
		label: 'Email, text or portal message',
		hint: 'Anything in writing you sent or received.',
		party: 'supplier'
	},
	visit: {
		label: 'Technician visit',
		hint: 'Someone came to look at or work on the chair.',
		party: 'supplier'
	},
	no_show: {
		label: 'Nobody came',
		hint: 'A visit or call was scheduled and did not happen.',
		party: 'supplier'
	},
	auth_requested: {
		label: 'Sent to insurance for approval',
		hint: 'Prior authorization or a quote was sent to the insurer.',
		party: 'insurer'
	},
	auth_approved: {
		label: 'Insurance approved',
		hint: 'The insurer approved the repair.',
		party: 'insurer'
	},
	auth_denied: {
		label: 'Insurance denied',
		hint: 'The insurer denied or asked for more paperwork.',
		party: 'insurer'
	},
	parts_ordered: {
		label: 'Parts ordered',
		hint: 'The supplier ordered parts from the manufacturer.',
		party: 'supplier'
	},
	parts_arrived: {
		label: 'Parts arrived',
		hint: 'The parts reached the supplier.',
		party: 'supplier'
	},
	loaner: {
		label: 'Loaner chair',
		hint: 'You got a loaner or rental chair to use meanwhile.',
		party: 'supplier'
	},
	letter: {
		label: 'Letter or complaint sent',
		hint: 'A letter, complaint or appeal you sent.',
		party: 'supplier'
	},
	impact: {
		label: 'How this affected me',
		hint: 'A missed appointment, a fall, a sore, a day stuck in bed.',
		party: 'me'
	},
	repaired: { label: 'Chair repaired', hint: 'The chair works again.', party: 'supplier' },
	note: { label: 'Something else', hint: 'Any other note worth keeping.', party: 'other' }
};

export const PARTIES = [
	'supplier',
	'insurer',
	'manufacturer',
	'clinician',
	'agency',
	'me',
	'other'
] as const;
export type Party = (typeof PARTIES)[number];

export const PARTY_LABELS: Record<Party, string> = {
	supplier: 'Supplier',
	insurer: 'Insurance',
	manufacturer: 'Manufacturer',
	clinician: 'Doctor or therapist',
	agency: 'State or government office',
	me: 'Just me',
	other: 'Someone else'
};

export const PAYER_KINDS = [
	'medicare',
	'medicaid',
	'dual',
	'medicare_advantage',
	'medicaid_managed_care',
	'private',
	'va',
	'workers_comp',
	'self_pay',
	'other'
] as const;
export type PayerKind = (typeof PAYER_KINDS)[number];

export const PAYER_LABELS: Record<PayerKind, string> = {
	medicare: 'Medicare',
	medicaid: 'Medicaid',
	dual: 'Medicare and Medicaid',
	medicare_advantage: 'Medicare Advantage plan',
	medicaid_managed_care: 'Medicaid managed care plan',
	private: 'Private or employer insurance',
	va: 'VA (Veterans Affairs)',
	workers_comp: "Workers' compensation",
	self_pay: 'I pay myself',
	other: 'Other or not sure'
};

/** Medicare rules apply to these payers (Original Medicare pays first for dual eligibles). */
export const MEDICARE_PAYERS: readonly PayerKind[] = ['medicare', 'dual', 'medicare_advantage'];
export const MEDICAID_PAYERS: readonly PayerKind[] = ['medicaid', 'dual', 'medicaid_managed_care'];

export const PROBLEM_KINDS = [
	'batteries',
	'motor',
	'controller',
	'seating',
	'wheels',
	'brakes',
	'charger',
	'frame',
	'other'
] as const;
export type ProblemKind = (typeof PROBLEM_KINDS)[number];

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
	batteries: 'Batteries',
	motor: 'Motor or gearbox',
	controller: 'Joystick, controller or electronics',
	seating: 'Seat, cushion or power seat functions (tilt, recline, elevate)',
	wheels: 'Tires, wheels or casters',
	brakes: 'Brakes',
	charger: 'Charger',
	frame: 'Frame, armrests or footrests',
	other: 'Something else'
};

/** How a letter names the problem: "a problem with the batteries". Empty when unknown. */
export const PROBLEM_PHRASES: Record<ProblemKind, string> = {
	batteries: 'the batteries',
	motor: 'the motor or gearbox',
	controller: 'the joystick, controller or electronics',
	seating: 'the seat or power seat functions',
	wheels: 'the tires, wheels or casters',
	brakes: 'the brakes',
	charger: 'the charger',
	frame: 'the frame, armrests or footrests',
	other: ''
};

export const SEVERITIES = ['stranded', 'unsafe', 'limited'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
	stranded: "I can't use my chair at all",
	unsafe: 'It runs, but it is not safe to use',
	limited: 'It works, but not fully'
};

export type PromiseOutcome = 'open' | 'kept' | 'broken';

export interface PromiseRecord {
	/** What they said they would do, e.g. "Send a technician". */
	text: string;
	/** The date they said it would happen by. */
	due: ISODate;
	outcome: PromiseOutcome;
}

export interface Entry {
	id: string;
	date: ISODate;
	/** Optional time of day, "HH:MM" (24-hour). */
	time?: string;
	kind: EntryKind;
	party: Party;
	/** Name of the person you dealt with. */
	person?: string;
	/** What happened, in the person's own words. */
	note: string;
	/** Ticket, case, work order or authorization number. */
	reference?: string;
	promise?: PromiseRecord;
}

export interface Contact {
	name: string;
	phone: string;
	email: string;
	address: string;
}

export interface Repair {
	id: string;
	/** ISO timestamps, for sorting and backups. */
	created: string;
	updated: string;
	/** Two-letter USPS code, e.g. "CT". */
	state: string;
	brokeOn: ISODate;
	severity: Severity;
	problem: ProblemKind;
	details: string;
	chair: { make: string; model: string; serial: string };
	supplier: Contact & { account: string };
	payer: Contact & { kind: PayerKind; memberId: string; claim: string };
	/** The day the chair worked again. */
	fixedOn?: ISODate;
	entries: Entry[];
	/** Set after the person shares anonymous numbers. Holds the receipt needed to update or remove them. */
	share?: ShareReceipt;
}

export interface ShareReceipt {
	id: string;
	token: string;
	sharedAt: string;
	/** The exact JSON sent last time, so the person can see it and we know when it changed. */
	payload: string;
}

export interface Profile {
	name: string;
	address: string;
	phone: string;
	email: string;
	state: string;
}

export const EMPTY_PROFILE: Profile = { name: '', address: '', phone: '', email: '', state: '' };

export function emptyContact(): Contact {
	return { name: '', phone: '', email: '', address: '' };
}

/** A random id. Uses the Web Crypto API, available in browsers and Node. */
export function newId(): string {
	return globalThis.crypto.randomUUID();
}

export function isOpen(repair: Pick<Repair, 'fixedOn'>): boolean {
	return !repair.fixedOn;
}

/** Entries in date order (then time, then the order they were added). */
export function sortedEntries(entries: readonly Entry[]): Entry[] {
	return entries
		.map((entry, index) => ({ entry, index }))
		.sort(
			(a, b) =>
				a.entry.date.localeCompare(b.entry.date) ||
				(a.entry.time ?? '').localeCompare(b.entry.time ?? '') ||
				a.index - b.index
		)
		.map(({ entry }) => entry);
}

/** The first entry of a kind, in date order. */
export function firstEntry(repair: Pick<Repair, 'entries'>, kinds: readonly EntryKind[]) {
	return sortedEntries(repair.entries).find((entry) => kinds.includes(entry.kind));
}

/** The supplier's name, or a neutral fallback for letters. */
export function supplierName(repair: Pick<Repair, 'supplier'>): string {
	return repair.supplier.name.trim() || 'the supplier';
}

export function chairDescription(repair: Pick<Repair, 'chair'>): string {
	return [repair.chair.make, repair.chair.model]
		.map((part) => part.trim())
		.filter(Boolean)
		.join(' ');
}
