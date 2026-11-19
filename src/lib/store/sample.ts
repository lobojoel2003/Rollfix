/**
 * Sample data for trying Rollfix out (and for screenshots and tests). The people and the
 * supplier are made up; dates are relative to today so the counter always reads "Day 23".
 * The story follows a Connecticut Medicaid repair, so the state's deadlines show up.
 */
import { addDays, type ISODate } from '../engine/civil-date.ts';
import type { Entry, Profile, Repair } from '../engine/model.ts';

export const SAMPLE_PREFIX = 'sample-';

export function sampleData(today: ISODate): { profile: Profile; repairs: Repair[] } {
	const day = (n: number) => addDays(today, n - 23);
	const now = new Date().toISOString();
	const entry = (n: number, id: string, rest: Omit<Entry, 'id' | 'date'>): Entry => ({
		id: `${SAMPLE_PREFIX}${id}`,
		date: day(n),
		...rest
	});

	const current: Repair = {
		id: `${SAMPLE_PREFIX}current`,
		created: now,
		updated: now,
		state: 'CT',
		brokeOn: day(1),
		severity: 'stranded',
		problem: 'motor',
		details: 'The chair stops after a few feet and the joystick flashes an error.',
		chair: { make: 'Permobil', model: 'M3 Corpus', serial: 'SAMPLE-4471' },
		supplier: {
			name: 'Northstar Mobility',
			phone: '(860) 555-0142',
			email: 'service@northstar.example',
			address: 'Service Department\n200 Main Street\nHartford, CT 06103',
			account: 'NM-208841'
		},
		payer: {
			kind: 'medicaid',
			name: 'HUSKY Health (Connecticut Medicaid)',
			phone: '(800) 555-0199',
			email: '',
			address: 'Member Services\nP.O. Box 0000\nHartford, CT 06104',
			memberId: 'SAMPLE-90210',
			claim: ''
		},
		entries: [
			entry(1, 'reported', {
				kind: 'reported',
				party: 'supplier',
				person: 'Front desk',
				time: '09:20',
				note: 'Called the service line. The chair will not drive more than a few feet. They opened a work order.',
				reference: 'WO-48213',
				promise: { text: 'a technician will call to book a visit', due: day(3), outcome: 'broken' }
			}),
			entry(4, 'call-1', {
				kind: 'call',
				party: 'supplier',
				person: 'Dana',
				time: '14:05',
				note: 'Nobody had called me back. Dana said the technician schedule is full this week.',
				promise: { text: 'a technician visit', due: day(8), outcome: 'kept' }
			}),
			entry(5, 'impact-1', {
				kind: 'impact',
				party: 'me',
				note: 'Missed my physical therapy appointment because I could not get out of bed.'
			}),
			entry(8, 'visit', {
				kind: 'visit',
				party: 'supplier',
				person: 'Technician (Sam)',
				time: '11:30',
				note: 'Sam said the right drive motor is failing and has to be replaced.'
			}),
			entry(9, 'call-wait', {
				kind: 'call',
				party: 'supplier',
				person: 'Dana',
				note: 'Asked when the motor will be ordered. Dana said they are waiting for Medicaid to approve it.'
			}),
			entry(14, 'insurer-call', {
				kind: 'call',
				party: 'insurer',
				person: 'Member services',
				note: 'HUSKY says no prior authorization is needed to repair my chair, and no request is on file.'
			}),
			entry(15, 'call-2', {
				kind: 'call',
				party: 'supplier',
				person: 'Dana',
				note: 'Told Dana that HUSKY says no approval is needed. She said she would order the motor.',
				promise: { text: 'order the motor', due: day(17), outcome: 'broken' }
			}),
			entry(20, 'parts', {
				kind: 'parts_ordered',
				party: 'supplier',
				note: 'Northstar says the motor was ordered today. Expected in 5 to 7 business days.',
				reference: 'PO-77120'
			}),
			entry(20, 'impact-2', {
				kind: 'impact',
				party: 'me',
				note: 'Stayed in bed all day. A pressure sore is starting on my left hip.'
			}),
			entry(22, 'email', {
				kind: 'message',
				party: 'supplier',
				person: 'Service manager',
				note: 'Emailed the service manager asking for a repair date and a loaner chair. No reply yet.'
			})
		]
	};

	const past: Repair = {
		id: `${SAMPLE_PREFIX}batteries`,
		created: now,
		updated: now,
		state: 'CT',
		brokeOn: addDays(today, -160),
		fixedOn: addDays(today, -129),
		severity: 'limited',
		problem: 'batteries',
		details: 'Batteries would not hold a charge for more than an hour.',
		chair: { ...current.chair },
		supplier: { ...current.supplier },
		payer: { ...current.payer },
		entries: [
			{
				id: `${SAMPLE_PREFIX}b-reported`,
				date: addDays(today, -159),
				kind: 'reported',
				party: 'supplier',
				note: 'Reported that the batteries die within an hour.'
			},
			{
				id: `${SAMPLE_PREFIX}b-fixed`,
				date: addDays(today, -129),
				kind: 'repaired',
				party: 'supplier',
				note: 'New batteries installed.'
			}
		]
	};

	return {
		profile: {
			name: 'Alex Rivera',
			address: '12 Elm Street, Apt 3\nHartford, CT 06106',
			phone: '(860) 555-0101',
			email: 'alex@example.com',
			state: 'CT'
		},
		repairs: [current, past]
	};
}
