/**
 * Render the app icons (PNG) from static/favicon.svg. Run after changing the logo:
 *   npx tsx scripts/make-icons.ts
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../static/favicon.svg', import.meta.url), 'utf8');
const out = (name: string) => new URL(`../static/icons/${name}`, import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, maskable] of [
	['icon-192.png', 192, false],
	['icon-512.png', 512, false],
	['maskable-512.png', 512, true]
] as const) {
	await page.setViewportSize({ width: size, height: size });
	// Maskable icons need the logo inside the central 80% "safe zone" on a full-bleed background.
	const inner = maskable ? Math.round(size * 0.72) : size;
	const art = maskable ? svg.replace('rx="16"', 'rx="0"') : svg;
	await page.setContent(
		`<html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${maskable ? '#2a3b9c' : 'transparent'}"><div style="width:${inner}px;height:${inner}px">${art.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`
	);
	await page.screenshot({ path: out(name), omitBackground: !maskable });
	console.log(`wrote static/icons/${name}`);
}
await browser.close();
