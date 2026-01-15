/**
 * Tests for availability-based Cal.com booking toggle
 * 
 * Business logic:
 * - If therapist has available slots (next_intro_slot exists), show Cal.com booking UI
 * - If therapist has no available slots, fallback to messaging flow
 * - cal_bookings_live=false should override and disable booking even with slots (admin kill switch)
 */

import { describe, it, expect } from 'vitest';
import { isCalBookingAvailable } from '@/lib/cal/booking-availability';

describe('isCalBookingAvailable', () => {
  const baseTherapist = {
    id: 'test-id',
    cal_enabled: true,
    cal_username: 'test-therapist',
  };

  describe('when therapist has available slots', () => {
    const nextIntroSlot = {
      date_iso: '2026-01-20',
      time_label: '10:00',
      time_utc: '2026-01-20T09:00:00Z',
    };

    it('should return true when cal_enabled and has slots', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        next_intro_slot: nextIntroSlot,
      })).toBe(true);
    });

    it('should return false when cal_enabled is false', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_enabled: false,
        next_intro_slot: nextIntroSlot,
      })).toBe(false);
    });

    it('should return false when cal_username is missing', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_username: null,
        next_intro_slot: nextIntroSlot,
      })).toBe(false);
    });

    it('should return false when cal_bookings_live is explicitly false (admin override)', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_bookings_live: false,
        next_intro_slot: nextIntroSlot,
      })).toBe(false);
    });
  });

  describe('when therapist has no available slots', () => {
    it('should return false even when cal_enabled and cal_bookings_live', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_bookings_live: true,
        next_intro_slot: null,
      })).toBe(false);
    });

    it('should return false when next_intro_slot is undefined', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_bookings_live: true,
      })).toBe(false);
    });
  });

  describe('slot validity', () => {
    it('should return false for slots in the past', () => {
      const pastSlot = {
        date_iso: '2020-01-01',
        time_label: '10:00',
        time_utc: '2020-01-01T09:00:00Z',
      };
      expect(isCalBookingAvailable({
        ...baseTherapist,
        next_intro_slot: pastSlot,
      })).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should work with legacy cal_bookings_live=true and no slots (returns false)', () => {
      // Previously this would show booking, now it should fallback to messaging
      expect(isCalBookingAvailable({
        ...baseTherapist,
        cal_bookings_live: true,
        next_intro_slot: null,
      })).toBe(false);
    });
  });
});
