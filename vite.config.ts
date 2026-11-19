/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { rollfixContent } from './src/lib/content/vite-plugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
	version: string;
};

function git(command: string): string | undefined {
	try {
		return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return undefined;
	}
}

/** Build metadata baked into the bundle and shown in the footer and /build-info.json. */
const build = {
	version: pkg.version,
	// The build number is the number of commits, so the same commit always gets the same number.
	buildNumber: process.env.BUILD_NUMBER ?? git('rev-list --count HEAD') ?? 'dev',
	commit: process.env.GITHUB_SHA?.slice(0, 7) ?? git('rev-parse --short HEAD') ?? 'unknown',
	date: (process.env.SOURCE_DATE_EPOCH
		? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000)
		: new Date()
	)
		.toISOString()
		.slice(0, 10)
};

/** Set BASE_PATH=/Rollfix when deploying to a GitHub Pages project site. */
const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '') as '' | `/${string}`;

/**
 * Optional address of the anonymous stats API (see api/). When it is empty, sharing and the
 * public dashboard explain that this copy of Rollfix isn't connected to one.
 */
const statsApi = (process.env.PUBLIC_STATS_API ?? '').replace(/\/$/, '');
const statsOrigin = statsApi
	? (new URL(statsApi).origin as `${string}://${string}.${string}`)
	: undefined;

export default defineConfig({
	plugins: [
		rollfixContent(import.meta.dirname),
		sveltekit({
			adapter: adapter({ fallback: '404.html', strict: true }),
			paths: { base, relative: true },
			version: { name: `${build.version}+${build.buildNumber}` },
			prerender: { handleHttpError: 'fail', handleMissingId: 'fail' },
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					'connect-src': statsOrigin ? ['self', statsOrigin] : ['self'],
					'worker-src': ['self'],
					'manifest-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			}
		})
	],
	define: {
		__ROLLFIX_BUILD__: JSON.stringify(build),
		__ROLLFIX_STATS_API__: JSON.stringify(statsApi)
	},
	server: { fs: { allow: ['rules', 'letters'] } },
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			include: [
				'src/lib/engine/**',
				'src/lib/pdf/**',
				'src/lib/content/loader.ts',
				'src/lib/store/backup.ts',
				'src/lib/stats/**'
			],
			reporter: ['text', 'html', 'lcov'],
			thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 }
		}
	}
});
