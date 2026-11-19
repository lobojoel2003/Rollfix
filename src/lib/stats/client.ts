/**
 * Talking to the optional stats API (api/ in this repository). Only used when the person
 * presses "Share" or opens the public dashboard; the rest of Rollfix never makes requests.
 */
import type { StatsReport } from './payload.ts';

export const STATS_API: string = __ROLLFIX_STATS_API__;

export class StatsError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = 'StatsError';
	}
}

export interface Receipt {
	id: string;
	token: string;
}

export interface Group {
	key: string;
	reports: number;
	median_days: number;
	p90_days: number;
	resolved: number;
}

export interface Bucket {
	label: string;
	min: number;
	max: number | null;
	reports: number;
}

export interface Stats {
	generated_at: string;
	min_group_size: number;
	overall: {
		reports: number;
		resolved: number;
		ongoing: number;
		median_days: number | null;
		p75_days: number | null;
		p90_days: number | null;
		over_30_days: number;
		median_days_to_first_visit: number | null;
		median_days_waiting_approval: number | null;
		median_days_waiting_parts: number | null;
		promises_broken: number;
		state_deadline_missed: number;
		state_deadline_checked: number;
	};
	histogram: Bucket[];
	by_state: Group[];
	by_payer: Group[];
	by_supplier: Group[];
	by_problem: Group[];
	by_month: Group[];
	suppressed_groups: number;
}

async function call<T>(path: string, init: RequestInit = {}, base = STATS_API): Promise<T> {
	if (!base) throw new StatsError('This copy of Rollfix is not connected to a stats server.');
	let response: Response;
	try {
		response = await fetch(`${base}${path}`, {
			...init,
			headers: { accept: 'application/json', ...init.headers },
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
			cache: 'no-store'
		});
	} catch {
		throw new StatsError('Could not reach the stats server. Check your connection and try again.');
	}
	if (response.status === 204) return undefined as T;
	if (!response.ok) {
		let detail = '';
		try {
			const body = (await response.json()) as { detail?: unknown };
			if (typeof body.detail === 'string') detail = body.detail;
		} catch {
			// not JSON
		}
		throw new StatsError(
			response.status === 429
				? 'Too many requests. Please wait a minute and try again.'
				: detail || `The stats server answered with an error (${response.status}).`,
			response.status
		);
	}
	return (await response.json()) as T;
}

export function submitReport(report: StatsReport, base?: string): Promise<Receipt> {
	return call<Receipt>(
		'/v1/reports',
		{
			method: 'POST',
			body: JSON.stringify(report),
			headers: { 'content-type': 'application/json' }
		},
		base
	);
}

export function updateReport(receipt: Receipt, report: StatsReport, base?: string): Promise<void> {
	return call<void>(
		`/v1/reports/${encodeURIComponent(receipt.id)}`,
		{
			method: 'PUT',
			body: JSON.stringify(report),
			headers: { 'content-type': 'application/json', authorization: `Bearer ${receipt.token}` }
		},
		base
	);
}

export function deleteReport(receipt: Receipt, base?: string): Promise<void> {
	return call<void>(
		`/v1/reports/${encodeURIComponent(receipt.id)}`,
		{ method: 'DELETE', headers: { authorization: `Bearer ${receipt.token}` } },
		base
	);
}

export function fetchStats(base?: string): Promise<Stats> {
	return call<Stats>('/v1/stats', {}, base);
}
