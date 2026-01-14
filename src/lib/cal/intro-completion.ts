/**
 * Helper functions for checking Cal.com intro session completion.
 * Used to gate full-session booking for therapists who require intro first.
 */

import { supabaseServer } from '@/lib/supabase-server';

/**
 * Check if a patient has completed an intro session with a specific therapist.
 * Completed = cal_bookings row with booking_kind='intro' and status='completed'
 */
export async function hasCompletedIntroWithTherapist(
  patientId: string,
  therapistId: string
): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('cal_bookings')
    .select('id')
    .eq('patient_id', patientId)
    .eq('therapist_id', therapistId)
    .eq('booking_kind', 'intro')
    .eq('status', 'completed')
    .limit(1);

  if (error) {
    console.error('[intro-completion] Error checking intro completion:', error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Batch check intro completion for multiple therapists.
 * Returns a Map of therapist_id -> boolean indicating if intro was completed.
 */
export async function batchCheckIntroCompletion(
  patientId: string,
  therapistIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  
  // Initialize all as false
  for (const tid of therapistIds) {
    result.set(tid, false);
  }

  if (therapistIds.length === 0) return result;

  const { data, error } = await supabaseServer
    .from('cal_bookings')
    .select('therapist_id')
    .eq('patient_id', patientId)
    .in('therapist_id', therapistIds)
    .eq('booking_kind', 'intro')
    .eq('status', 'completed');

  if (error) {
    console.error('[intro-completion] Error batch checking intro completion:', error);
    return result;
  }

  if (Array.isArray(data)) {
    for (const row of data) {
      if (row.therapist_id) {
        result.set(row.therapist_id, true);
      }
    }
  }

  return result;
}

/**
 * Extract requires_intro_before_booking flag from therapist metadata.
 */
export function getRequiresIntroBeforeBooking(
  metadata: unknown
): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const meta = metadata as Record<string, unknown>;
  const bookingSettings = meta.booking_settings;
  if (!bookingSettings || typeof bookingSettings !== 'object') return false;
  const settings = bookingSettings as Record<string, unknown>;
  return Boolean(settings.requires_intro_before_booking);
}
