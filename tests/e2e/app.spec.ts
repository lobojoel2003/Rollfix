import { expect, test } from '@playwright/test';
import { loadSample, setup } from './helpers.ts';

test.describe('starting a repair log', () => {
	test('welcome page explains the app and nothing leaves the device', async ({ page }) => {
		const external = await setup(page);
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			'When your chair breaks, keep the record.'
		);
		await expect(page.getByTestId('build-info')).toContainText(/Rollfix \d+\.\d+\.\d+ · build/);
		expect(external).toEqual([]);
	});

	test('validates the form and starts the count', async ({ page }) => {
		await setup(page);
		await page.goto('/repair/new/');
		await page.getByRole('button', { name: 'Start the log' }).click();
		const summary = page.getByRole('group', { name: /thing to fix/ });
		await expect(summary).toBeFocused();
		await summary.getByRole('link', { name: 'Enter the date your chair stopped working.' }).click();
		await expect(page.getByLabel('Date your chair stopped working')).toBeFocused();

		await page.getByLabel('Date your chair stopped working').fill('2026-11-10');
		await page.getByLabel('It runs, but it is not safe to use').check();
		await page.getByLabel('Batteries').check();
		await page.getByLabel('Date you first reported it to the supplier').fill('2026-11-11');
		await page.getByLabel('State where you live').selectOption('CT');
		await page.getByLabel('Company name').fill('Northstar Mobility');
		await page.getByLabel('Who pays for repairs?').selectOption('medicaid');
		await page.getByRole('button', { name: 'Start the log' }).click();

		await expect(page.getByRole('status')).toContainText('Repair log started.');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			/Day\s*10\s*without your chair/
		);
		await expect(page.getByTestId('day-counter').getByRole('heading')).toBeFocused();
		await expect(page.getByTestId('timeline').getByRole('listitem')).toHaveCount(2);
		await expect(page).toHaveTitle('Day 10 without your chair · Rollfix');

		// The log survives a reload: it is stored on the device.
		await page.reload();
		await expect(page.getByTestId('day-number')).toHaveText('10');
	});
});

test.describe('the timeline', () => {
	test('adds an entry with a promise, then marks it broken', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		await expect(page.getByTestId('missed-promises')).toHaveText('2 promises not kept');

		await page
			.getByRole('navigation', { name: 'Quick add' })
			.getByRole('link', { name: 'Phone call' })
			.click();
		await expect(page.getByRole('radio', { name: /^Phone call/ })).toBeChecked();
		await page.getByLabel('Name of the person').fill('Dana');
		await page.getByLabel('What was said').fill('They said the motor ships Monday.');
		await page.getByLabel('They promised to do something by a date').check();
		await page.getByLabel('What did they promise?').fill('the motor will ship');
		await page.getByLabel('By what date?').fill('2026-11-23');
		await page.getByRole('button', { name: 'Save to timeline' }).click();

		await expect(page.getByRole('status')).toContainText('Saved: Phone call, November 19, 2026.');
		const item = page.getByTestId('timeline').getByRole('listitem').last();
		await expect(item).toBeFocused();
		await expect(item).toContainText('Day 23');
		await expect(item).toContainText('Dana at Northstar Mobility');
		await expect(item).toContainText('Not due yet');

		// A promise can be marked as broken straight from the timeline.
		await item.getByRole('button', { name: /It didn.t happen/ }).click();
		await expect(item).toContainText('Broken');
		await expect(page.getByTestId('missed-promises')).toHaveText('3 promises not kept');
	});

	test('edits and deletes an entry', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		const visit = page
			.getByTestId('timeline')
			.getByRole('listitem')
			.filter({ has: page.getByRole('heading', { name: /^Technician visit/ }) });
		await visit.getByRole('link', { name: /^Edit/ }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit timeline entry');
		await page
			.getByLabel('What the technician found or did')
			.fill('Motor replaced? No, only diagnosed.');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByTestId('timeline')).toContainText('only diagnosed');

		await page
			.getByTestId('timeline')
			.getByRole('listitem')
			.filter({ hasText: 'only diagnosed' })
			.getByRole('link', { name: /^Edit/ })
			.click();
		await page.getByRole('button', { name: 'Delete entry' }).click();
		await page.getByRole('button', { name: 'Yes, delete it' }).click();
		await expect(page.getByRole('status')).toContainText('Entry deleted.');
		await expect(page.getByTestId('timeline')).not.toContainText('only diagnosed');
	});

	test('marks the chair fixed and reopens it', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		await page.getByLabel('Date it was fixed').fill('2026-11-19');
		await page.getByRole('button', { name: 'Mark as fixed' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your chair is working/);
		await page
			.getByRole('link', { name: /22\s*days/ })
			.first()
			.click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Fixed after\s*22\s*days/);
		await page.getByRole('button', { name: 'Reopen this repair' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Day\s*23/);
	});

	test('downloads the timeline as a PDF', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download timeline (PDF)' }).click();
		const file = await download;
		expect(file.suggestedFilename()).toMatch(/^repair-timeline-2026-10-28\.pdf$/);
	});
});

