import { describe, expect, it } from 'vitest';
import {
	buildTimeline,
	describeItem,
	describeMissedPromise,
	describeWho,
	sentence
} from '../../src/lib/engine/timeline.ts';
import { entry, repair } from './fixtures.ts';

describe('timeline', () => {
	it('starts with the day the chair broke and sorts entries by date and time', () => {
		const r = repair({
			details: 'Joystick flashes',
			entries: [
				entry('2026-11-05', 'call', { time: '15:00', note: 'second' }),
				entry('2026-11-05', 'call', { time: '09:30', note: 'first' }),
				entry('2026-11-03', 'reported', { reference: 'WO-1' })
			]
		});
		const items = buildTimeline(r, '2026-11-19');
		expect(items.map((item) => item.kind)).toEqual(['broke', 'reported', 'call', 'call']);
		expect(items[0]).toMatchObject({
			day: 1,
			note: "Batteries. Joystick flashes. I can't use my chair at all."
		});
		expect(items.map((item) => item.note).slice(2)).toEqual(['first', 'second']);
		expect(items[1]).toMatchObject({ day: 2, who: 'Acme Mobility', reference: 'WO-1' });
	});

	it('describes who was involved', () => {
		const r = repair();
		expect(describeWho(entry('2026-11-03', 'call', { person: 'Dana' }), r)).toBe(
			'Dana at Acme Mobility'
		);
		expect(describeWho(entry('2026-11-03', 'call', { party: 'insurer' }), r)).toBe(
			'State Medicaid'
		);
		expect(describeWho(entry('2026-11-03', 'call', { party: 'clinician' }), r)).toBe(
			'Doctor or therapist'
		);
		expect(describeWho(entry('2026-11-03', 'call', { party: 'me' }), r)).toBeUndefined();
		expect(describeWho(entry('2026-11-03', 'call', { party: 'other', person: 'Sam' }), r)).toBe(
			'Sam'
		);
	});

	it('writes each item as a sentence for letters', () => {
		const r = repair({
			entries: [
				entry('2026-11-03', 'call', {
					time: '14:05',
					person: 'Dana',
					note: 'They will call back',
					reference: 'T-9',
					promise: { text: 'a call back', due: '2026-11-04', outcome: 'open' }
				})
			]
		});
		const item = buildTimeline(r, '2026-11-19')[1]!;
		expect(describeItem(item)).toEqual({
			heading: 'Nov 3, 2026, 2:05 PM (Day 2)',
			text: 'Phone call: Dana at Acme Mobility. They will call back. Promised: a call back, by Nov 4, 2026 (past due). Reference: T-9.'
		});
		expect(describeMissedPromise(r.entries[0]!, r)).toBe(
			'On November 3, 2026, Dana at Acme Mobility told me: a call back, by November 4, 2026. I have no record that it happened.'
		);
		expect(describeMissedPromise(entry('2026-11-03', 'call'), r)).toBe('');
	});

	it('ends sentences with punctuation', () => {
		expect(sentence(' hello ')).toBe('hello.');
		expect(sentence('Done!')).toBe('Done!');
		expect(sentence('')).toBe('');
	});
});
