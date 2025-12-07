import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright E2E tests.
 * Creates storage state with Vercel bypass cookie for protected deployments.
 */
async function globalSetup(config: FullConfig) {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypassSecret) return;

  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  // Extract domain from baseURL for cookie
  const url = new URL(baseURL);
  const domain = url.hostname;

  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Set the Vercel bypass cookie
  await context.addCookies([
    {
      name: 'x-vercel-protection-bypass',
      value: bypassSecret,
      domain,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  // Save storage state for tests to use
  await context.storageState({ path: './tests/e2e/.auth/vercel-bypass.json' });
  await browser.close();
}

export default globalSetup;
