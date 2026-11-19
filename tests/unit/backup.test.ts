import { describe, expect, it } from 'vitest';
import {
	backupToJson,
	BackupError,
	cleanEntry,
	cleanProfile,
	cleanRepair,
	createBackup,
	mergeRepairs,
	parseBackup
} from '../../src/lib/store/backup.ts';
import { sampleData } from '../../src/lib/store/sample.ts';
import { repair } from './fixtures.ts';

describe('backups', () => {
	it('round-trips the sample data', () => {
		const { profile, repairs } = sampleData('2026-11-19');
		const json = backupToJson(createBackup(profile, repairs, new Date('2026-11-19T00:00:00Z')));
		const restored = parseBackup(json);
		expect(restored.exported).toBe('2026-11-19T00:00:00.000Z');
		expect(restored.profile).toEqual(profile);
		expect(restored.repairs).toEqual(repairs);
	});

	it('rejects files that are not Rollfix backups', () => {
		expect(() => parseBackup('not json')).toThrow(BackupError);
		expect(() => parseBackup('{"app":"other"}')).toThrow(/not a Rollfix backup/);
		expect(() => parseBackup('{"app":"rollfix","format":99}')).toThrow(/newer version/);
	});

	it('cleans everything it imports', () => {
		const backup = parseBackup(
			JSON.stringify({
				app: 'rollfix',
				format: 1,
				exported: 'yesterday',
				profile: { name: 'A', state: 'XX', extra: 1 },
				repairs: [
					{ brokeOn: 'not a date' },
					'nonsense',
					{
						id: '<script>',
						brokeOn: '2026-11-02',
						fixedOn: '2026-11-01',
						state: 'CT',
						severity: 'catastrophic',
						problem: 'motor',
						payer: { kind: 'medicare', memberId: 42 },
						entries: [
							{
								date: '2026-11-03',
								kind: 'call',
								party: 'supplier',
								note: 'x'.repeat(6000),
								time: '25:00'
							},
							{ date: 'bad', kind: 'call' },
							{
								id: 'ok',
								date: '2026-11-04',
								kind: 'teleport',
								party: 'aliens',
								time: '09:15',
								person: '  Dana ',
								reference: ' ',
								promise: { text: 'visit', due: '2026-11-05', outcome: 'maybe' }
							},
							{ date: '2026-11-04', kind: 'call', promise: { text: 'x', due: 'soon' } }
						],
						share: { id: 'abc', token: 'short' }
					}
				]
			})
		);
		expect(backup.exported).toBe('1970-01-01T00:00:00.000Z');
		expect(backup.profile).toEqual({ name: 'A', phone: '', email: '', address: '', state: '' });
		expect(backup.repairs).toHaveLength(1);
		const r = backup.repairs[0]!;
		expect(r.id).not.toBe('<script>');
		expect(r.severity).toBe('stranded');
		expect(r.fixedOn).toBeUndefined();
		expect(r.payer.memberId).toBe('');
		expect(r.share).toBeUndefined();
		expect(r.entries).toHaveLength(3);
		expect(r.entries[0]?.note).toHaveLength(5000);
		expect(r.entries[0]?.time).toBeUndefined();
		expect(r.entries[1]).toMatchObject({
			id: 'ok',
			kind: 'note',
			party: 'other',
			time: '09:15',
			person: 'Dana',
			promise: { outcome: 'open' }
		});
		expect(r.entries[1]?.reference).toBeUndefined();
		expect(r.entries[2]?.promise).toBeUndefined();
	});

	it('keeps a valid share receipt', () => {
		const cleaned = cleanRepair({
			...repair(),
			share: {
				id: 'abc-123',
				token: 'x'.repeat(43),
				sharedAt: '2026-11-19T00:00:00Z',
				payload: '{}'
			}
		});
		expect(cleaned?.share?.id).toBe('abc-123');
		expect(cleanEntry(null)).toBeNull();
		expect(cleanProfile(undefined).name).toBe('');
	});

	it('merges by id, keeping the newest version', () => {
		const old = repair({ id: 'a', updated: '2026-11-01T00:00:00Z', details: 'old' });
		const newer = repair({ id: 'a', updated: '2026-11-05T00:00:00Z', details: 'new' });
		const other = repair({ id: 'b' });
		expect(mergeRepairs([newer], [old]).map((r) => r.details)).toEqual(['new']);
		expect(mergeRepairs([old, other], [newer]).map((r) => [r.id, r.details])).toEqual([
			['a', 'new'],
			['b', '']
		]);
	});
});
