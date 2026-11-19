/**
 * Take the README screenshots in docs/images/ from the built app, using the sample data.
 *
 *   PUBLIC_STATS_API=http://localhost:8000 npm run build   (with the API running, for the dashboard)
 *   npx tsx scripts/serve.ts build &
 *   npm run screenshots
 *
 * The dashboard shot seeds the local stats API with clearly fake demo numbers.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, devices, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const API = process.env.STATS_API ?? 'http://localhost:8000';
const OUT = new URL('../docs/images/', import.meta.url).pathname;
const TODAY = new Date('2026-11-19T12:00:00-05:00');
mkdirSync(OUT, { recursive: true });

async function sample(page: Page) {
	await page.clock.setFixedTime(TODAY);
	await page.goto(`${BASE}/`);
	await page.getByRole('button', { name: 'Try it with sample data' }).click();
	await page.getByTestId('day-number').waitFor();
	// Hide the "sample data loaded" message; keep the banner that says it's sample data.
	await page.getByRole('button', { name: 'Dismiss' }).click();
}

async function seedDemoStats() {
	const health = await fetch(`${API}/healthz`).catch(() => null);
	if (!health?.ok) return false;
	const stats = (await (await fetch(`${API}/v1/stats`)).json()) as { overall: { reports: number } };
	if (stats.overall.reports >= 40) return true;
	const states = ['CT', 'CT', 'CT', 'CO', 'NY', 'NY', 'MN', 'MA', 'TX', 'CA'];
	const payers = ['medicaid', 'medicare', 'dual', 'medicaid_managed_care', 'private'];
	const suppliers = ['numotion', 'nsm', 'independent', 'numotion', 'nsm'];
	const problems = ['batteries', 'motor', 'controller', 'seating', 'wheels'];
	let seed = 7;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < 64; i++) {
		const days = Math.round(4 + random() ** 1.6 * 120);
		const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]!;
		const state = pick(states);
		await fetch(`${API}/v1/reports`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				schema: 1,
				state,
				payer: pick(payers),
				supplier: pick(suppliers),
				problem: pick(problems),
				severity: random() > 0.3 ? 'stranded' : 'limited',
				broke_month: `2026-${String(1 + Math.floor(random() * 10)).padStart(2, '0')}`,
				resolved: random() > 0.35,
				days_without_chair: days,
				days_to_first_visit: Math.min(days, Math.round(2 + random() * 12)),
				days_waiting_approval: random() > 0.3 ? Math.round(random() * days * 0.5) : null,
				days_waiting_parts: random() > 0.5 ? Math.round(random() * days * 0.4) : null,
				promises_made: 3,
				promises_broken: Math.floor(random() * 4),
				had_loaner: random() > 0.8,
				state_deadline_missed: state === 'CT' ? random() > 0.3 : null
			})
		});
	}
	return true;
}

const browser = await chromium.launch();

// Desktop shots at 2x for sharp README images.
const desktop = await browser.newContext({
	viewport: { width: 1280, height: 860 },
	deviceScaleFactor: 2
});
const page = await desktop.newPage();
await sample(page);
await page.screenshot({ path: `${OUT}home.png` });
console.log('wrote docs/images/home.png');

await page.goto(`${BASE}/letters/`);
await page.getByTestId('letter-preview').waitFor();
await page.setViewportSize({ width: 1280, height: 1000 });
await page.screenshot({ path: `${OUT}letter.png` });
console.log('wrote docs/images/letter.png');

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/rules/ct/`);
await page.getByRole('heading', { level: 1 }).waitFor();
await page.screenshot({ path: `${OUT}rules.png` });
console.log('wrote docs/images/rules.png');

await page.goto(`${BASE}/entry/?repair=sample-current&kind=call`);
await page.getByRole('heading', { level: 1 }).waitFor();
await page.screenshot({ path: `${OUT}entry.png` });
console.log('wrote docs/images/entry.png');

if (await seedDemoStats()) {
	await page.goto(`${BASE}/data/`);
	await page.getByTestId('median-days').waitFor();
	await page.setViewportSize({ width: 1280, height: 1100 });
	await page.screenshot({ path: `${OUT}dashboard.png` });
	console.log('wrote docs/images/dashboard.png (demo data)');
} else {
	console.warn('Stats API not running: skipped docs/images/dashboard.png');
}
await desktop.close();

// Phone, at its native scale.
const phone = await browser.newContext({ ...devices['Pixel 7'] });
const mobile = await phone.newPage();
await sample(mobile);
await mobile.screenshot({ path: `${OUT}mobile.png` });
console.log('wrote docs/images/mobile.png');
await phone.close();

// Banner for the top of the README.
const banner = await browser.newPage({
	viewport: { width: 1280, height: 400 },
	deviceScaleFactor: 2
});
const logo = readFileSync(new URL('../static/favicon.svg', import.meta.url), 'utf8');
await banner.setContent(`<!doctype html><html><body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
<div style="height:400px;display:flex;align-items:center;gap:56px;padding:0 88px;background:linear-gradient(120deg,#1d2b7a,#2a3b9c 55%,#3f55c8);color:#fff">
  <div style="width:180px;height:180px;flex:none">${logo.replace('<svg', '<svg width="180" height="180"')}</div>
  <div>
    <div style="font-size:30px;font-weight:600;opacity:.85;letter-spacing:.01em">Rollfix</div>
    <div style="font-size:68px;font-weight:850;letter-spacing:-.035em;line-height:1;margin:8px 0 18px;white-space:nowrap">Day <span style="color:#ffc46b">23</span> without your chair.</div>
    <div style="font-size:28px;opacity:.92;max-width:900px;line-height:1.35">Log every call and promise. Know your state’s repair rules. Turn the timeline into a dated, firm letter.</div>
  </div>
</div></body></html>`);
await banner.screenshot({ path: `${OUT}banner.png` });
console.log('wrote docs/images/banner.png');

await browser.close();
