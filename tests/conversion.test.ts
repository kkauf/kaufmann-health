/**
 * Tests for unified conversion tracking (EARTH-204)
 * Verifies conversions fire on email OR SMS verification across all flows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { supabaseServer } from '@/lib/supabase-server';
import { googleAdsTracker } from '@/lib/google-ads';

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

describe('maybeFirePatientConversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSupabaseChain = (data: unknown, error: unknown = null) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data, error })),
    };
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    return chain;
  };

  it('should fire conversion for email-verified patient with email', async () => {
    const person = {
      id: 'patient-123',
      email: 'test@example.com',
      type: 'patient',
      metadata: {},
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'patient-123',
      email: 'test@example.com',
      verification_method: 'email',
    });

    expect(result.fired).toBe(true);
    expect(googleAdsTracker.trackConversion).toHaveBeenCalledWith({
      email: 'test@example.com',
      conversionAction: 'lead_verified',
      conversionValue: 12,
      orderId: 'patient-123',
    });
  });

  it('should fire conversion for SMS-verified patient with email fallback (email and phone allowed)', async () => {
    const person = {
      id: 'patient-456',
      email: 'sms-user@example.com',
      phone_number: '+4917612345678',
      type: 'patient',
      metadata: {},
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'patient-456',
      email: 'sms-user@example.com',
      phone_number: '+4917612345678',
      verification_method: 'sms',
    });

    expect(result.fired).toBe(true);
    expect(googleAdsTracker.trackConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sms-user@example.com',
        conversionAction: 'lead_verified',
        conversionValue: 12,
        orderId: 'patient-456',
      }),
    );
  });

  it('should not fire conversion if already fired (deduplication)', async () => {
    const person = {
      id: 'patient-789',
      email: 'duplicate@example.com',
      type: 'patient',
      metadata: {
        google_ads_conversion_fired_at: '2025-10-09T10:00:00.000Z',
      },
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'patient-789',
      email: 'duplicate@example.com',
      verification_method: 'email',
    });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('already_fired');
    expect(googleAdsTracker.trackConversion).not.toHaveBeenCalled();
  });

  it('should not fire conversion for test leads', async () => {
    const person = {
      id: 'test-patient',
      email: 'test@kaufmann.health',
      type: 'patient',
      metadata: {
        is_test: true,
      },
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'test-patient',
      email: 'test@kaufmann.health',
      verification_method: 'email',
    });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('test_lead');
    expect(googleAdsTracker.trackConversion).not.toHaveBeenCalled();
  });

  it('should not fire conversion for therapist leads', async () => {
    const person = {
      id: 'therapist-123',
      email: 'therapist@example.com',
      type: 'therapist',
      metadata: {},
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'therapist-123',
      email: 'therapist@example.com',
      verification_method: 'email',
    });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('not_patient');
    expect(googleAdsTracker.trackConversion).not.toHaveBeenCalled();
  });

  it('should fire conversion if no email available (phone-only) using phone identifier', async () => {
    const person = {
      id: 'phone-only-patient',
      phone_number: '+4917612345678',
      type: 'patient',
      metadata: {},
    };
    mockSupabaseChain(person);

    const result = await maybeFirePatientConversion({
      patient_id: 'phone-only-patient',
      phone_number: '+4917612345678',
      verification_method: 'sms',
    });

    expect(result.fired).toBe(true);
    expect(googleAdsTracker.trackConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '+4917612345678',
        conversionAction: 'lead_verified',
        conversionValue: 12,
        orderId: 'phone-only-patient',
      }),
    );
  });

  it('should handle database errors gracefully', async () => {
    mockSupabaseChain(null, new Error('Database connection failed'));

    const result = await maybeFirePatientConversion({
      patient_id: 'patient-error',
      email: 'error@example.com',
      verification_method: 'email',
    });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('person_not_found');
    expect(googleAdsTracker.trackConversion).not.toHaveBeenCalled();
  });

  it('should persist conversion timestamp in metadata', async () => {
    const person = {
      id: 'patient-persist',
      email: 'persist@example.com',
      type: 'patient',
      metadata: { some_field: 'value' },
    };
    const chain = mockSupabaseChain(person);

    await maybeFirePatientConversion({
      patient_id: 'patient-persist',
      email: 'persist@example.com',
      verification_method: 'email',
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          some_field: 'value',
          google_ads_conversion_fired_at: expect.any(String),
          google_ads_conversion_method: 'email',
        }),
      })
    );
  });
});
