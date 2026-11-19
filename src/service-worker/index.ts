/**
 * Makes Rollfix work offline and installable: every page and file of the app is cached when it
 * is installed, so the log can be opened in a basement, a hospital or a dead zone.
 *
 * Only the app's own files are handled. Requests to the optional stats API always go to the
 * network and are never cached.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `rollfix-${version}`;
const SCOPE = new URL(self.registration.scope);
const toUrl = (path: string) => new URL(path.replace(/^\//, ''), SCOPE).href;

const PRECACHE = [
	...immutable.map(({ path }) => path),
	...assets.map(({ path }) => path),
	...prerendered.map(({ path }) => path)
].map(toUrl);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(PRECACHE);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE && key.startsWith('rollfix-')) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

async function respond(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const cache = await caches.open(CACHE);

	// Built files never change for a given version: cache first.
	if (PRECACHE.includes(url.href) && !url.href.endsWith('/') && !url.pathname.endsWith('.html')) {
		const cached = await cache.match(url.href);
		if (cached) return cached;
	}

	// Pages: try the network for the newest version, fall back to the cached copy.
	try {
		const response = await fetch(request);
		if (response.ok && response.type === 'basic' && PRECACHE.includes(toUrl(url.pathname))) {
			void cache.put(toUrl(url.pathname), response.clone());
		}
		return response;
	} catch (error) {
		// Pages like /repair/?id=… are the same file for every id.
		const cached =
			(await cache.match(request, { ignoreSearch: true })) ??
			(request.mode === 'navigate' ? await cache.match(toUrl('/')) : undefined);
		if (cached) return cached;
		throw error;
	}
}

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== SCOPE.origin || !url.href.startsWith(SCOPE.href)) return;
	event.respondWith(respond(request));
});
