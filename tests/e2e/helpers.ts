import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Today in these tests. Sample data is relative to it, so the counter reads "Day 23". */
export const TODAY = new Date('2026-11-19T12:00:00-05:00');

/** Fix the clock and fail if the page tries to reach any server but the site (and its API). */
export async function setup(page: Page, allowed: string[] = []) {
	await page.clock.setFixedTime(TODAY);
	const external: string[] = [];
	await page.route('**/*', (route) => {
		const url = new URL(route.request().url());
		const local =
			url.hostname === 'localhost' && (url.port === '4173' || allowed.includes(url.origin));
		if (!local && url.protocol !== 'data:' && url.protocol !== 'blob:') {
			external.push(url.href);
			return route.abort();
		}
		return route.continue();
	});
	return external;
}

export async function loadSample(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Try it with sample data' }).click();
	await expect(page.getByTestId('day-number')).toHaveText('23');
}

/** Check a page with axe against WCAG 2.2 A and AA. */
export async function expectAccessible(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
		.analyze();
	const problems = results.violations.map(
		(violation) =>
			`${violation.id}: ${violation.help}\n  ${violation.nodes.map((node) => node.target.join(' ')).join('\n  ')}`
	);
	expect(problems).toEqual([]);
}

/** Press Tab until the focused element has this accessible name (fails after `max` presses). */
export async function tabTo(page: Page, name: string | RegExp, max = 80) {
	for (let i = 0; i < max; i++) {
		await page.keyboard.press('Tab');
		const focused = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el) return '';
			const labelled = el.getAttribute('aria-label');
			const label =
				(el as HTMLInputElement).labels?.[0]?.textContent ?? labelled ?? el.textContent ?? '';
			return label.replace(/\s+/g, ' ').trim();
		});
		if (
			typeof name === 'string' ? focused === name || focused.startsWith(name) : name.test(focused)
		)
			return;
	}
	throw new Error(`Could not reach "${name}" with the Tab key`);
}

/** In a radio group, press the arrow key until the radio with this name is selected. */
export async function arrowTo(page: Page, name: RegExp, max = 20) {
	for (let i = 0; i < max; i++) {
		const label = await page.evaluate(
			() =>
				(document.activeElement as HTMLInputElement | null)?.labels?.[0]?.textContent
					?.replace(/\s+/g, ' ')
					.trim() ?? ''
		);
		if (name.test(label)) return;
		await page.keyboard.press('ArrowDown');
	}
	throw new Error(`Could not reach "${name}" with the arrow keys`);
}
