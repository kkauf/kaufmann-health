#!/usr/bin/env tsx
/*
  Playwright-based end-to-end smoke test.
  - Navigates to /therapie-finden, fills EmailEntryForm, submits, and validates success card.
  - Navigates to /fragebogen, completes the wizard through step 6 (success screen).
  - Headless, exits 0 on success, 1 on failure.
  - Accepts --base-url parameter, defaults to http://localhost:3000

  Usage:
    tsx scripts/smoke-test.ts --base-url=https://preview.example.com
*/

import { chromium, Browser, Page } from 'playwright';

function parseArg(name: string, defaultValue?: string): string | undefined {
  const prefix = `--${name}`;
  for (const arg of process.argv.slice(2)) {
    if (arg === prefix && defaultValue !== undefined) return defaultValue;
    if (arg.startsWith(prefix + '=')) return arg.slice(prefix.length + 1);
  }
  return undefined;
}

async function acceptCookiesIfPresent(page: Page) {
  try {
    // Cookie banner accept button text per CookieBanner.tsx
    const accept = page.locator('button', { hasText: 'Alle akzeptieren' });
    if (await accept.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      await accept.first().click();
    }
  } catch {}
}

async function run() {
  const baseUrl =
    parseArg('base-url') || process.env.BASE_URL || process.env.PREVIEW_URL || 'http://localhost:3000';

  const email1 = `smoke+${Date.now()}@test.com`;
  const email2 = `smokewizard+${Date.now()}@test.com`;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // 1) /therapie-finden flow
    await page.goto(`${baseUrl}/therapie-finden`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptCookiesIfPresent(page);

    // Fill EmailEntryForm
    await page.locator('#name').fill('Smoke Bot');
    await page.locator('#email').fill(email1);
    // Submit
    await page.locator('form button[type="submit"]').first().click();

    // Expect success (submitted card)
    await page.waitForSelector('text=Fast geschafft', { timeout: 20_000 });

    // 2) /fragebogen flow
    await page.goto(`${baseUrl}/fragebogen`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptCookiesIfPresent(page);

    // Screen 1: name + email
    await page.locator('#name').fill('Wizard Smoke');
    await page.locator('#email').fill(email2);
    const nextBtn = page.getByTestId('wizard-next');
    await nextBtn.click();

    // Screen 2: required selections
    await page.getByRole('button', { name: 'Diese Woche (Akutplätze verfügbar)' }).click();
    await page.getByRole('button', { name: 'Nein' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();

    // Screen 3: location (fill city or enable online)
    await page.locator('#city').fill('Berlin');
    await page.getByRole('button', { name: 'Weiter →' }).click();

    // Screen 4: language required
    await page.getByRole('button', { name: 'Deutsch' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();

    // Screen 5: consent checkbox + submit
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Weiter →' }).click();

    // Expect final success screen
    await page.waitForSelector('text=✓ Geschafft! Deine Anfrage ist bei uns', { timeout: 25_000 });

    await browser.close();
    console.log('Smoke OK');
    process.exit(0);
  } catch (err) {
    console.error('Smoke FAILED:', err);
    try { await browser?.close(); } catch {}
    process.exit(1);
  }
}

run();
