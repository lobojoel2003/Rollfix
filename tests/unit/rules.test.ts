import { describe, expect, it } from 'vitest';
import {
	checkDeadline,
	deadlinesForLetter,
	lawInForce,
	matchesConditions,
	rulesFor,
	startDate,
	STATUS_LABELS
} from '../../src/lib/engine/rules.ts';
import { entry, jurisdiction, repair } from './fixtures.ts';

const zz = jurisdiction();
const assess = zz.deadlines[0]!;
const repairDeadline = zz.deadlines[1]!;

describe('deadline checks', () => {
	it('waits for the event that starts the clock', () => {
		const check = checkDeadline(assess, zz, repair(), '2026-11-19');
		expect(check.status).toBe('not_started');
		expect(check.due).toBeUndefined();
	});

	it('counts business days from the first report', () => {
		const r = repair({ entries: [entry('2026-11-02', 'reported')] });
		expect(checkDeadline(assess, zz, r, '2026-11-03')).toMatchObject({
			status: 'running',
			start: '2026-11-02',
			due: '2026-11-05',
			daysLeft: 2
		});
		expect(checkDeadline(assess, zz, r, '2026-11-05').status).toBe('due_today');
		expect(checkDeadline(assess, zz, r, '2026-11-19')).toMatchObject({
			status: 'missed',
			daysLate: 14
		});
	});

	it('is met by the right event on or after the start', () => {
		const onTime = repair({
			entries: [entry('2026-11-02', 'reported'), entry('2026-11-04', 'visit')]
		});
		expect(checkDeadline(assess, zz, onTime, '2026-11-19')).toMatchObject({
			status: 'met',
			metOn: '2026-11-04'
		});
		const late = repair({
			entries: [
				entry('2026-11-02', 'reported'),
				entry('2026-11-01', 'visit'),
				entry('2026-11-10', 'visit')
			]
		});
		expect(checkDeadline(assess, zz, late, '2026-11-19')).toMatchObject({
			status: 'met_late',
			metOn: '2026-11-10',
			daysLate: 5
		});
	});

	it('starts "latest" clocks only once every event has happened', () => {
		const approved = repair({ entries: [entry('2026-11-05', 'auth_approved')] });
		expect(startDate(repairDeadline, approved)).toBeUndefined();
		const both = repair({
			entries: [entry('2026-11-05', 'auth_approved'), entry('2026-11-09', 'parts_arrived')]
		});
		expect(startDate(repairDeadline, both)).toBe('2026-11-09');
		expect(checkDeadline(repairDeadline, zz, both, '2026-11-12')).toMatchObject({
			status: 'running',
			due: '2026-11-19'
		});
	});

	it('uses the fixed date when the repair is closed', () => {
		const fixed = repair({
			fixedOn: '2026-11-15',
			entries: [entry('2026-11-05', 'auth_approved'), entry('2026-11-05', 'parts_arrived')]
		});
		expect(checkDeadline(repairDeadline, zz, fixed, '2026-11-30')).toMatchObject({
			status: 'met',
			metOn: '2026-11-15'
		});
		const lateFix = repair({
			fixedOn: '2026-11-25',
			entries: [entry('2026-11-05', 'auth_approved'), entry('2026-11-05', 'parts_arrived')]
		});
		expect(checkDeadline(repairDeadline, zz, lateFix, '2026-11-30')).toMatchObject({
			status: 'met_late',
			daysLate: 10
		});
		// Closed without the stopping event, before the due date: counted as met.
		const closed = repair({ fixedOn: '2026-11-04', entries: [entry('2026-11-02', 'reported')] });
		expect(checkDeadline(assess, zz, closed, '2026-11-30').status).toBe('met');
		// Closed after the due date without a visit logged: missed, counted to the fix date.
		const closedLate = repair({
			fixedOn: '2026-11-10',
			entries: [entry('2026-11-02', 'reported')]
		});
		expect(checkDeadline(assess, zz, closedLate, '2026-11-30')).toMatchObject({
			status: 'missed',
			daysLate: 5
		});
	});

	it('ignores laws that are not in force yet', () => {
		const future = zz.deadlines[2]!;
		expect(checkDeadline(future, zz, repair(), '2026-11-19').status).toBe('not_in_effect');
		const requested = repair({ entries: [entry('2026-11-02', 'auth_requested')] });
		expect(checkDeadline(future, zz, requested, '2026-11-19').status).toBe('not_in_effect');
		expect(lawInForce(zz.laws[1]!, '2027-07-01')).toBe(true);
		expect(lawInForce({ ...zz.laws[0]!, status: 'pending' }, '2030-01-01')).toBe(false);
		expect(lawInForce({ ...zz.laws[0]!, effective: undefined }, '2020-01-01')).toBe(true);
	});

	it('throws on a deadline that refers to an unknown law', () => {
		expect(() => checkDeadline({ ...assess, law: 'nope' }, zz, repair(), '2026-11-19')).toThrow(
			/unknown law/
		);
	});

	it('has a label for every status', () => {
		expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
	});
});

describe('rules for a repair', () => {
	it('filters by payer and severity', () => {
		expect(matchesConditions(undefined, repair())).toBe(true);
		expect(matchesConditions({ payers: ['medicare'] }, repair())).toBe(false);
		expect(matchesConditions({ severities: ['limited'] }, repair())).toBe(false);
		expect(matchesConditions({ payers: ['medicaid'], severities: ['stranded'] }, repair())).toBe(
			true
		);
	});

	it('collects deadlines, protections in force and matching agencies', () => {
		const result = rulesFor(repair(), zz, undefined, '2026-11-19');
		expect(result.jurisdictions).toHaveLength(1);
		expect(result.deadlines.map((check) => check.deadline.id)).toEqual([
			'assess',
			'repair',
			'medicaid-only'
		]);
		expect(result.protections.map(({ protection }) => protection.id)).toEqual(['parts']);
		expect(result.agencies.map(({ agency }) => agency.id)).toEqual(['ag']);

		const medicare = rulesFor(
			repair({ payer: { ...repair().payer, kind: 'medicare' } }),
			zz,
			zz,
			'2026-11-19'
		);
		expect(medicare.jurisdictions).toHaveLength(2);
		expect(medicare.agencies.map(({ agency }) => agency.id)).toEqual([
			'ag',
			'medicare-only',
			'ag',
			'medicare-only'
		]);
	});

	it('picks the deadlines worth raising in a letter', () => {
		const r = repair({ entries: [entry('2026-11-02', 'reported')] });
		const { deadlines } = rulesFor(r, zz, undefined, '2026-11-19');
		expect(deadlinesForLetter(deadlines, 'supplier').map((c) => c.deadline.id)).toEqual(['assess']);
		expect(deadlinesForLetter(deadlines, 'insurer')).toEqual([]);
	});
});
