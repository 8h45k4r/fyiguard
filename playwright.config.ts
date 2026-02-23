/**
 * FYI Guard - Playwright E2E Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 *
 * Uses PlaywrightTestConfig type directly to avoid import issues.
 * Run: npx playwright test
 */
// @playwright/test types provided by tests/e2e/playwright.d.ts stub

const config = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  use: {
    baseURL: process.env['API_URL'] || 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
};

export default config;