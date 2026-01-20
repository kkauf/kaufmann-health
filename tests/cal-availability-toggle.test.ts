/**
 * Tests for availability-based Cal.com booking toggle
 * 
 * Business logic:
 * - If therapist has available slots (next_intro_slot exists), show Cal.com booking UI
 * - If therapist has no available slots, fallback to messaging flow
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
    // Use a date 2 days in the future to avoid timezone issues
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dateIso = futureDate.toISOString().split('T')[0];
    const nextIntroSlot = {
      date_iso: dateIso,
      time_label: '10:00',
      time_utc: `${dateIso}T09:00:00Z`,
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

  });

  describe('when therapist has no available slots', () => {
    it('should return false even when cal_enabled', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
        next_intro_slot: null,
      })).toBe(false);
    });

    it('should return false when next_intro_slot is undefined', () => {
      expect(isCalBookingAvailable({
        ...baseTherapist,
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

});
