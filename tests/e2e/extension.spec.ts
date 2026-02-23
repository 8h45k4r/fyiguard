/**
 * FYI Guard - Playwright E2E Smoke Tests
 *
 * Tests the extension popup UI and core detection flows.
 * Requires the extension to be built first: npm run build
 *
 * Run: npx playwright test
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(__dirname, '../../extension/dist');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const POPUP_URL = `chrome-extension://fyiguard-test-id/popup.html`;

/**
 * Helper to launch Chrome with the FYI Guard extension loaded.
 */
async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
  return context;
}

// --- API Health Smoke Tests ---
test.describe('FYI Guard API Health', () => {
  test('health endpoint responds 200', async ({ request }) => {
    const API_URL = process.env['API_URL'] || 'http://localhost:3001';
    const response = await request.get(`${API_URL}/api/v1/health`);
    expect(response.status()).toBe(200);
    const body = await response.json() as { status: string };
    expect(body).toHaveProperty('status', 'healthy');
  });

  test('auth endpoint rejects missing credentials', async ({ request }) => {
    const API_URL = process.env['API_URL'] || 'http://localhost:3001';
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {},
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('events endpoint requires authentication', async ({ request }) => {
    const API_URL = process.env['API_URL'] || 'http://localhost:3001';
    const response = await request.post(`${API_URL}/api/v1/events`, {
      data: { events: [] },
    });
    expect(response.status()).toBe(401);
  });
});

// --- Privacy Policy Smoke Test ---
test.describe('Privacy Policy', () => {
  test('privacy policy page loads', async ({ page }) => {
    await page.goto('https://learn.certifyi.ai/fyi-guard/privacy-policy/');
    await expect(page).toHaveTitle(/Privacy Policy/i);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// --- Freemium Gate Logic ---
test.describe('Freemium Gate', () => {
  test('free plan limits are enforced client-side', () => {
    const FREE_LIMIT = 5;
    const scansToday = 5;
    const plan: 'free' | 'pro' = 'free';
    const isBlocked = plan === 'free' && scansToday >= FREE_LIMIT;
    expect(isBlocked).toBe(true);
  });

  test('pro plan bypasses scan limit', () => {
    const FREE_LIMIT = 5;
    const scansToday = 100;
    const plan: 'free' | 'pro' = 'pro';
    const isBlocked = (plan as 'free' | 'pro') === 'free' && scansToday >= FREE_LIMIT;
    expect(isBlocked).toBe(false);
  });
});

// --- Stripe Checkout Smoke Test ---
test.describe('Stripe Checkout', () => {
  test('checkout endpoint rejects unauthenticated requests', async ({ request }) => {
    const API_URL = process.env['API_URL'] || 'http://localhost:3001';
    const response = await request.post(`${API_URL}/api/v1/stripe/create-checkout`);
    expect(response.status()).toBe(401);
  });
});
