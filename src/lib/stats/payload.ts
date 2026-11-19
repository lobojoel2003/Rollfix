/**
 * The anonymous numbers a person can choose to share with advocates.
 *
 * Only counts of days and a few categories leave the device: no names, no dates finer than
 * the month, no notes, no ids from the log. The person sees this exact object before sending.
 */
import { diffDays, type ISODate } from '../engine/civil-date.ts';
import { daysWithout, missedPromises } from '../engine/clock.ts';
import {
	firstEntry,
	sortedEntries,
	type PayerKind,
	type ProblemKind,
	type Repair,
	type Severity
} from '../engine/model.ts';
import type { RulesForRepair } from '../engine/rules.ts';

export const STATS_SCHEMA = 1;

export const SUPPLIER_KEYS = ['numotion', 'nsm', 'hoveround', 'independent', 'not_shared'] as const;
export type SupplierKey = (typeof SUPPLIER_KEYS)[number];

export const SUPPLIER_LABELS: Record<SupplierKey, string> = {
	numotion: 'Numotion',
	nsm: 'National Seating & Mobility',
	hoveround: 'Hoveround',
	independent: 'A local or independent supplier',
	not_shared: 'Not shared'
};

export interface StatsReport {
	schema: typeof STATS_SCHEMA;
	state: string;
	payer: PayerKind;
	supplier: SupplierKey;
	problem: ProblemKind;
	severity: Severity;
	/** Year and month the chair broke, e.g. "2026-10". */
	broke_month: string;
	resolved: boolean;
	days_without_chair: number;
	days_to_first_visit: number | null;
	days_waiting_approval: number | null;
	days_waiting_parts: number | null;
	promises_made: number;
	promises_broken: number;
	had_loaner: boolean;
	/** Whether a state repair deadline was missed. Null when no state deadline applied. */
	state_deadline_missed: boolean | null;
}

/** Guess which of the big national suppliers this is, from the name the person typed. */
export function detectSupplier(name: string): SupplierKey {
	if (/numotion/i.test(name)) return 'numotion';
	if (/national\s+seating|\bnsm\b/i.test(name)) return 'nsm';
	if (/hoveround/i.test(name)) return 'hoveround';
	return name.trim() ? 'independent' : 'not_shared';
}

/** Days between the first `from` event and the first `to` event after it, if both happened. */
function interval(repair: Repair, from: ISODate | undefined, to: readonly string[]): number | null {
	if (!from) return null;
	const end = sortedEntries(repair.entries).find(
		(entry) => to.includes(entry.kind) && entry.date >= from
	);
	return end ? diffDays(from, end.date) : null;
}

export function buildReport(
	repair: Repair,
	rules: RulesForRepair,
	today: ISODate,
	supplier: SupplierKey
): StatsReport {
	const promises = repair.entries.filter((entry) => entry.promise);
	const stateChecks = rules.deadlines.filter((check) => check.jurisdiction.id !== 'US');
	const started = stateChecks.filter(
		(check) => !['not_started', 'not_in_effect'].includes(check.status)
	);
	return {
		schema: STATS_SCHEMA,
		state: repair.state,
		payer: repair.payer.kind,
		supplier,
		problem: repair.problem,
		severity: repair.severity,
		broke_month: repair.brokeOn.slice(0, 7),
		resolved: !!repair.fixedOn,
		days_without_chair: daysWithout(repair, today),
		days_to_first_visit: interval(repair, repair.brokeOn, ['visit']),
		days_waiting_approval: interval(repair, firstEntry(repair, ['auth_requested'])?.date, [
			'auth_approved',
			'auth_denied'
		]),
		days_waiting_parts: interval(repair, firstEntry(repair, ['parts_ordered'])?.date, [
			'parts_arrived'
		]),
		promises_made: promises.length,
		promises_broken: missedPromises(repair, today).length,
		had_loaner: repair.entries.some((entry) => entry.kind === 'loaner'),
		state_deadline_missed:
			started.length === 0
				? null
				: started.some((check) => check.status === 'missed' || check.status === 'met_late')
	};
}

/** Why a repair can't be shared yet, or null when it can. */
export function cannotShare(repair: Repair): string | null {
	if (!repair.state) return 'Add your state to the repair details first.';
	if (repair.id.startsWith('sample-')) return 'Sample data can’t be shared.';
	return null;
}
