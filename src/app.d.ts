// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** Build metadata injected by Vite at build time (see vite.config.ts). */
	const __ROLLFIX_BUILD__: {
		version: string;
		buildNumber: string;
		commit: string;
		date: string;
	};

	/** Address of the anonymous stats API, or "" when this build isn't connected to one. */
	const __ROLLFIX_STATS_API__: string;
}

declare module 'virtual:rollfix/content' {
	import type { Content } from '#lib/content/loader.ts';
	export const content: Content;
	export default content;
}

export {};
