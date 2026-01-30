/**
 * Cal.com Booking Checks
 *
 * Helper functions for checking booking state before sending follow-up emails.
 */

import { supabaseServer } from '@/lib/supabase-server';

/**
 * Check if a patient already has a future full_session booking with a therapist.
 * Used to skip follow-up emails if the therapist has already booked the client.
 *
 * @returns true if a future full_session booking exists
 */
export async function hasFutureFullSessionBooking(
  patientId: string,
  therapistId: string
): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('cal_bookings')
    .select('id')
    .eq('patient_id', patientId)
    .eq('therapist_id', therapistId)
    .eq('booking_kind', 'full_session')
    .gt('start_time', new Date().toISOString())
    .in('status', ['ACCEPTED', 'PENDING'])
    .limit(1)
    .maybeSingle();

  if (error) {
    // Log but don't block - safer to send the email than skip it due to error
    console.error('[booking-checks] Error checking future booking:', error);
    return false;
  }

  return data !== null;
}

/**
 * Check if a patient already has ANY future booking with a therapist.
 * Used for session follow-ups (after full_session).
 *
 * @returns true if any future booking exists
 */
export async function hasAnyFutureBooking(
  patientId: string,
  therapistId: string
): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('cal_bookings')
    .select('id')
    .eq('patient_id', patientId)
    .eq('therapist_id', therapistId)
    .gt('start_time', new Date().toISOString())
    .in('status', ['ACCEPTED', 'PENDING'])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[booking-checks] Error checking future booking:', error);
    return false;
  }

  return data !== null;
}
