import type { HolidayDef } from '../../src/lib/engine/holidays.ts';
import type { Entry, Repair } from '../../src/lib/engine/model.ts';
import type { Jurisdiction } from '../../src/lib/engine/rules.ts';

export const HOLIDAYS: HolidayDef[] = [
	{ id: 'thanksgiving', name: 'Thanksgiving Day', date: { month: 11, weekday: 'thu', nth: 4 } },
	{ id: 'christmas', name: 'Christmas Day', date: { month: 12, day: 25 } }
];

export function repair(overrides: Partial<Repair> = {}): Repair {
	return {
		id: 'r1',
		created: '2026-11-01T00:00:00.000Z',
		updated: '2026-11-01T00:00:00.000Z',
		state: 'ZZ',
		brokeOn: '2026-11-02',
		severity: 'stranded',
		problem: 'batteries',
		details: '',
		chair: { make: 'Permobil', model: 'M3', serial: 'SN-1' },
		supplier: {
			name: 'Acme Mobility',
			phone: '',
			email: '',
			address: '1 Main St\nTown, ZZ 00000',
			account: 'A-1'
		},
		payer: {
			kind: 'medicaid',
			name: 'State Medicaid',
			phone: '',
			email: '',
			address: 'PO Box 1\nTown, ZZ 00000',
			memberId: 'M-1',
			claim: ''
		},
		entries: [],
		...overrides
	};
}

let counter = 0;
export function entry(date: string, kind: Entry['kind'], overrides: Partial<Entry> = {}): Entry {
	counter += 1;
	return { id: `e${counter}`, date, kind, party: 'supplier', note: '', ...overrides };
}

/** A made-up state with one deadline of each kind. */
export function jurisdiction(overrides: Partial<Jurisdiction> = {}): Jurisdiction {
	return {
		schema_version: 1,
		id: 'ZZ' as string,
		name: 'Testland',
		last_checked: '2026-11-01',
		summary: 'A test state.',
		laws: [
			{
				id: 'repair-act',
				title: 'Wheelchair Repair Act',
				bill: 'HB 1 (2025)',
				citation: 'T.S. § 1-100',
				status: 'in_force',
				effective: '2025-01-01',
				url: 'https://example.org/law',
				summary: 'Sets repair deadlines.',
				applies_to: ['supplier']
			},
			{
				id: 'future-act',
				title: 'Future Act',
				bill: 'HB 2 (2026)',
				citation: 'T.S. § 1-200',
				status: 'enacted',
				effective: '2027-07-01',
				url: 'https://example.org/future',
				summary: 'Not yet.',
				applies_to: ['insurer']
			}
		],
		deadlines: [
			{
				id: 'assess',
				law: 'repair-act',
				title: 'Supplier assesses the chair',
				who: 'supplier',
				description: 'Within 3 business days of the report.',
				starts: { events: ['reported'], when: 'first', label: 'you reported the problem' },
				period: { days: 3, count: 'business' },
				met_by: ['visit'],
				met_label: 'a technician visit',
				recipients: ['supplier', 'agency'],
				letter:
					'Under {{law_citation}}, a technician had to assess my chair within {{period_text}} of {{start_label}} on {{start_date}}, by {{due_date}}.{{#if status == "missed"}} That deadline passed {{days_late}} ago.{{/if}}'
			},
			{
				id: 'repair',
				law: 'repair-act',
				title: 'Repair finished',
				who: 'supplier',
				description: 'Within 10 days after approval.',
				starts: {
					events: ['auth_approved', 'parts_arrived'],
					when: 'latest',
					label: 'approval and parts'
				},
				period: { days: 10, count: 'calendar' },
				met_by: ['repaired'],
				met_label: 'the repair',
				recipients: ['supplier', 'insurer', 'agency'],
				letter: 'The repair was due by {{due_date}} ({{law_title}}).'
			},
			{
				id: 'medicaid-only',
				law: 'future-act',
				title: 'Insurer decides',
				who: 'insurer',
				description: 'Decide quickly.',
				starts: { events: ['auth_requested'], when: 'first', label: 'the request' },
				period: { days: 5, count: 'calendar' },
				met_by: ['auth_approved', 'auth_denied'],
				met_label: 'a decision',
				applies_if: { payers: ['medicaid'] },
				recipients: ['insurer'],
				letter: 'Decide by {{due_date}}.'
			}
		],
		protections: [
			{
				id: 'parts',
				law: 'repair-act',
				title: 'Parts available',
				description: 'Manufacturers must sell parts.',
				recipients: ['supplier'],
				letter: '{{law_title}} ({{law_citation}}) requires parts to be available.'
			},
			{
				id: 'future',
				law: 'future-act',
				title: 'Future protection',
				description: 'Not in force yet.',
				recipients: ['supplier'],
				letter: 'Should not appear.'
			}
		],
		agencies: [
			{
				id: 'ag',
				name: 'Attorney General',
				handles: 'Consumer complaints.',
				url: 'https://example.org/complain',
				address: '1 Capitol\nTown, ZZ 00000'
			},
			{
				id: 'medicare-only',
				name: 'Medicare office',
				handles: 'Medicare.',
				url: 'https://example.org/medicare',
				applies_if: { payers: ['medicare'] }
			}
		],
		holidays: { extends: [], add: [], remove: [] },
		sources: [],
		holidayRules: HOLIDAYS,
		...overrides
	};
}
