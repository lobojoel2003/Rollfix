/** Links to every page. All pages use a trailing slash (they're static index.html files). */
import { resolve } from '$app/paths';
import type { Recipient } from './engine/schema.ts';

const slash = (path: string) => (path.endsWith('/') ? path : `${path}/`);

function withQuery(path: string, query: Record<string, string | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
	const search = params.toString();
	return search ? `${slash(path)}?${search}` : slash(path);
}

export const paths = {
	home: () => slash(resolve('/')),
	newRepair: () => slash(resolve('/repair/new')),
	editRepair: (id: string) => withQuery(resolve('/repair/edit'), { id }),
	repair: (id: string) => withQuery(resolve('/repair'), { id }),
	entry: (repair: string, options: { entry?: string; kind?: string } = {}) =>
		withQuery(resolve('/entry'), { repair, ...options }),
	letters: (repair?: string, to?: Recipient) => withQuery(resolve('/letters'), { repair, to }),
	rules: () => slash(resolve('/rules')),
	state: (code: string) => slash(resolve('/rules/[state]', { state: code.toLowerCase() })),
	share: () => slash(resolve('/share')),
	data: () => slash(resolve('/data')),
	settings: () => slash(resolve('/settings')),
	about: () => slash(resolve('/about'))
};

export const REPOSITORY = 'https://github.com/lobojoel2003/Rollfix';
export const RULES_GUIDE = `${REPOSITORY}/blob/main/rules/README.md`;
export const ISSUES = `${REPOSITORY}/issues`;
