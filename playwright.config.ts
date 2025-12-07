import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables for Playwright itself so tests can read from .env/.env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

// Default to suppressing outbound emails during E2E runs unless explicitly overridden
if (!process.env.EMAIL_SUPPRESS_OUTBOUND) {
  process.env.EMAIL_SUPPRESS_OUTBOUND = 'true';
}

// Prefer explicit E2E_BASE_URL, else align with the running Next.js base URL if provided
const base = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000';

// Vercel Protection Bypass for CI/CD (set via VERCEL_AUTOMATION_BYPASS_SECRET)
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: base,
    // Pass Vercel bypass header if secret is configured (for protected staging/preview deployments)
    ...(bypassSecret ? {
      extraHTTPHeaders: {
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': bypassSecret,
      },
      storageState: './tests/e2e/.auth/vercel-bypass.json',
    } : {}),
  },
  // Global setup to inject Vercel bypass cookie before tests run
  ...(bypassSecret ? { globalSetup: './tests/e2e/global-setup.ts' } : {}),
  webServer: {
    // Allow override, but default to the normal dev command
    command: process.env.E2E_WEB_COMMAND || 'npm run dev',
    url: base,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  workers: 1,
});
