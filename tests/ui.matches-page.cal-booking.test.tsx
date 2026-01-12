/**
 * Test: Cal.com booking flow logic
 * 
 * When a therapist has Cal.com enabled (cal_bookings_live=true),
 * isCalBookingEnabled should return true and the booking flow should
 * open TherapistDetailModal instead of ContactModal.
 */
import { describe, it, expect } from 'vitest';
import { isCalBookingEnabled, assertCalFieldsPresent } from '@/lib/cal/booking-url';

describe('Cal.com booking flow', () => {
  describe('isCalBookingEnabled', () => {
    it('returns true when all Cal.com fields are set', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: 'peter-schindler',
        cal_bookings_live: true,
      };
      expect(isCalBookingEnabled(therapist)).toBe(true);
    });

    it('returns false when cal_bookings_live is false', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: 'inactive-user',
        cal_bookings_live: false,
      };
      expect(isCalBookingEnabled(therapist)).toBe(false);
    });

    it('returns false when cal_enabled is false', () => {
      const therapist = {
        cal_enabled: false,
        cal_username: 'some-user',
        cal_bookings_live: true,
      };
      expect(isCalBookingEnabled(therapist)).toBe(false);
    });

    it('returns false when cal_username is missing', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: null,
        cal_bookings_live: true,
      };
      expect(isCalBookingEnabled(therapist)).toBe(false);
    });
  });

  describe('assertCalFieldsPresent', () => {
    it('does not throw when all fields present', () => {
      const therapist = {
        id: 'test-id',
        cal_enabled: true,
        cal_username: 'peter',
        cal_bookings_live: true,
      };
      expect(() => assertCalFieldsPresent(therapist, 'test')).not.toThrow();
    });

    it('throws when cal_bookings_live is missing', () => {
      const therapist = {
        id: 'test-id',
        cal_enabled: true,
        cal_username: 'peter',
        // cal_bookings_live missing
      };
      expect(() => assertCalFieldsPresent(therapist, 'test')).toThrow('cal_bookings_live');
    });

    it('throws when cal_enabled is missing', () => {
      const therapist = {
        id: 'test-id',
        // cal_enabled missing
        cal_username: 'peter',
        cal_bookings_live: true,
      };
      expect(() => assertCalFieldsPresent(therapist, 'test')).toThrow('cal_enabled');
    });

    it('includes context in error message', () => {
      const therapist = { id: 'test-id' };
      expect(() => assertCalFieldsPresent(therapist, 'MatchPageClient')).toThrow('[MatchPageClient]');
    });
  });
});
