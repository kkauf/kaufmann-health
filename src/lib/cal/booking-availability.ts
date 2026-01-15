/**
 * Cal.com Booking Availability Logic
 * 
 * Determines if Cal.com booking UI should be shown for a therapist.
 * 
 * Business rules:
 * 1. Therapist must have cal_enabled=true and cal_username set
 * 2. Therapist must have available slots (next_intro_slot exists and is in future)
 */

import type { NextIntroSlot } from '@/contracts/therapist';

export interface CalBookingAvailabilityInput {
  cal_enabled?: boolean | null;
  cal_username?: string | null;
  next_intro_slot?: NextIntroSlot | null;
}

/**
 * Check if a slot is valid (exists and is in the future)
 */
function isSlotValid(slot: NextIntroSlot | null | undefined): boolean {
  if (!slot?.time_utc) return false;
  
  try {
    const slotTime = new Date(slot.time_utc).getTime();
    const now = Date.now();
    // Slot must be at least 30 minutes in the future
    return slotTime > now + 30 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Determine if Cal.com booking should be available for this therapist.
 * 
 * Returns true only if:
 * - cal_enabled is true
 * - cal_username exists
 * - next_intro_slot exists and is in the future
 */
export function isCalBookingAvailable(input: CalBookingAvailabilityInput): boolean {
  const { cal_enabled, cal_username, next_intro_slot } = input;

  // Must have Cal.com account configured
  if (!cal_enabled || !cal_username) {
    return false;
  }

  // Must have valid future slot
  if (!isSlotValid(next_intro_slot)) {
    return false;
  }

  return true;
}
