/**
 * Cal.com Booking Availability Logic
 * 
 * Determines if Cal.com booking UI should be shown for a therapist.
 * 
 * Business rules:
 * 1. Therapist must have cal_enabled=true and cal_username set
 * 2. For intro booking: next_intro_slot must exist and be in future
 * 3. For session booking: next_full_slot must exist and be in future
 */

import type { NextIntroSlot, NextFullSlot } from '@/contracts/therapist';

export interface CalBookingAvailabilityInput {
  cal_enabled?: boolean | null;
  cal_username?: string | null;
  next_intro_slot?: NextIntroSlot | null;
  next_full_slot?: NextFullSlot | null;
}

/**
 * Check if a slot is valid (exists and is in the future)
 */
function isSlotValid(slot: NextIntroSlot | NextFullSlot | null | undefined): boolean {
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
 * Determine if Cal.com INTRO booking should be available for this therapist.
 * Used for the primary "Kennenlernen" CTA button.
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

  // Must have valid future intro slot
  if (!isSlotValid(next_intro_slot)) {
    return false;
  }

  return true;
}

/**
 * Determine if Cal.com SESSION booking should be available for this therapist.
 * Used for the "Direkt buchen" button - requires full-session slots.
 * 
 * Returns true only if:
 * - cal_enabled is true
 * - cal_username exists
 * - next_full_slot exists and is in the future
 */
export function isSessionBookingAvailable(input: CalBookingAvailabilityInput): boolean {
  const { cal_enabled, cal_username, next_full_slot } = input;

  // Must have Cal.com account configured
  if (!cal_enabled || !cal_username) {
    return false;
  }

  // Must have valid future full-session slot
  if (!isSlotValid(next_full_slot)) {
    return false;
  }

  return true;
}
