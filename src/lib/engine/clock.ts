/**
 * Counting the days without a chair.
 *
 * The day the chair broke is Day 1. A repair that is still open counts up to today; a fixed
 * one stops on the day it was fixed. "Days without" is the number of whole days between the
 * two, which is what the stats and letters report.
 */
import { addDays, compareDates, diffDays, type ISODate } from './civil-date.ts';
import type { HolidayCalendar } from './holidays.ts';
import { sortedEntries, type Entry, type PromiseOutcome, type Repair } from './model.ts';

/** Which day of the repair a date falls on (the day it broke is Day 1). */
export function dayNumber(repair: Pick<Repair, 'brokeOn'>, date: ISODate): number {
	return Math.max(1, diffDays(repair.brokeOn, date) + 1);
}

/** The last day counted: the day it was fixed, or today. */
export function endDate(repair: Pick<Repair, 'fixedOn'>, today: ISODate): ISODate {
	return repair.fixedOn ?? today;
}

/** Whole days without the chair, from the day it broke to the day it was fixed (or today). */
export function daysWithout(repair: Pick<Repair, 'brokeOn' | 'fixedOn'>, today: ISODate): number {
	return Math.max(0, diffDays(repair.brokeOn, endDate(repair, today)));
}

export interface Headline {
	/** The big number. */
	number: number;
	/** e.g. "Day 23 without your chair" or "Fixed after 23 days". */
	text: string;
	/** The number and the words around it, so the number can be styled on its own. */
	before: string;
	after: string;
}

export function headline(repair: Repair, today: ISODate): Headline {
	if (repair.fixedOn) {
		const days = daysWithout(repair, today);
		return {
			number: days,
			before: 'Fixed after',
			after: days === 1 ? 'day' : 'days',
			text: `Fixed after ${days} ${days === 1 ? 'day' : 'days'}`
		};
	}
	const day = dayNumber(repair, today);
	const after = repair.severity === 'limited' ? 'waiting for your repair' : 'without your chair';
	return { number: day, before: 'Day', after, text: `Day ${day} ${after}` };
}

export type PromiseState = 'kept' | 'broken' | 'overdue' | 'due_today' | 'pending';

/**
 * Where a promise stands today. A promise nobody has marked as kept is "overdue" once its
 * date has passed; the person can then confirm it was broken.
 */
export function promiseState(
	promise: { due: ISODate; outcome: PromiseOutcome },
	today: ISODate
): PromiseState {
	if (promise.outcome === 'kept') return 'kept';
	if (promise.outcome === 'broken') return 'broken';
	const order = compareDates(promise.due, today);
	if (order < 0) return 'overdue';
	if (order === 0) return 'due_today';
	return 'pending';
}

/** Promises that were broken, or are past due with nothing to show for it. */
export function missedPromises(repair: Pick<Repair, 'entries'>, today: ISODate): Entry[] {
	return sortedEntries(repair.entries).filter((entry) => {
		if (!entry.promise) return false;
		const state = promiseState(entry.promise, today);
		return state === 'broken' || state === 'overdue';
	});
}

/** The date `days` business days after `start` (the start day itself doesn't count). */
export function addBusinessDays(start: ISODate, days: number, calendar: HolidayCalendar): ISODate {
	let cursor = start;
	let counted = 0;
	while (counted < days) {
		cursor = addDays(cursor, 1);
		if (calendar.isBusinessDay(cursor)) counted++;
	}
	return cursor;
}

/** Business days from `from` (exclusive) to `to` (inclusive). Negative when `to` is earlier. */
export function businessDaysBetween(from: ISODate, to: ISODate, calendar: HolidayCalendar): number {
	const sign = compareDates(to, from) < 0 ? -1 : 1;
	const [start, end] = sign === 1 ? [from, to] : [to, from];
	let cursor = start;
	let count = 0;
	while (compareDates(cursor, end) < 0) {
		cursor = addDays(cursor, 1);
		if (calendar.isBusinessDay(cursor)) count++;
	}
	return sign * count;
}