test.describe('letters', () => {
	test('turns the timeline into a letter to the supplier', async ({ page }) => {
		const external = await setup(page);
		await loadSample(page);
		await page.getByRole('link', { name: 'Write a letter' }).click();
		const preview = page.getByTestId('letter-preview');
		await expect(preview).toContainText('Dear Northstar Mobility service team,');
		await expect(preview).toContainText('Re: Repair of my power wheelchair: day 23 without it');
		await expect(preview).toContainText('November 19, 2026');
		await expect(preview).toContainText('I was given dates that were not met');
		await expect(preview).toContainText('Repair timeline (11 entries)');
		await expect(page.getByTestId('missing-values')).toHaveCount(0);

		// Options change the letter straight away.
		await expect(preview).toContainText('Provide a loaner chair');
		await page.getByLabel('Ask for a loaner chair until it is fixed').uncheck();
		await expect(preview).not.toContainText('Provide a loaner chair');
		await page.getByLabel('How has this affected you?').fill('I have missed two weeks of work');
		await expect(preview).toContainText('I have missed two weeks of work.');

		const download = page.waitForEvent('download');
		await page.getByTestId('download-pdf').click();
		expect((await download).suggestedFilename()).toBe('rollfix-letter-supplier-2026-11-19.pdf');
		await expect(page.getByRole('status').filter({ hasText: 'downloaded as a PDF' })).toBeVisible();

		await page.getByRole('button', { name: 'I sent it: add it to my timeline' }).click();
		await page.getByRole('link', { name: 'My repair' }).click();
		await expect(page.getByTestId('timeline')).toContainText('Sent a letter to Northstar Mobility');
		expect(external).toEqual([]);
	});

	test('writes to the insurer and to a state office', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		await page.goto('/letters/?to=insurer');
		const preview = page.getByTestId('letter-preview');
		await expect(preview).toContainText('Dear HUSKY Health (Connecticut Medicaid),');
		await expect(preview).toContainText('Member ID: SAMPLE-90210');

		await page.getByRole('radio', { name: /^The state/ }).check();
		// Connecticut's office is listed, with a field for its mailing address.
		await expect(
			page.getByRole('radio', { name: /^Office of the Healthcare Advocate/ })
		).toBeChecked();
		await expect(preview).toContainText('Dear Office of the Healthcare Advocate:');
		await page
			.getByLabel('Mailing address for Office of the Healthcare Advocate')
			.fill('P.O. Box 1\nHartford, CT');
		await expect(page.getByTestId('missing-values')).toHaveCount(0);
		await page.getByLabel('Another office').check();
		await page.getByLabel('Office name').fill('Office of the Healthcare Advocate');
		await expect(preview).toContainText('Dear Office of the Healthcare Advocate:');
		await expect(page.getByTestId('missing-values')).toContainText('Mailing address');
	});

	test('asks for missing details', async ({ page }) => {
		await setup(page);
		await page.goto('/repair/new/');
		await page.getByLabel('Date your chair stopped working').fill('2026-11-17');
		await page.getByRole('button', { name: 'Start the log' }).click();
		await page.getByRole('link', { name: 'Write a letter' }).click();
		await expect(page.getByTestId('missing-values')).toContainText('Your name');
		await page.getByLabel('Your name', { exact: true }).fill('Jordan Lee');
		await page.getByRole('button', { name: 'Save my details for next time' }).click();
		await expect(page.getByTestId('letter-preview')).toContainText('Jordan Lee');
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page.getByLabel('Your name')).toHaveValue('Jordan Lee');
	});
});

