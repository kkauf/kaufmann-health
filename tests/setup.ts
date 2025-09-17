import { vi } from 'vitest';

// Mock Vercel Analytics in tests to avoid resolving Next-specific modules
vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@vercel/analytics/next', () => ({
  Analytics: (_props: any) => null,
}));

// Safety defaults to ensure tests never hit real services locally
// These keep server-side helpers in no-op mode unless a test opts-in explicitly.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || '';
process.env.LEADS_NOTIFY_EMAIL = process.env.LEADS_NOTIFY_EMAIL || '';
process.env.REQUIRE_EMAIL_CONFIRMATION = process.env.REQUIRE_EMAIL_CONFIRMATION ?? 'false';
process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://kaufmann-health.de';

// Google Ads: ensure missing config by default so tracker no-ops in tests
process.env.GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || '';
process.env.GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
process.env.GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
process.env.GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '';
process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';

// Stub all fetch calls to return a lightweight OK response by default.
// Individual tests can override per-call using vi.mocked(global.fetch).mockImplementationOnce(...)
const okJson = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
vi.stubGlobal('fetch', vi.fn(async () => okJson.clone()))

