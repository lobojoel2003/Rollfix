/**
 * Backups: the whole log as one JSON file the person can keep, email to themselves or move to
 * another device. Importing never trusts the file: every field is checked and cleaned, and
 * anything unknown is dropped.
 */
import { isISODate } from '../engine/civil-date.ts';
import {
	ENTRY_KINDS,
	EMPTY_PROFILE,
	PARTIES,
	PAYER_KINDS,
	PROBLEM_KINDS,
	SEVERITIES,
	type Contact,
	type Entry,
	type Profile,
	type PromiseOutcome,
	type Repair,
	type ShareReceipt
} from '../engine/model.ts';
import { isStateCode } from '../engine/states.ts';

export const BACKUP_FORMAT = 1;

export interface Backup {
	app: 'rollfix';
	format: number;
	exported: string;
	profile: Profile;
	repairs: Repair[];
}

export class BackupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupError';
	}
}

const MAX_TEXT = 5000;
const MAX_ENTRIES = 2000;
const MAX_REPAIRS = 500;

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, max = MAX_TEXT): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

function optionalStr(value: unknown, max = MAX_TEXT): string | undefined {
	const text = str(value, max).trim();
	return text ? text : undefined;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
	return typeof value === 'string' && (options as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

function date(value: unknown): string | undefined {
	return isISODate(value) ? value : undefined;
}

function timestamp(value: unknown, fallback: string): string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function id(value: unknown): string {
	return typeof value === 'string' && ID_RE.test(value) ? value : globalThis.crypto.randomUUID();
}

function contact(value: unknown): Contact {
	const source = isObject(value) ? value : {};
	return {
		name: str(source.name, 200),
		phone: str(source.phone, 50),
		email: str(source.email, 200),
		address: str(source.address, 500)
	};
}

export function cleanEntry(value: unknown): Entry | null {
	if (!isObject(value)) return null;
	const entryDate = date(value.date);
	if (!entryDate) return null;
	const entry: Entry = {
		id: id(value.id),
		date: entryDate,
		kind: oneOf(value.kind, ENTRY_KINDS, 'note'),
		party: oneOf(value.party, PARTIES, 'other'),
		note: str(value.note)
	};
	const time = typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time);
	if (time) entry.time = value.time as string;
	const person = optionalStr(value.person, 200);
	if (person) entry.person = person;
	const reference = optionalStr(value.reference, 200);
	if (reference) entry.reference = reference;
	if (isObject(value.promise)) {
		const due = date(value.promise.due);
		if (due) {
			entry.promise = {
				text: str(value.promise.text, 500),
				due,
				outcome: oneOf<PromiseOutcome>(value.promise.outcome, ['open', 'kept', 'broken'], 'open')
			};
		}
	}
	return entry;
}

function cleanShare(value: unknown): ShareReceipt | undefined {
	if (!isObject(value)) return undefined;
	if (typeof value.id !== 'string' || !ID_RE.test(value.id)) return undefined;
	if (typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value.token))
		return undefined;
	return {
		id: value.id,
		token: value.token,
		sharedAt: timestamp(value.sharedAt, new Date(0).toISOString()),
		payload: str(value.payload, 4000)
	};
}

export function cleanRepair(value: unknown, now = new Date().toISOString()): Repair | null {
	if (!isObject(value)) return null;
	const brokeOn = date(value.brokeOn);
	if (!brokeOn) return null;
	const chair = isObject(value.chair) ? value.chair : {};
	const supplier = isObject(value.supplier) ? value.supplier : {};
	const payer = isObject(value.payer) ? value.payer : {};
	const entries = (Array.isArray(value.entries) ? value.entries : [])
		.slice(0, MAX_ENTRIES)
		.map(cleanEntry)
		.filter((entry): entry is Entry => entry !== null);
	const fixedOn = date(value.fixedOn);
	const repair: Repair = {
		id: id(value.id),
		created: timestamp(value.created, now),
		updated: timestamp(value.updated, now),
		state: isStateCode(value.state) ? value.state : '',
		brokeOn,
		severity: oneOf(value.severity, SEVERITIES, 'stranded'),
		problem: oneOf(value.problem, PROBLEM_KINDS, 'other'),
		details: str(value.details),
		chair: {
			make: str(chair.make, 100),
			model: str(chair.model, 100),
			serial: str(chair.serial, 100)
		},
		supplier: { ...contact(supplier), account: str(supplier.account, 100) },
		payer: {
			...contact(payer),
			kind: oneOf(payer.kind, PAYER_KINDS, 'other'),
			memberId: str(payer.memberId, 100),
			claim: str(payer.claim, 100)
		},
		entries
	};
	if (fixedOn && fixedOn >= brokeOn) repair.fixedOn = fixedOn;
	const share = cleanShare(value.share);
	if (share) repair.share = share;
	return repair;
}

export function cleanProfile(value: unknown): Profile {
	if (!isObject(value)) return { ...EMPTY_PROFILE };
	return {
		...contact(value),
		state: isStateCode(value.state) ? value.state : ''
	};
}

export function createBackup(
	profile: Profile,
	repairs: readonly Repair[],
	now = new Date()
): Backup {
	return {
		app: 'rollfix',
		format: BACKUP_FORMAT,
		exported: now.toISOString(),
		profile: cleanProfile(profile),
		repairs: repairs
			.map((repair) => cleanRepair(repair))
			.filter((repair): repair is Repair => !!repair)
	};
}

export function backupToJson(backup: Backup): string {
	return JSON.stringify(backup, null, 2) + '\n';
}

/** Read a backup file. Throws BackupError with a message a person can act on. */
export function parseBackup(text: string): Backup {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new BackupError('This file is not a Rollfix backup (it is not valid JSON).');
	}
	if (!isObject(data) || data.app !== 'rollfix') {
		throw new BackupError('This file is not a Rollfix backup.');
	}
	if (typeof data.format !== 'number' || data.format > BACKUP_FORMAT) {
		throw new BackupError(
			'This backup was made by a newer version of Rollfix. Update the app and try again.'
		);
	}
	const repairs = (Array.isArray(data.repairs) ? data.repairs : [])
		.slice(0, MAX_REPAIRS)
		.map((repair) => cleanRepair(repair))
		.filter((repair): repair is Repair => repair !== null);
	return {
		app: 'rollfix',
		format: BACKUP_FORMAT,
		exported: timestamp(data.exported, new Date(0).toISOString()),
		profile: cleanProfile(data.profile),
		repairs
	};
}

/** Merge imported repairs into existing ones: same id → keep the most recently updated. */
export function mergeRepairs(existing: readonly Repair[], incoming: readonly Repair[]): Repair[] {
	const byId = new Map(existing.map((repair) => [repair.id, repair]));
	for (const repair of incoming) {
		const current = byId.get(repair.id);
		if (!current || Date.parse(repair.updated) >= Date.parse(current.updated)) {
			byId.set(repair.id, repair);
		}
	}
	return [...byId.values()];
}
