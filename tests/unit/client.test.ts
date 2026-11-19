import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	deleteReport,
	fetchStats,
	StatsError,
	submitReport,
	updateReport
} from '../../src/lib/stats/client.ts';
import type { StatsReport } from '../../src/lib/stats/payload.ts';

const BASE = 'https://stats.example';
const report = { schema: 1, state: 'CT' } as unknown as StatsReport;

function respond(status: number, body?: unknown) {
	const fetch = vi.fn(async () =>
		body === undefined
			? new Response(null, { status })
			: new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
	);
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('stats API client', () => {
	it('submits a report without cookies or referrer', async () => {
		const fetch = respond(201, { id: 'abc', token: 't' });
		await expect(submitReport(report, BASE)).resolves.toEqual({ id: 'abc', token: 't' });
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(`${BASE}/v1/reports`);
		expect(init).toMatchObject({
			method: 'POST',
			credentials: 'omit',
			referrerPolicy: 'no-referrer'
		});
		expect(JSON.parse(init.body as string)).toEqual(report);
	});

	it('updates and deletes with the token', async () => {
		const fetch = respond(204);
		await updateReport({ id: 'a b', token: 'secret' }, report, BASE);
		await deleteReport({ id: 'abc', token: 'secret' }, BASE);
		const calls = fetch.mock.calls as unknown as [string, RequestInit][];
		expect(calls[0]?.[0]).toBe(`${BASE}/v1/reports/a%20b`);
		expect(calls[0]?.[1].headers).toMatchObject({ authorization: 'Bearer secret' });
		expect(calls[1]?.[1].method).toBe('DELETE');
	});

	it('turns errors into messages people can act on', async () => {
		respond(429, { detail: 'slow down' });
		await expect(fetchStats(BASE)).rejects.toThrow(/wait a minute/);
		respond(422, { detail: 'Bad state' });
		await expect(fetchStats(BASE)).rejects.toThrow('Bad state');
		respond(500, 'not json');
		await expect(fetchStats(BASE)).rejects.toMatchObject({ status: 500 });
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new TypeError('offline')))
		);
		await expect(fetchStats(BASE)).rejects.toThrow(/Could not reach/);
	});

	it('refuses to call anything when no server is configured', async () => {
		await expect(fetchStats('')).rejects.toBeInstanceOf(StatsError);
	});
});
