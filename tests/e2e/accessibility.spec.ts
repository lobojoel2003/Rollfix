import { expect, test } from '@playwright/test';
import { arrowTo, expectAccessible, loadSample, setup, tabTo } from './helpers.ts';

const PAGES = [
	'/',
	'/repair/new/',
	'/repair/edit/?id=sample-current',
	'/repair/?id=sample-batteries',
	'/entry/?repair=sample-current',
	'/entry/?repair=sample-current&entry=sample-call-2',
	'/letters/',
	'/letters/?to=agency',
	'/rules/',
	'/rules/ct/',
	'/rules/tx/',
	'/rules/medicare/',
	'/share/',
	'/data/',
	'/settings/',
	'/about/'
];

test.describe('every page passes axe (WCAG 2.2 A and AA)', () => {
	test('the welcome page, before any data', async ({ page }) => {
		await setup(page);
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expectAccessible(page);
	});

	for (const path of PAGES) {
		test(path, async ({ page }) => {
			await setup(page, ['http://localhost:8000']);
			await loadSample(page);
			await page.goto(path);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await page.waitForLoadState('networkidle');
			await expectAccessible(page);
		});
	}

	test('in dark mode', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await setup(page);
		await loadSample(page);
		await expectAccessible(page);
		await page.goto('/letters/');
		await expectAccessible(page);
	});

	test('with errors showing', async ({ page }) => {
		await setup(page);
		await page.goto('/repair/new/');
		await page.getByRole('button', { name: 'Start the log' }).click();
		await expect(page.getByRole('group', { name: /thing to fix/ })).toBeFocused();
		await expectAccessible(page);
	});
});

test.describe('keyboard and switch access', () => {
	test.skip(({ isMobile }) => isMobile, 'Keyboard runs use the desktop layout');

	test('a whole repair can be logged and a letter written with the keyboard alone', async ({
		page
	}) => {
		await setup(page);
		await page.goto('/');

		// The first Tab stop is the skip link.
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();

		await tabTo(page, 'Start a repair log');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/repair\/new\/$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Start a repair log');

		await tabTo(page, /^Date your chair stopped working/);
		await page.keyboard.type('11152026');
		// Radio groups are one Tab stop; arrow keys choose within them.
		await tabTo(page, /^I can't use my chair at all/);
		await arrowTo(page, /^It works, but not fully/);
		await tabTo(page, /^Something else/);
		await arrowTo(page, /^Motor or gearbox/);
		await tabTo(page, /^State where you live/);
		await page.keyboard.type('Connecticut');
		await tabTo(page, /^Start the log/);
		await page.keyboard.press('Enter');

		// Focus lands on the counter after saving.
		const counter = page.getByTestId('day-counter').getByRole('heading');
		await expect(counter).toBeFocused();
		await expect(counter).toHaveText(/Day\s*5\s*waiting for your repair/);

		await tabTo(page, /^Add to timeline/);
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add to the timeline');
		await tabTo(page, /^Phone call/);
		await arrowTo(page, /^Nobody came/);
		await tabTo(page, /^What was supposed to happen/);
		await page.keyboard.type('Technician was booked for 9am and never arrived.');
		await tabTo(page, /^Save to timeline/);
		await page.keyboard.press('Enter');

		const entry = page.getByTestId('timeline').getByRole('listitem').last();
		await expect(entry).toBeFocused();
		await expect(entry).toContainText('Nobody came');

		await tabTo(page, /^Write a letter/);
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write a letter');
		await expect(page.getByTestId('letter-preview')).toContainText('day 5');
		await tabTo(page, /^Download PDF/);
		const download = page.waitForEvent('download');
		await page.keyboard.press('Enter');
		expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
	});

	test('focus is always visible', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('Tab');
			const outline = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement;
				// The calendar button inside a date field has its own ring (see app.css); the field
				// itself doesn't report focus while that button has it.
				if (el instanceof HTMLInputElement && el.type === 'date' && !el.matches(':focus'))
					return true;
				const style = getComputedStyle(el);
				const label = el.closest('label');
				const labelStyle = label ? getComputedStyle(label) : null;
				return (
					(style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) ||
					(labelStyle !== null && labelStyle.outlineStyle !== 'none')
				);
			});
			expect(outline, `focus ring on tab stop ${i + 1}`).toBe(true);
		}
	});

	test('controls are big enough to hit', async ({ page }) => {
		await setup(page);
		await loadSample(page);
		const small = await page.evaluate(() =>
			[
				...document.querySelectorAll<HTMLElement>(
					'main a.button, main button, header a, main .choice'
				)
			]
				.filter((el) => el.offsetParent !== null)
				.map((el) => ({
					text: el.textContent?.trim().slice(0, 30),
					h: el.getBoundingClientRect().height
				}))
				.filter((el) => el.h < 44)
		);
		expect(small).toEqual([]);
	});

	test('the page reflows at 320px wide (400% zoom) without sideways scrolling', async ({
		page
	}) => {
		await page.setViewportSize({ width: 320, height: 640 });
		await setup(page);
		await loadSample(page);
		for (const path of ['/', '/letters/', '/rules/ct/', '/settings/']) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth
			);
			expect(overflow, path).toBeLessThanOrEqual(0);
		}
	});

	test('honours reduced motion', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await setup(page);
		await loadSample(page);
		const transition = await page.evaluate(
			() => getComputedStyle(document.querySelector('.button')!).transitionDuration
		);
		expect(['0s', '']).toContain(transition);
	});
});
