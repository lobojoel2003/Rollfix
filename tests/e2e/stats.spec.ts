import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectAccessible, setup } from './helpers.ts';

/**
 * Sharing and the public dashboard, against the real stats API (api/). The e2e build points
 * at it with PUBLIC_STATS_API; without it these tests are skipped.
 */
let api: string | null = null;

test.beforeAll(async ({ request }) => {
	api = ((await (await request.get('/build-info.json')).json()) as { statsApi: string | null })
		.statsApi;
});

test.beforeEach(() => {
	test.skip(!api, 'This build is not connected to a stats API');
});

function report(days: number) {
	return {
		schema: 1,
		state: 'CT',
		payer: 'medicaid',
		supplier: 'numotion',
		problem: 'motor',
		severity: 'stranded',
		broke_month: '2026-10',
		resolved: days < 30,
		days_without_chair: days,
		days_to_first_visit: 5,
		days_waiting_approval: 12,
		days_waiting_parts: null,
		promises_made: 2,
		promises_broken: 1,
		had_loaner: false,
		state_deadline_missed: true
	};
}

async function seed(request: APIRequestContext) {
	for (const days of [8, 21, 35, 49, 63, 120]) {
		const response = await request.post(`${api}/v1/reports`, { data: report(days) });
		expect(response.status()).toBe(201);
	}
}

test('shares, updates and removes anonymous numbers', async ({ page }) => {
	await setup(page, [api!]);
	await page.goto('/repair/new/');
	await page.getByLabel('Date your chair stopped working').fill('2026-11-01');
	await page.getByLabel('State where you live').selectOption('CT');
	await page.getByLabel('Company name').fill('Numotion');
	await page.getByLabel('Who pays for repairs?').selectOption('medicaid');
	await page.getByRole('button', { name: 'Start the log' }).click();
	await expect(page.getByTestId('day-number')).toHaveText('19');

	await page.goto('/share/');
	const card = page.getByTestId('share-card');
	const preview = card.getByTestId('share-preview');
	await expect(preview).toContainText('Connecticut');
	await expect(preview).toContainText('Numotion');
	await expect(preview).toContainText('18 days');
	await expect(preview).not.toContainText('Alex');

	const share = card.getByTestId('share-button');
	await expect(share).toBeDisabled();
	await card.getByLabel(/I want to share these numbers anonymously/).check();
	await share.click();
	await expect(card.getByRole('status')).toHaveText(
		'Thank you. Your numbers were shared anonymously.'
	);
	await expect(card).toContainText('Shared on November 19, 2026.');

	// Fixing the chair changes the numbers; they can be updated with the saved receipt.
	await page.goto('/');
	await page.getByLabel('Date it was fixed').fill('2026-11-19');
	await page.getByRole('button', { name: 'Mark as fixed' }).click();
	await page.goto('/share/');
	await card.getByRole('button', { name: 'Update my shared numbers' }).click();
	await expect(card.getByRole('status')).toHaveText('Your shared numbers were updated.');

	await card.getByRole('button', { name: 'Remove my numbers' }).click();
	await expect(card.getByRole('status')).toHaveText(
		'Your numbers were removed from the stats server.'
	);
	await expect(card.getByTestId('share-button')).toBeVisible();
	await expectAccessible(page);
});

test('the public dashboard shows the numbers with tables behind every chart', async ({
	page,
	request
}) => {
	await seed(request);
	await setup(page, [api!]);
	await page.goto('/data/');
	await expect(page.getByTestId('median-days')).toHaveText(/^\d+$/);
	await expect(
		page.getByRole('img', { name: /Column chart of repairs by days without the chair/ })
	).toBeVisible();
	await page.getByText('Show as a table').click();
	await expect(
		page.getByRole('table', { name: 'Repairs by days without the chair' })
	).toBeVisible();
	await expect(page.getByTestId('group-state')).toContainText('Connecticut');
	await expect(page.getByTestId('group-supplier')).toContainText('Numotion');

	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download the numbers (CSV)' }).click();
	expect((await download).suggestedFilename()).toMatch(
		/^rollfix-delay-data-\d{4}-\d{2}-\d{2}\.csv$/
	);
	await expectAccessible(page);
});
