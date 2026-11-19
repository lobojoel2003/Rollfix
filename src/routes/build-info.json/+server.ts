import { json } from '@sveltejs/kit';
import { content } from 'virtual:rollfix/content';

export const prerender = true;

/** Machine-readable build metadata: /build-info.json */
export function GET() {
	return json({
		name: 'rollfix',
		...__ROLLFIX_BUILD__,
		statsApi: __ROLLFIX_STATS_API__ || null,
		states: Object.values(content.states).map((state) => ({
			id: state.id,
			lastChecked: state.last_checked,
			laws: state.laws.length,
			deadlines: state.deadlines.length
		}))
	});
}
