/**
 * Checking a repair against the rules that apply to it.
 *
 * A state deadline starts when something happens on the timeline (for example "you reported
 * the problem") and stops when something else does ("a technician visit"). Rollfix compares
 * the person's own log with the deadline and says whether it was met, is still running, or
 * was missed, and by how many days.
 */
import { addDays, compareDates, diffDays, type ISODate } from './civil-date.ts';
import { HolidayCalendar, type HolidayDef } from './holidays.ts';
import { sortedEntries, type Repair } from './model.ts';
import type {
	AgencyDef,
	ConditionsDef,
	DeadlineDef,
	JurisdictionDef,
	LawDef,
	ProtectionDef,
	Recipient
} from './schema.ts';

/** A jurisdiction as the app receives it: validated, with its holiday rules resolved. */
export type Jurisdiction = JurisdictionDef & { holidayRules: HolidayDef[] };

export type DeadlineStatus =
	| 'not_started'
	| 'running'
	| 'paused'
	| 'due_today'
	| 'met'
	| 'met_late'
	| 'missed'
	| 'not_in_effect';

export interface DeadlineCheck {
	deadline: DeadlineDef;
	law: LawDef;
	jurisdiction: Jurisdiction;
	status: DeadlineStatus;
	/** The day the clock started (not itself counted). */
	start?: ISODate;
	/** The last day to act. Unknown while the clock is paused. */
	due?: ISODate;
	/** The day the deadline was met, if it was. */
	metOn?: ISODate;
	/** Calendar days left until the due date (0 on the day). */
	daysLeft?: number;
	/** Calendar days past the due date: until it was met, or until today. */
	daysLate?: number;
	/** Days of the period used so far (counted the way the period is: calendar or business). */
	daysUsed?: number;
	/** While paused: since when, and why. */
	pausedSince?: ISODate;
	pausedFor?: string;
}

const calendars = new WeakMap<Jurisdiction, HolidayCalendar>();

export function calendarFor(jurisdiction: Jurisdiction): HolidayCalendar {
	let calendar = calendars.get(jurisdiction);
	if (!calendar) {
		calendar = new HolidayCalendar(jurisdiction.holidayRules);
		calendars.set(jurisdiction, calendar);
	}
	return calendar;
}

/** Whether a law is in force on a date. */
export function lawInForce(law: LawDef, on: ISODate): boolean {
	if (law.status !== 'in_force' && law.status !== 'enacted') return false;
	return !law.effective || compareDates(law.effective, on) <= 0;
}

export function matchesConditions(
	conditions: ConditionsDef | undefined,
	repair: Pick<Repair, 'payer' | 'severity'>
): boolean {
	if (!conditions) return true;
	if (conditions.payers && !conditions.payers.includes(repair.payer.kind)) return false;
	if (conditions.severities && !conditions.severities.includes(repair.severity)) return false;
	return true;
}

/** The date the clock starts for a deadline, from the repair's timeline. */
export function startDate(deadline: DeadlineDef, repair: Repair): ISODate | undefined {
	const entries = sortedEntries(repair.entries);
	const dates = deadline.starts.events.map((event) =>
		event === 'broke' ? repair.brokeOn : entries.find((entry) => entry.kind === event)?.date
	);
	const found = dates.filter((date): date is ISODate => date !== undefined).sort();
	switch (deadline.starts.when) {
		case 'all':
			return found.length === dates.length ? found.at(-1) : undefined;
		case 'last':
			return found.at(-1);
		default:
			return found[0];
	}
}

/** A stretch of time that doesn't count toward a deadline. `to` is missing while it lasts. */
export interface Pause {
	from: ISODate;
	to?: ISODate;
	label: string;
}

/**
 * The pauses on a repair's timeline for a deadline: from each "from" event to the next
 * "until" event on or after it. A pause still open when the repair was fixed ends that day.
 */
export function pausesFor(deadline: DeadlineDef, repair: Repair, start: ISODate): Pause[] {
	const entries = sortedEntries(repair.entries);
	const pauses: Pause[] = [];
	for (const rule of deadline.pauses) {
		for (const begin of entries.filter((entry) => entry.kind === rule.from)) {
			const end = entries.find(
				(entry) => rule.until.includes(entry.kind) && compareDates(entry.date, begin.date) >= 0
			);
			const to = end?.date ?? repair.fixedOn;
			if (to && compareDates(to, start) < 0) continue;
			pauses.push(
				to ? { from: begin.date, to, label: rule.label } : { from: begin.date, label: rule.label }
			);
		}
	}
	return pauses;
}

export interface ClockResult {
	/** The last day, when the period could be counted to the end. */
	due?: ISODate;
	/** Days counted, up to `until` or to the due date. */
	used: number;
	/** The pause that stopped the count, if one did. */
	paused?: Pause;
}

/**
 * Count a period from `start` (not itself counted), skipping weekends and holidays for
 * business days and every day inside a pause. Stops at an open pause, or after `until`.
 */
export function runClock(
	start: ISODate,
	period: DeadlineDef['period'],
	calendar: HolidayCalendar,
	pauses: readonly Pause[] = [],
	until?: ISODate
): ClockResult {
	let cursor = start;
	let used = 0;
	for (let guard = 0; used < period.days && guard < 3660; guard++) {
		cursor = addDays(cursor, 1);
		if (until && compareDates(cursor, until) > 0) return { used };
		const open = pauses.find((pause) => !pause.to && compareDates(cursor, pause.from) >= 0);
		if (open) return { used, paused: open };
		const inPause = pauses.some(
			(pause) =>
				pause.to && compareDates(cursor, pause.from) >= 0 && compareDates(cursor, pause.to) <= 0
		);
		if (inPause) continue;
		if (period.count === 'business' && !calendar.isBusinessDay(cursor)) continue;
		used++;
	}
	return { due: cursor, used };
}