test.describe('state rules', () => {
	test('checks Connecticut deadlines against the timeline and cites them', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		await expect(page.getByTestId('missed-deadlines')).toHaveText('1 state deadline missed');
		const panel = page.getByTestId('rules-panel');
		await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Connecticut rules');
		const timely = panel
			.getByRole('listitem')
			.filter({ hasText: 'Repair within 10 business days' });
		await expect(timely).toHaveAttribute('data-status', 'missed');
		await expect(timely).toContainText('It was due by November 12, 2026. It is 7 days overdue.');
		await expect(
			panel.getByRole('listitem').filter({ hasText: 'Order parts within 3 business days' })
		).toHaveAttribute('data-status', 'met_late');

		await page.getByRole('link', { name: 'Write a letter' }).click();
		const preview = page.getByTestId('letter-preview');
		await expect(preview).toContainText('(Conn. Gen. Stat. §§ 42-337 and 42-338)');
		await expect(preview).toContainText('The repair is 7 days late.');
		await expect(preview).toContainText('(Conn. Gen. Stat. § 17b-278i(b))');
	});

	test('pauses the clock while waiting for approval', async ({ page }) => {
		await setup(page);
		await page.goto('/repair/new/');
		await page.getByLabel('Date your chair stopped working').fill('2026-11-09');
		await page.getByLabel('Date you first reported it to the supplier').fill('2026-11-09');
		await page.getByLabel('State where you live').selectOption('CT');
		await page.getByRole('button', { name: 'Start the log' }).click();
		await page.getByRole('link', { name: 'Add to timeline' }).click();
		await page.getByRole('radio', { name: /^Sent to insurance for approval/ }).check();
		await page.getByLabel('Date', { exact: true }).fill('2026-11-13');
		await page.getByRole('button', { name: 'Save to timeline' }).click();
		const timely = page
			.getByTestId('rules-panel')
			.getByRole('listitem')
			.filter({ hasText: 'Repair within 10 business days' });
		await expect(timely).toHaveAttribute('data-status', 'paused');
		// Nov 10, 12 (Nov 11 is Veterans Day) before the wait began on Nov 13.
		await expect(timely).toContainText('after 2 business days of 10 business days');
	});

	test('lists every state, with full pages for states that have a law', async ({ page }) => {
		await setup(page);
		await page.goto('/rules/');
		const profiles = page
			.getByRole('region', { name: 'States with wheelchair repair laws' })
			.getByRole('listitem');
		await expect(profiles).toHaveCount(8);
		await expect(profiles.filter({ hasText: 'Connecticut' })).toContainText(
			'Repair deadlines in force'
		);

		await page.getByLabel('Find your state').selectOption('OR');
		await page.getByRole('button', { name: 'Show the rules' }).click();
		await expect(page).toHaveURL(/\/rules\/or\/$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Oregon');
		await expect(page.getByText('Decide on prior authorization within 72 hours')).toBeVisible();

		await page.goto('/rules/ct/');
		await expect(page.getByTestId('last-checked')).toContainText('2026');
		await expect(
			page.getByRole('link', { name: /Read the law.*Public Act 24-58/ })
		).toHaveAttribute('href', 'https://www.cga.ct.gov/CURRENT/PUB/chap_743q.htm');
		await expect(
			page.getByRole('heading', { name: 'Repair within 10 business days' })
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: 'Office of the Healthcare Advocate' })
		).toBeVisible();

		await page.goto('/rules/tx/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Texas');
		await expect(page.getByRole('link', { name: 'Find your attorney general' })).toBeVisible();

		await page.goto('/rules/medicare/');
		await expect(page.getByText('42 C.F.R. § 424.57(c)').first()).toBeVisible();
	});
});

test.describe('settings and backups', () => {
	test('backs up, deletes and restores the log', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		await page.getByRole('link', { name: 'Settings' }).click();

		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Download a backup' }).click();
		const file = await download;
		expect(file.suggestedFilename()).toBe('rollfix-backup-2026-11-19.json');
		const path = await file.path();

		await page.getByRole('button', { name: 'Delete everything' }).click();
		await page.getByRole('button', { name: 'Yes, delete everything' }).click();
		await expect(page.getByText('Everything was deleted from this device.')).toBeVisible();
		await page.getByRole('link', { name: 'My repair' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			'When your chair breaks, keep the record.'
		);

		await page.getByRole('link', { name: 'Settings' }).click();
		await page.getByLabel('Restore from a backup file').setInputFiles(path);
		await page.getByRole('button', { name: 'Add to my log' }).click();
		await expect(page.getByText('Imported 2 repairs.')).toBeVisible();
		await expect(page.getByLabel('Your name')).toHaveValue('Alex Rivera');
		await page.getByRole('link', { name: 'My repair' }).click();
		await expect(page.getByTestId('day-number')).toHaveText('23');
	});

	test('rejects files that are not backups', async ({ page }) => {
		await setup(page);
		await page.goto('/settings/');
		await page.getByLabel('Restore from a backup file').setInputFiles({
			name: 'photo.json',
			mimeType: 'application/json',
			buffer: Buffer.from('{"hello": "world"}')
		});
		await expect(page.getByRole('alert')).toHaveText('This file is not a Rollfix backup.');
	});

	test('makes the text larger', async ({ page }) => {
		await setup(page);
		await page.goto('/settings/');
		await page.getByLabel('Extra large').check();
		await expect(page.locator('html')).toHaveAttribute('data-text-size', 'x-large');
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-text-size', 'x-large');
	});
});

test.describe('the app shell', () => {
	test('works offline once it has loaded', async ({ page, context, browserName }) => {
		test.skip(browserName !== 'chromium', 'Service workers are tested in Chromium');
		await setup(page);
		await loadSample(page);
		await page.evaluate(async () => {
			await navigator.serviceWorker.ready;
		});
		await context.setOffline(true);
		await page.goto('/letters/');
		await expect(page.getByTestId('letter-preview')).toContainText('Northstar Mobility');
		await page.goto('/repair/?id=sample-batteries');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Fixed after\s*31\s*days/);
		await context.setOffline(false);
	});

	test('publishes build info and a manifest', async ({ request }) => {
		const info = await (await request.get('/build-info.json')).json();
		expect(info).toMatchObject({
			name: 'rollfix',
			version: expect.stringMatching(/^\d+\.\d+\.\d+/)
		});
		const manifest = await (await request.get('/manifest.webmanifest')).json();
		expect(manifest.icons.length).toBeGreaterThan(2);
	});

	test('unknown pages show a friendly 404', async ({ page }) => {
		const response = await page.goto('/no-such-page/');
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
	});
});
