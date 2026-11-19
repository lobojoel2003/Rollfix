/**
 * Checking a repair against the rules that apply to it.
 *
 * A state deadline starts when something happens on the timeline (for example "you reported
 * the problem") and stops when something else does ("a technician visit"). Rollfix compares
 * the person's own log with the deadline and says whether it was met, is still running, or
 * was missed, and by how many days.
 */
import { addDays, compareDates, diffDays, type ISODate } from './civil-date.ts';
import { addBusinessDays } from './clock.ts';
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
	'not_started' | 'running' | 'due_today' | 'met' | 'met_late' | 'missed' | 'not_in_effect';

export interface DeadlineCheck {
	deadline: DeadlineDef;
	law: LawDef;
	jurisdiction: Jurisdiction;
	status: DeadlineStatus;
	/** The day the clock started (not itself counted). */
	start?: ISODate;
	/** The last day to act. */
	due?: ISODate;
	/** The day the deadline was met, if it was. */
	metOn?: ISODate;
	/** Calendar days left until the due date (0 on the day). */
	daysLeft?: number;
	/** Calendar days past the due date: until it was met, or until today. */
	daysLate?: number;
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
	if (deadline.starts.when === 'latest') {
		return found.length === dates.length ? found.at(-1) : undefined;
	}
	return found[0];
}

export function dueDate(
	deadline: DeadlineDef,
	start: ISODate,
	jurisdiction: Jurisdiction
): ISODate {
	return deadline.period.count === 'business'
		? addBusinessDays(start, deadline.period.days, calendarFor(jurisdiction))
		: addDays(start, deadline.period.days);
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

	const due = dueDate(deadline, start, jurisdiction);
	const met = sortedEntries(repair.entries).find(
		(entry) => deadline.met_by.includes(entry.kind) && compareDates(entry.date, start) >= 0
	);
	const metOn =
		met?.date ??
		(deadline.met_by.includes('repaired') && repair.fixedOn ? repair.fixedOn : undefined);

	if (metOn) {
		const late = diffDays(due, metOn);
		return late > 0
			? { ...base, status: 'met_late', start, due, metOn, daysLate: late }
			: { ...base, status: 'met', start, due, metOn };
	}
	// A repair that is closed without the event that stops this clock: we can't tell.
	if (repair.fixedOn && compareDates(repair.fixedOn, due) <= 0) {
		return { ...base, status: 'met', start, due, metOn: repair.fixedOn };
	}
	const left = diffDays(today, due);
	if (left > 0) return { ...base, status: 'running', start, due, daysLeft: left };
	if (left === 0) return { ...base, status: 'due_today', start, due, daysLeft: 0 };
	const end = repair.fixedOn && compareDates(repair.fixedOn, today) < 0 ? repair.fixedOn : today;
	return { ...base, status: 'missed', start, due, daysLate: diffDays(due, end) };
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
			['running', 'due_today', 'missed', 'met_late'].includes(check.status)
	);
}

export const STATUS_LABELS: Record<DeadlineStatus, string> = {
	not_started: 'Not started',
	running: 'Clock running',
	due_today: 'Due today',
	met: 'Met',
	met_late: 'Met late',
	missed: 'Missed',
	not_in_effect: 'Not in effect'
};
