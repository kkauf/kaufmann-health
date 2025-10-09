/**
 * Integration tests for conversion tracking across verification flows (EARTH-204)
 * Tests Scenarios 2-4: email verification, SMS verification, direct therapist contact
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing conversion logic
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));
vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: {
    trackConversion: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('@/lib/verification/sms', () => ({
  verifySmsCode: vi.fn(),
  sendSmsCode: vi.fn(),
}));

describe('Conversion Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cross-flow conversion scenarios', () => {
    it('should support email verification method', async () => {
      const { supabaseServer } = await import('@/lib/supabase-server');
      const { googleAdsTracker } = await import('@/lib/google-ads');
      const { maybeFirePatientConversion } = await import('@/lib/conversion');

      const mockPerson = {
        id: 'email-patient-123',
        email: 'verified@example.com',
        type: 'patient',
        metadata: {},
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
        update: vi.fn().mockReturnThis(),
      };

      vi.mocked(supabaseServer.from).mockReturnValue(mockChain as never);
      vi.mocked(googleAdsTracker.trackConversion).mockResolvedValue(undefined);

      const result = await maybeFirePatientConversion({
        patient_id: 'email-patient-123',
        email: 'verified@example.com',
        verification_method: 'email',
      });

      expect(result.fired).toBe(true);
      expect(googleAdsTracker.trackConversion).toHaveBeenCalledWith({
        email: 'verified@example.com',
        conversionAction: 'client_registration',
        conversionValue: 10,
        orderId: 'email-patient-123',
      });
    });

    it('should support SMS verification method with email fallback', async () => {
      const { supabaseServer } = await import('@/lib/supabase-server');
      const { googleAdsTracker } = await import('@/lib/google-ads');
      const { maybeFirePatientConversion } = await import('@/lib/conversion');

      const mockPerson = {
        id: 'sms-patient-456',
        email: 'sms@example.com',
        phone_number: '+4917612345678',
        type: 'patient',
        metadata: {},
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
        update: vi.fn().mockReturnThis(),
      };

      vi.mocked(supabaseServer.from).mockReturnValue(mockChain as never);
      vi.mocked(googleAdsTracker.trackConversion).mockResolvedValue(undefined);

      const result = await maybeFirePatientConversion({
        patient_id: 'sms-patient-456',
        email: 'sms@example.com',
        phone_number: '+4917612345678',
        verification_method: 'sms',
      });

      expect(result.fired).toBe(true);
      expect(googleAdsTracker.trackConversion).toHaveBeenCalled();
    });

    it('should support direct therapist contact flow', async () => {
      const { supabaseServer } = await import('@/lib/supabase-server');
      const { googleAdsTracker } = await import('@/lib/google-ads');
      const { maybeFirePatientConversion } = await import('@/lib/conversion');

      const mockPerson = {
        id: 'direct-patient-789',
        email: 'patient@example.com',
        type: 'patient',
        metadata: {},
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
        update: vi.fn().mockReturnThis(),
      };

      vi.mocked(supabaseServer.from).mockReturnValue(mockChain as never);
      vi.mocked(googleAdsTracker.trackConversion).mockResolvedValue(undefined);

      const result = await maybeFirePatientConversion({
        patient_id: 'direct-patient-789',
        email: 'patient@example.com',
        verification_method: 'email',
      });

      expect(result.fired).toBe(true);
      expect(googleAdsTracker.trackConversion).toHaveBeenCalled();
    });

    it('should deduplicate conversions across all flows', async () => {
      const { supabaseServer } = await import('@/lib/supabase-server');
      const { googleAdsTracker } = await import('@/lib/google-ads');
      const { maybeFirePatientConversion } = await import('@/lib/conversion');

      const mockPerson = {
        id: 'dedup-patient',
        email: 'dedup@example.com',
        type: 'patient',
        metadata: {
          google_ads_conversion_fired_at: '2025-10-09T10:00:00.000Z',
          google_ads_conversion_method: 'email',
        },
      };

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPerson, error: null }),
        update: vi.fn().mockReturnThis(),
      };

      vi.mocked(supabaseServer.from).mockReturnValue(mockChain as never);

      const result = await maybeFirePatientConversion({
        patient_id: 'dedup-patient',
        email: 'dedup@example.com',
        verification_method: 'sms', // Different method, but already fired
      });

      expect(result.fired).toBe(false);
      expect(result.reason).toBe('already_fired');
      expect(googleAdsTracker.trackConversion).not.toHaveBeenCalled();
    });
  });
});
