import { error } from '@sveltejs/kit';
import { US_STATES } from '#lib/engine/states.ts';
import type { EntryGenerator, PageLoad } from './$types';

/** One page per state and D.C., even where there is no wheelchair-specific law yet. */
export const entries: EntryGenerator = () =>
	US_STATES.map((state) => ({ state: state.code.toLowerCase() }));

export const load: PageLoad = ({ params }) => {
	const state = US_STATES.find((item) => item.code.toLowerCase() === params.state);
	if (!state) error(404, 'Not found');
	return { code: state.code, name: state.name };
};
