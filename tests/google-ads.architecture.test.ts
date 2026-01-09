/**
 * CRITICAL TESTS: Google Ads Conversion Architecture
 * 
 * These tests verify the integrity of the Google Ads conversion tracking system.
 * DO NOT MODIFY these tests without business approval.
 * 
 * Background: In Dec 2025, an LLM incorrectly changed from uploadClickConversions
 * to uploadConversionAdjustments, breaking conversion tracking for ~2 weeks.
 * These tests prevent that from happening again.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock logger before importing google-ads
vi.mock('@/lib/logger', async () => {
  return {
    track: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
  };
});

import { GoogleAdsTracker } from '@/lib/google-ads';
import * as logger from '@/lib/logger';

describe('Google Ads Architecture (CRITICAL - DO NOT MODIFY)', () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Set up env for configured state
    process.env.GOOGLE_ADS_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'test-refresh-token';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'test-developer-token';
    process.env.GOOGLE_ADS_CUSTOMER_ID = '1234567890';
    process.env.GOOGLE_ADS_CA_CLIENT_REGISTRATION = 'customers/1234567890/conversionActions/111111111';

    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    (logger.track as ReturnType<typeof vi.fn>).mockClear();
    (logger.logError as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_CA_CLIENT_REGISTRATION;
  });

  describe('API Endpoint Verification', () => {
    it('MUST use uploadClickConversions endpoint, NOT uploadConversionAdjustments', async () => {
      // Mock OAuth token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      // Mock conversion upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
        gclid: 'test-gclid',
      });

      // Find the conversion upload call (second fetch call)
      const calls = mockFetch.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const conversionCall = calls[1];
      const url = conversionCall[0] as string;

      // CRITICAL: Must use uploadClickConversions, NOT uploadConversionAdjustments
      expect(url).toContain(':uploadClickConversions');
      expect(url).not.toContain(':uploadConversionAdjustments');
    });

    it('MUST include GCLID in the conversion payload for attribution', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
        gclid: 'CjwKCAtest123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      // CRITICAL: GCLID must be in the conversion payload
      expect(body.conversions).toBeDefined();
      expect(body.conversions[0].gclid).toBe('CjwKCAtest123');
    });

    it('MUST use "conversions" key in payload, NOT "conversionAdjustments"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      // CRITICAL: Must use "conversions" key for uploadClickConversions
      expect(body.conversions).toBeDefined();
      expect(body.conversionAdjustments).toBeUndefined();
    });

    it('MUST include conversionDateTime and conversionValue in payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      const conversion = body.conversions[0];
      // uploadClickConversions requires these fields
      expect(conversion.conversionDateTime).toBeDefined();
      expect(conversion.conversionValue).toBe(10);
      expect(conversion.currencyCode).toBe('EUR');
    });

    it('MUST NOT include adjustmentType field (that is for adjustments API)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      const conversion = body.conversions[0];
      // adjustmentType is only for uploadConversionAdjustments - should NOT exist
      expect(conversion.adjustmentType).toBeUndefined();
    });
  });

  describe('Source Code Verification', () => {
    it('google-ads.ts MUST contain uploadClickConversions in the source code', () => {
      const sourcePath = join(__dirname, '../src/lib/google-ads.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      expect(source).toContain('uploadClickConversions');
      expect(source).toContain('buildClickConversion');
    });

    it('google-ads.ts MUST NOT use uploadConversionAdjustments as the primary API', () => {
      const sourcePath = join(__dirname, '../src/lib/google-ads.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      // The source should not contain the adjustments endpoint in the actual upload code
      // (Comments warning against it are OK)
      const lines = source.split('\n');
      const nonCommentLines = lines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*');
      });
      const codeOnly = nonCommentLines.join('\n');

      expect(codeOnly).not.toContain(':uploadConversionAdjustments');
    });

    it('google-ads.ts MUST contain warning comments about not switching APIs', () => {
      const sourcePath = join(__dirname, '../src/lib/google-ads.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      // Must have warning comments
      expect(source).toContain('DO NOT switch to uploadConversionAdjustments');
      expect(source).toContain('CRITICAL');
    });
  });

  describe('User Identifier Hashing', () => {
    it('includes hashed email in user identifiers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        email: 'test@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      const conversion = body.conversions[0];
      expect(conversion.userIdentifiers).toBeDefined();
      expect(conversion.userIdentifiers.length).toBeGreaterThan(0);
      expect(conversion.userIdentifiers[0].hashedEmail).toBeDefined();
      // Email should be SHA256 hashed (64 hex chars)
      expect(conversion.userIdentifiers[0].hashedEmail).toMatch(/^[a-f0-9]{64}$/);
    });

    it('includes hashed phone in user identifiers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{}] }),
      });

      const tracker = new GoogleAdsTracker();
      await tracker.trackConversion({
        phoneNumber: '+491234567890',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'test-order-123',
      });

      const calls = mockFetch.mock.calls;
      const conversionCall = calls[1];
      const requestInit = conversionCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);

      const conversion = body.conversions[0];
      expect(conversion.userIdentifiers).toBeDefined();
      expect(conversion.userIdentifiers[0].hashedPhoneNumber).toBeDefined();
      expect(conversion.userIdentifiers[0].hashedPhoneNumber).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

describe('Client-Side Conversion Tracking', () => {
  it('gtag.ts sends properties (not props) to events API with gtag_available flag', async () => {
    const sourcePath = join(__dirname, '../src/lib/gtag.ts');
    const source = readFileSync(sourcePath, 'utf-8');

    // Should use 'properties' key for the events API with gtag_available
    expect(source).toContain("properties: { label, transaction_id: transactionId, has_gclid: hasGclid, gtag_available: gtagAvailable }");
    // Should NOT use 'props' key (that was the bug)
    expect(source).not.toContain("props: { label, transaction_id: transactionId");
  });
});
