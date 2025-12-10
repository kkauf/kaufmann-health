import { z } from 'zod';
import { UUID, SessionPreference } from './shared';

// ============================================================================
// BOOKING REQUEST
// POST /api/public/bookings
// ============================================================================

/**
 * Date in YYYY-MM-DD format
 */
export const DateIso = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Ungültiges Datum (YYYY-MM-DD erwartet)'
).refine(
  (s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()),
  'Ungültiges Datum'
);

/**
 * Time in HH:MM format
 */
export const TimeLabel = z.string().regex(
  /^[0-2][0-9]:[0-5][0-9]$/,
  'Ungültige Uhrzeit (HH:MM erwartet)'
);

export const BookingInput = z.object({
  therapist_id: UUID,
  date_iso: DateIso,
  time_label: TimeLabel,
  format: SessionPreference,
  session_id: UUID.optional(),
});

export type BookingInput = z.infer<typeof BookingInput>;

export const BookingOutput = z.object({
  success: z.boolean(),
  booking_id: UUID.optional(),
});

export type BookingOutput = z.infer<typeof BookingOutput>;
