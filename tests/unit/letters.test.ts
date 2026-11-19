import { describe, expect, it } from 'vitest';
import {
	addresseeFor,
	letterToText,
	missingValues,
	renderLetter,
	splitLines,
	type LetterInput
} from '../../src/lib/engine/letters.ts';
import { EMPTY_PROFILE, type Profile } from '../../src/lib/engine/model.ts';
import { rulesFor } from '../../src/lib/engine/rules.ts';
import type { LetterDef } from '../../src/lib/engine/schema.ts';
import { segmentsToText } from '../../src/lib/engine/template.ts';
import { entry, jurisdiction, repair } from './fixtures.ts';

const profile: Profile = {
	name: 'Alex Rivera',
	address: '12 Elm St\nTown, ZZ 00000',
	phone: '555-0101',
	email: '',
	state: 'ZZ'
};

function letter(overrides: Partial<LetterDef> = {}): LetterDef {
	return {
		schema_version: 1,
		id: 'supplier',
		recipient: 'supplier',
		title: 'Letter',
		description: 'A letter.',
		subject: 'Day {{day_number}} without my {{chair}}',
		body: [
			'Dear {{supplier_name}},',
			'',
			'It broke on {{broke_date}}. {{#if is_stranded}}I cannot use it.{{/if}}',
			'',
			'{{#if has_missed_promises}}',
			'Missed:',
			'',
			'{{missed_promises}}',
			'{{/if}}',
			'',
			'{{#if has_state_rules}}',
			'{{state_rules}}',
			'{{/if}}',
			'',
			'{{#if ask_loaner}}Please lend me a chair.{{/if}} Reply by {{response_date}} ({{response_days}}).',
			'{{#if impact}}{{impact}}{{/if}}'
		].join('\n'),
		closing: 'Sincerely,',
		response_days: 7,
		options: [{ id: 'ask_loaner', label: 'Loaner', default: true }],
		...overrides
	};
}

const today = '2026-11-19';
const zz = jurisdiction();

function input(overrides: Partial<LetterInput> = {}): LetterInput {
	const r =
		overrides.repair ??
		repair({
			entries: [
				entry('2026-11-02', 'reported', {
					person: 'Dana',
					promise: { text: 'a technician visit', due: '2026-11-05', outcome: 'broken' }
				}),
				entry('2026-11-06', 'impact', { party: 'me', note: 'Missed a doctor visit' })
			]
		});
	return {
		letter: letter(),
		repair: r,
		profile,
		rules: rulesFor(r, zz, undefined, today),
		stateName: 'Testland',
		today,
		...overrides
	};
}

describe('letters', () => {
	it('fills the letter from the log', () => {
		const rendered = renderLetter(input());
		const body = segmentsToText(rendered.body);
		expect(segmentsToText(rendered.subject)).toBe('Day 18 without my Permobil M3');
		expect(body).toContain('Dear Acme Mobility,');
		expect(body).toContain('It broke on November 2, 2026. I cannot use it.');
		expect(body).toContain(
			'- On November 2, 2026, Dana at Acme Mobility told me: a technician visit, by November 5, 2026. That did not happen.'
		);
		expect(body).toContain('Please lend me a chair. Reply by November 26, 2026 (7 days).');
		expect(rendered.date).toBe('November 19, 2026');
		expect(rendered.references).toEqual(['Account number: A-1', 'Wheelchair serial number: SN-1']);
		expect(rendered.enclosureLabel).toBe('Repair timeline (3 entries)');
		expect(rendered.enclosure[1]?.heading).toBe('Nov 2, 2026 (Day 1)');
		expect(missingValues(rendered)).toEqual([]);
	});

	it('cites the state rules that matter to this recipient', () => {
		const body = segmentsToText(renderLetter(input()).body);
		expect(body).toContain(
			'Under T.S. § 1-100, a technician had to assess my chair within 3 business days of you reported the problem on November 2, 2026, by November 5, 2026. That deadline passed 14 days ago.'
		);
		expect(body).toContain('Wheelchair Repair Act (T.S. § 1-100) requires parts to be available.');
		expect(body).not.toContain('Should not appear');
	});

	it('leaves rules out when none apply', () => {
		const r = repair();
		const body = segmentsToText(
			renderLetter(input({ repair: r, rules: rulesFor(r, undefined, undefined, today) })).body
		);
		expect(body).not.toContain('T.S.');
		expect(body).not.toContain('Missed:');
	});

	it('honours options, response days and the impact text', () => {
		const body = segmentsToText(
			renderLetter(
				input({
					options: { ask_loaner: false },
					responseDays: 14,
					impact: 'I have been in bed for two weeks'
				})
			).body
		);
		expect(body).not.toContain('lend me');
		expect(body).toContain('Reply by December 3, 2026 (14 days).');
		expect(body).toContain('I have been in bed for two weeks.');
	});

	it('shows placeholders for missing details', () => {
		const r = repair({ supplier: { name: '', phone: '', email: '', address: '', account: '' } });
		const rendered = renderLetter(input({ repair: r, profile: { ...EMPTY_PROFILE } }));
		expect(missingValues(rendered)).toEqual(
			expect.arrayContaining([
				'[Your name]',
				'[Your address]',
				'[Recipient]',
				'[Mailing address]',
				'[Supplier name]'
			])
		);
		expect(rendered.signature[0]).toMatchObject({ missing: true });
	});

	it('addresses insurers and state offices', () => {
		const r = repair();
		expect(addresseeFor({ letter: letter({ recipient: 'insurer' }), repair: r })).toEqual({
			name: 'State Medicaid',
			address: 'PO Box 1\nTown, ZZ 00000'
		});
		expect(
			addresseeFor({
				letter: letter({ recipient: 'insurer' }),
				repair: { ...r, payer: { ...r.payer, name: '' } }
			}).name
		).toBe('Medicaid');
		expect(addresseeFor({ letter: letter({ recipient: 'agency' }), repair: r })).toEqual({
			name: '',
			address: ''
		});
		const agency = renderLetter(
			input({
				letter: letter({ recipient: 'agency' }),
				addressee: { name: 'Attorney General', address: '1 Capitol' }
			})
		);
		expect(agency.recipient.map((line) => segmentsToText(line))).toEqual([
			'Attorney General',
			'1 Capitol'
		]);
		expect(agency.references).toEqual([
			'Account number: A-1',
			'Member ID: M-1',
			'Wheelchair serial number: SN-1'
		]);
	});

	it('makes a plain-text version with the timeline', () => {
		const text = letterToText(renderLetter(input()));
		expect(text).toMatch(
			/^Alex Rivera\n12 Elm St\nTown, ZZ 00000\n555-0101\n\nNovember 19, 2026\n\nAcme Mobility\n1 Main St/
		);
		expect(text).toContain('Re: Day 18 without my Permobil M3\nAccount number: A-1');
		expect(text).toContain('Sincerely,\n\n\nAlex Rivera');
		expect(text).toContain('REPAIR TIMELINE (3 ENTRIES)');
		expect(text).toContain('Nov 6, 2026 (Day 5)\nHow this affected me. Missed a doctor visit.');
	});

	it('splits values into lines', () => {
		expect(
			splitLines([{ type: 'text', text: 'a\n b \n\nc' }]).map((line) => segmentsToText(line))
		).toEqual(['a', 'b', '', 'c']);
	});
});
