import { defineConfig, devices } from '@playwright/test';

const port = 4173;
/** The stats API the e2e build talks to (see .github/workflows/ci.yml). */
const apiPort = 8000;
const startApi = !!process.env.E2E_START_API;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// Each test runs a real browser; more than two at once overloads small CI machines.
	workers: 2,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${port}`,
		trace: 'retain-on-failure',
		locale: 'en-US',
		timezoneId: 'America/New_York'
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: [
		{
			// Serves the built site (run `npm run build` first) the way GitHub Pages does.
			command: 'npx tsx scripts/serve.ts build',
			env: { PORT: String(port) },
			port,
			reuseExistingServer: !process.env.CI
		},
		...(startApi
			? [
					{
						command: `uv run --directory api uvicorn rollfix_api.main:app --port ${apiPort}`,
						url: `http://localhost:${apiPort}/readyz`,
						env: {
							ROLLFIX_ALLOWED_ORIGINS: `http://localhost:${port}`,
							ROLLFIX_WRITE_LIMIT_PER_HOUR: '10000',
							ROLLFIX_STATS_CACHE_SECONDS: '0'
						},
						reuseExistingServer: !process.env.CI,
						timeout: 60_000
					}
				]
			: [])
	]
});
