/**
 * Test: Cal.com booking flow logic
 *
 * When a therapist has Cal.com enabled (cal_enabled=true and cal_username set),
 * isCalBookingEnabled should return true and the booking flow should
 * open TherapistDetailModal instead of ContactModal.
 *
 * Note: cal_bookings_live is no longer used - availability is determined
 * automatically by cached slot data. New accounts start with 0 availability,
 * so booking buttons only appear when therapist sets up their Cal.com schedule.
 */
import { describe, it, expect } from 'vitest';
import { isCalBookingEnabled, assertCalFieldsPresent } from '@/lib/cal/booking-url';

describe('Cal.com booking flow', () => {
  describe('isCalBookingEnabled', () => {
    it('returns true when cal_enabled and cal_username are set', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: 'peter-schindler',
      };
      expect(isCalBookingEnabled(therapist)).toBe(true);
    });

    it('returns false when cal_enabled is false', () => {
      const therapist = {
        cal_enabled: false,
        cal_username: 'some-user',
      };
      expect(isCalBookingEnabled(therapist)).toBe(false);
    });

    it('returns false when cal_username is missing', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: null,
      };
      expect(isCalBookingEnabled(therapist)).toBe(false);
    });

    it('returns false when cal_username is empty string', () => {
      const therapist = {
        cal_enabled: true,
        cal_username: '',
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
      };
      expect(() => assertCalFieldsPresent(therapist, 'test')).not.toThrow();
    });

    it('throws when cal_enabled is missing', () => {
      const therapist = {
        id: 'test-id',
        // cal_enabled missing
        cal_username: 'peter',
      };
      expect(() => assertCalFieldsPresent(therapist, 'test')).toThrow('cal_enabled');
    });

    it('includes context in error message', () => {
      const therapist = { id: 'test-id' };
      expect(() => assertCalFieldsPresent(therapist, 'MatchPageClient')).toThrow('[MatchPageClient]');
    });
  });
});
