import { describe, expect, it } from 'vitest';
import { rulesFor } from '../../src/lib/engine/rules.ts';
import {
	buildReport,
	cannotShare,
	detectSupplier,
	SUPPLIER_KEYS
} from '../../src/lib/stats/payload.ts';
import { entry, jurisdiction, repair } from './fixtures.ts';

describe('anonymous share payload', () => {
	it('guesses the big national suppliers', () => {
		expect(detectSupplier('Numotion - Hartford')).toBe('numotion');
		expect(detectSupplier('National Seating & Mobility')).toBe('nsm');
		expect(detectSupplier('NSM')).toBe('nsm');
		expect(detectSupplier('Hoveround Corp')).toBe('hoveround');
		expect(detectSupplier('Joe’s Wheelchairs')).toBe('independent');
		expect(detectSupplier('  ')).toBe('not_shared');
		expect(SUPPLIER_KEYS).toContain('not_shared');
	});

	it('contains only counts and categories', () => {
		const r = repair({
			state: 'CT',
			details: 'secret notes',
			entries: [
				entry('2026-11-02', 'reported', {
					note: 'private',
					promise: { text: 'x', due: '2026-11-03', outcome: 'open' }
				}),
				entry('2026-11-06', 'visit'),
				entry('2026-11-07', 'auth_requested'),
				entry('2026-11-12', 'auth_approved'),
				entry('2026-11-12', 'parts_ordered'),
				entry('2026-11-13', 'loaner')
			]
		});
		const report = buildReport(
			r,
			rulesFor(r, jurisdiction(), undefined, '2026-11-19'),
			'2026-11-19',
			'independent'
		);
		expect(report).toEqual({
			schema: 1,
			state: 'CT',
			payer: 'medicaid',
			supplier: 'independent',
			problem: 'batteries',
			severity: 'stranded',
			broke_month: '2026-11',
			resolved: false,
			days_without_chair: 17,
			days_to_first_visit: 4,
			days_waiting_approval: 5,
			days_waiting_parts: null,
			promises_made: 1,
			promises_broken: 1,
			had_loaner: true,
			state_deadline_missed: true
		});
		expect(JSON.stringify(report)).not.toMatch(/secret|private|Acme|SN-1/);
	});

	it('reports no state deadline when none applied', () => {
		const r = repair({ fixedOn: '2026-11-04' });
		const report = buildReport(
			r,
			rulesFor(r, undefined, undefined, '2026-11-19'),
			'2026-11-19',
			'not_shared'
		);
		expect(report).toMatchObject({
			resolved: true,
			days_without_chair: 2,
			state_deadline_missed: null
		});
	});

	it('explains why a repair cannot be shared', () => {
		expect(cannotShare(repair({ state: '' }))).toMatch(/state/);
		expect(cannotShare(repair({ id: 'sample-current', state: 'CT' }))).toMatch(/Sample/);
		expect(cannotShare(repair({ state: 'CT' }))).toBeNull();
	});
});
