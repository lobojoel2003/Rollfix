import { describe, expect, it } from 'vitest';
import {
	addBusinessDays,
	businessDaysBetween,
	dayNumber,
	daysWithout,
	headline,
	missedPromises,
	promiseState
} from '../../src/lib/engine/clock.ts';
import { HolidayCalendar } from '../../src/lib/engine/holidays.ts';
import { entry, HOLIDAYS, repair } from './fixtures.ts';

describe('day counter', () => {
	it('counts the day the chair broke as Day 1', () => {
		const r = repair({ brokeOn: '2026-10-28' });
		expect(dayNumber(r, '2026-10-28')).toBe(1);
		expect(dayNumber(r, '2026-11-19')).toBe(23);
		expect(dayNumber(r, '2026-10-01')).toBe(1);
		expect(headline(r, '2026-11-19').text).toBe('Day 23 without your chair');
	});

	it('says "waiting for your repair" when the chair still works partly', () => {
		const r = repair({ brokeOn: '2026-11-18', severity: 'limited' });
		expect(headline(r, '2026-11-19')).toMatchObject({
			number: 2,
			text: 'Day 2 waiting for your repair'
		});
	});

	it('stops counting when the chair is fixed', () => {
		const r = repair({ brokeOn: '2026-10-01', fixedOn: '2026-10-24' });
		expect(daysWithout(r, '2026-11-19')).toBe(23);
		expect(headline(r, '2026-11-19').text).toBe('Fixed after 23 days');
		expect(
			headline(repair({ brokeOn: '2026-10-01', fixedOn: '2026-10-02' }), '2026-11-19').text
		).toBe('Fixed after 1 day');
		expect(daysWithout(repair({ brokeOn: '2026-11-20' }), '2026-11-19')).toBe(0);
	});
});

describe('promises', () => {
	it('works out where each promise stands', () => {
		expect(promiseState({ due: '2026-11-10', outcome: 'kept' }, '2026-11-19')).toBe('kept');
		expect(promiseState({ due: '2026-11-30', outcome: 'broken' }, '2026-11-19')).toBe('broken');
		expect(promiseState({ due: '2026-11-18', outcome: 'open' }, '2026-11-19')).toBe('overdue');
		expect(promiseState({ due: '2026-11-19', outcome: 'open' }, '2026-11-19')).toBe('due_today');
		expect(promiseState({ due: '2026-11-20', outcome: 'open' }, '2026-11-19')).toBe('pending');
	});

	it('lists broken and overdue promises in date order', () => {
		const r = repair({
			entries: [
				entry('2026-11-05', 'call', { promise: { text: 'b', due: '2026-11-06', outcome: 'open' } }),
				entry('2026-11-03', 'call', {
					promise: { text: 'a', due: '2026-11-30', outcome: 'broken' }
				}),
				entry('2026-11-04', 'call', {
					promise: { text: 'kept', due: '2026-11-05', outcome: 'kept' }
				}),
				entry('2026-11-04', 'call', {
					promise: { text: 'later', due: '2026-12-01', outcome: 'open' }
				}),
				entry('2026-11-04', 'note')
			]
		});
		expect(missedPromises(r, '2026-11-19').map((e) => e.promise?.text)).toEqual(['a', 'b']);
	});
});

describe('business days', () => {
	const calendar = new HolidayCalendar(HOLIDAYS);

	it('skips weekends and holidays, not counting the start day', () => {
		// Wed Nov 25 2026 + 3 business days: skips Thanksgiving (Thu) and the weekend.
		expect(addBusinessDays('2026-11-25', 3, calendar)).toBe('2026-12-01');
		expect(addBusinessDays('2026-11-02', 5, calendar)).toBe('2026-11-09');
		expect(addBusinessDays('2026-11-02', 0, calendar)).toBe('2026-11-02');
	});

	it('counts business days between two dates in either direction', () => {
		expect(businessDaysBetween('2026-11-25', '2026-12-01', calendar)).toBe(3);
		expect(businessDaysBetween('2026-12-01', '2026-11-25', calendar)).toBe(-3);
		expect(businessDaysBetween('2026-11-02', '2026-11-02', calendar)).toBe(0);
	});
});
