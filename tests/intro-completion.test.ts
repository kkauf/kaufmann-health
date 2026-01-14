/**
 * Tests for intro completion check and booking gating feature.
 * 
 * This feature allows therapists to require an intro session before
 * clients can book full sessions directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRequiresIntroBeforeBooking } from '@/lib/cal/intro-completion';

// Mock Supabase for the server functions
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('getRequiresIntroBeforeBooking', () => {
  it('returns false for null metadata', () => {
    expect(getRequiresIntroBeforeBooking(null)).toBe(false);
  });

  it('returns false for undefined metadata', () => {
    expect(getRequiresIntroBeforeBooking(undefined)).toBe(false);
  });

  it('returns false for empty object metadata', () => {
    expect(getRequiresIntroBeforeBooking({})).toBe(false);
  });

  it('returns false when booking_settings is missing', () => {
    expect(getRequiresIntroBeforeBooking({ profile: {} })).toBe(false);
  });

  it('returns false when booking_settings is not an object', () => {
    expect(getRequiresIntroBeforeBooking({ booking_settings: 'invalid' })).toBe(false);
  });

  it('returns false when requires_intro_before_booking is not set', () => {
    expect(getRequiresIntroBeforeBooking({ booking_settings: {} })).toBe(false);
  });

  it('returns false when requires_intro_before_booking is explicitly false', () => {
    expect(getRequiresIntroBeforeBooking({ 
      booking_settings: { requires_intro_before_booking: false } 
    })).toBe(false);
  });

  it('returns true when requires_intro_before_booking is true', () => {
    expect(getRequiresIntroBeforeBooking({ 
      booking_settings: { requires_intro_before_booking: true } 
    })).toBe(true);
  });

  it('returns true with nested metadata structure', () => {
    expect(getRequiresIntroBeforeBooking({ 
      profile: { who_comes_to_me: 'People with trauma' },
      booking_settings: { requires_intro_before_booking: true } 
    })).toBe(true);
  });
});

describe('TherapistDataSchema booking gating fields', () => {
  it('schema includes requires_intro_before_booking field definition', async () => {
    const { TherapistDataSchema } = await import('@/contracts/therapist');
    
    // Check that the schema shape includes the new fields
    const shape = TherapistDataSchema.shape;
    expect(shape.requires_intro_before_booking).toBeDefined();
    expect(shape.has_completed_intro).toBeDefined();
  });

  it('parses booking gating fields correctly when provided', async () => {
    const { TherapistDataSchema } = await import('@/contracts/therapist');
    
    // Use a partial parse to test just the new fields work
    const partialResult = TherapistDataSchema.partial().safeParse({
      requires_intro_before_booking: true,
      has_completed_intro: false,
    });
    
    expect(partialResult.success).toBe(true);
    if (partialResult.success) {
      expect(partialResult.data.requires_intro_before_booking).toBe(true);
      expect(partialResult.data.has_completed_intro).toBe(false);
    }
  });
});

describe('TherapistBookingSettingsSchema', () => {
  it('validates booking settings with requires_intro_before_booking', async () => {
    const { TherapistBookingSettingsSchema } = await import('@/contracts/therapist');
    
    const result = TherapistBookingSettingsSchema.safeParse({
      requires_intro_before_booking: true,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requires_intro_before_booking).toBe(true);
    }
  });

  it('allows empty booking settings', async () => {
    const { TherapistBookingSettingsSchema } = await import('@/contracts/therapist');
    
    const result = TherapistBookingSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('AdminTherapistPatchInput', () => {
  it('includes requires_intro_before_booking field', async () => {
    const { AdminTherapistPatchInput } = await import('@/contracts/admin');
    
    const result = AdminTherapistPatchInput.safeParse({
      requires_intro_before_booking: true,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requires_intro_before_booking).toBe(true);
    }
  });

  it('allows requires_intro_before_booking with other fields', async () => {
    const { AdminTherapistPatchInput } = await import('@/contracts/admin');
    
    const result = AdminTherapistPatchInput.safeParse({
      cal_enabled: true,
      requires_intro_before_booking: true,
    });
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requires_intro_before_booking).toBe(true);
      expect(result.data.cal_enabled).toBe(true);
    }
  });
});
