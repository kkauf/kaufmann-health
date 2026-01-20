import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', async () => {
  return {
    track: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
  } as any;
});

import { GoogleAdsTracker, __internals } from '@/lib/google-ads';
import * as logger from '@/lib/logger';

describe('GoogleAdsTracker', () => {
  beforeEach(() => {
    // Ensure env is not configured so tracker no-ops
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    (logger.track as any).mockClear?.();
    (logger.logError as any).mockClear?.();
  });

  it('normalizes and hashes emails with sha256 lower-hex', () => {
    const t = new GoogleAdsTracker();
    const hashed = t.hashEmail('  Test@Example.com  ');
    const expected = __internals.sha256LowerHex('test@example.com');
    expect(hashed).toBe(expected);
  });

  it('builds alias env keys', () => {
    expect(__internals.aliasToEnvKey('lead_verified')).toBe('GOOGLE_ADS_CA_LEAD_VERIFIED');
    expect(__internals.aliasToEnvKey('First Contact')).toBe('GOOGLE_ADS_CA_FIRST_CONTACT');
  });

  it('formats date time to Google Ads expected format (UTC)', () => {
    const s = __internals.toGoogleDateTime('2025-08-28T12:34:56.789Z');
    expect(s).toBe('2025-08-28 12:34:56+00:00');
  });

  it('validates conversion data and no-ops when not configured', async () => {
    const t = new GoogleAdsTracker();
    await t.trackConversion({
      email: 'user@example.com',
      conversionAction: 'lead_verified',
      conversionValue: 12,
      orderId: 'abc-123',
    });
    expect((logger.track as any).mock.calls.length).toBeGreaterThan(0);
    const last = (logger.track as any).mock.calls.at(-1)[0];
    expect(last.type).toBe('google_ads_noop');
  });
});