/** The due date for a deadline started on `start`, with no pauses. */
export function dueDate(
	deadline: DeadlineDef,
	start: ISODate,
	jurisdiction: Jurisdiction
): ISODate {
	return runClock(start, deadline.period, calendarFor(jurisdiction)).due ?? start;
}

export function checkDeadline(
	deadline: DeadlineDef,
	jurisdiction: Jurisdiction,
	repair: Repair,
	today: ISODate
): DeadlineCheck {
	const law = jurisdiction.laws.find((candidate) => candidate.id === deadline.law);
	if (!law) throw new Error(`Deadline "${deadline.id}" refers to unknown law "${deadline.law}"`);
	const base = { deadline, law, jurisdiction };
	const start = startDate(deadline, repair);
	if (!start) {
		return lawInForce(law, today)
			? { ...base, status: 'not_started' }
			: { ...base, status: 'not_in_effect' };
	}
	if (!lawInForce(law, start)) return { ...base, status: 'not_in_effect', start };

	const calendar = calendarFor(jurisdiction);
	const met = sortedEntries(repair.entries).find(
		(entry) =>
			deadline.met_by.includes(entry.kind) &&
			compareDates(entry.date, start) >= 0 &&
			(!deadline.met_party || deadline.met_party.includes(entry.party))
	);
	const metOn =
		met?.date ??
		(deadline.met_by.includes('repaired') && repair.fixedOn ? repair.fixedOn : undefined);
	// Once the deadline is met, any pause still open ends on that day.
	const pauses = pausesFor(deadline, repair, start).map((pause) =>
		metOn && !pause.to && compareDates(pause.from, metOn) <= 0 ? { ...pause, to: metOn } : pause
	);
	const clock = runClock(start, deadline.period, calendar, pauses);

	if (metOn) {
		if (!clock.due || compareDates(metOn, clock.due) <= 0) {
			return { ...base, status: 'met', start, due: clock.due, metOn };
		}
		return {
			...base,
			status: 'met_late',
			start,
			due: clock.due,
			metOn,
			daysLate: diffDays(clock.due, metOn)
		};
	}
	// A repair closed without the event that stops this clock, by the due date: counted as met.
	if (repair.fixedOn && clock.due && compareDates(repair.fixedOn, clock.due) <= 0) {
		return { ...base, status: 'met', start, due: clock.due, metOn: repair.fixedOn };
	}
	if (!clock.due) {
		return {
			...base,
			status: 'paused',
			start,
			daysUsed: clock.used,
			pausedSince: clock.paused?.from,
			pausedFor: clock.paused?.label
		};
	}
	const used = runClock(start, deadline.period, calendar, pauses, today).used;
	const left = diffDays(today, clock.due);
	if (left > 0)
		return { ...base, status: 'running', start, due: clock.due, daysLeft: left, daysUsed: used };
	if (left === 0)
		return { ...base, status: 'due_today', start, due: clock.due, daysLeft: 0, daysUsed: used };
	const end = repair.fixedOn && compareDates(repair.fixedOn, today) < 0 ? repair.fixedOn : today;
	return { ...base, status: 'missed', start, due: clock.due, daysLate: diffDays(clock.due, end) };
}

export interface RulesForRepair {
	jurisdictions: Jurisdiction[];
	deadlines: DeadlineCheck[];
	protections: { protection: ProtectionDef; law: LawDef; jurisdiction: Jurisdiction }[];
	agencies: { agency: AgencyDef; jurisdiction: Jurisdiction }[];
}

/**
 * Everything that applies to a repair: the state's rules, plus federal Medicare rules when
 * Medicare pays. Laws that aren't in force today are left out of protections.
 */
export function rulesFor(
	repair: Repair,
	state: Jurisdiction | undefined,
	federal: Jurisdiction | undefined,
	today: ISODate
): RulesForRepair {
	const jurisdictions = [state, federal].filter((item): item is Jurisdiction => !!item);
	const deadlines: DeadlineCheck[] = [];
	const protections: RulesForRepair['protections'] = [];
	const agencies: RulesForRepair['agencies'] = [];

	for (const jurisdiction of jurisdictions) {
		for (const deadline of jurisdiction.deadlines) {
			if (!matchesConditions(deadline.applies_if, repair)) continue;
			deadlines.push(checkDeadline(deadline, jurisdiction, repair, today));
		}
		for (const protection of jurisdiction.protections) {
			if (!matchesConditions(protection.applies_if, repair)) continue;
			const law = jurisdiction.laws.find((candidate) => candidate.id === protection.law);
			if (!law || !lawInForce(law, today)) continue;
			protections.push({ protection, law, jurisdiction });
		}
		for (const agency of jurisdiction.agencies) {
			if (!matchesConditions(agency.applies_if, repair)) continue;
			agencies.push({ agency, jurisdiction });
		}
	}
	return { jurisdictions, deadlines, protections, agencies };
}

/** Deadlines worth raising in a letter to this recipient: started, and either running or missed. */
export function deadlinesForLetter(
	checks: readonly DeadlineCheck[],
	recipient: Recipient
): DeadlineCheck[] {
	return checks.filter(
		(check) =>
			check.deadline.recipients.includes(recipient) &&
			['running', 'paused', 'due_today', 'missed', 'met_late'].includes(check.status)
	);
}

export const STATUS_LABELS: Record<DeadlineStatus, string> = {
	not_started: 'Not started',
	running: 'Clock running',
	paused: 'Clock paused',
	due_today: 'Due today',
	met: 'Met',
	met_late: 'Met late',
	missed: 'Missed',
	not_in_effect: 'Not in effect'
};
