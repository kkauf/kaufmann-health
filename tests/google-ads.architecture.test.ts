/**
 * CRITICAL TESTS: Google Ads Enhanced Conversions Architecture
 * 
 * These tests verify the integrity of the Google Ads conversion tracking system.
 * 
 * Architecture (Jan 2026):
 * 1. Client-side gtag fires BASE conversion (Website source) with transaction_id
 * 2. Server-side API ENHANCES that conversion with hashed user data via uploadConversionAdjustments
 * 3. Google matches the enhancement to the base conversion via orderId
 * 
 * This is "Enhanced Conversions for Leads" - the conversion action source is Website,
 * with Enhanced Conversions enabled via Google Ads API.
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

describe('Google Ads Enhanced Conversions Architecture', () => {
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
    it('uses uploadConversionAdjustments endpoint for Enhanced Conversions', async () => {
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

      // Enhanced Conversions uses uploadConversionAdjustments to enhance existing website conversions
      expect(url).toContain(':uploadConversionAdjustments');
    });

    it('includes GCLID in gclidDateTimePair for attribution', async () => {
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

      // Enhanced Conversions include GCLID in gclidDateTimePair
      expect(body.conversionAdjustments).toBeDefined();
      expect(body.conversionAdjustments[0].gclidDateTimePair.gclid).toBe('CjwKCAtest123');
    });

    it('uses conversionAdjustments key for Enhanced Conversions payload', async () => {
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

      // Enhanced Conversions uses conversionAdjustments key
      expect(body.conversionAdjustments).toBeDefined();
      expect(body.conversions).toBeUndefined();
    });

    it('includes adjustmentType ENHANCEMENT and orderId for matching', async () => {
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

      const adjustment = body.conversionAdjustments[0];
      // Enhanced Conversions require adjustmentType and orderId for matching to base conversion
      expect(adjustment.adjustmentType).toBe('ENHANCEMENT');
      expect(adjustment.orderId).toBe('test-order-123');
    });
  });

  describe('Source Code Verification', () => {
    it('google-ads.ts uses uploadConversionAdjustments for Enhanced Conversions', () => {
      const sourcePath = join(__dirname, '../src/lib/google-ads.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      expect(source).toContain('uploadConversionAdjustments');
      expect(source).toContain('buildConversionAdjustment');
    });

    it('google-ads.ts documents the Enhanced Conversions architecture', () => {
      const sourcePath = join(__dirname, '../src/lib/google-ads.ts');
      const source = readFileSync(sourcePath, 'utf-8');

      // Must document the architecture
      expect(source).toContain('Enhanced Conversions');
      expect(source).toContain('ENHANCE existing');
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

      const adjustment = body.conversionAdjustments[0];
      expect(adjustment.userIdentifiers).toBeDefined();
      expect(adjustment.userIdentifiers.length).toBeGreaterThan(0);
      expect(adjustment.userIdentifiers[0].hashedEmail).toBeDefined();
      // Email should be SHA256 hashed (64 hex chars)
      expect(adjustment.userIdentifiers[0].hashedEmail).toMatch(/^[a-f0-9]{64}$/);
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

      const adjustment = body.conversionAdjustments[0];
      expect(adjustment.userIdentifiers).toBeDefined();
      expect(adjustment.userIdentifiers[0].hashedPhoneNumber).toBeDefined();
      expect(adjustment.userIdentifiers[0].hashedPhoneNumber).toMatch(/^[a-f0-9]{64}$/);
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
