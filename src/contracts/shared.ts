import { z } from 'zod';

// ============================================================================
// DATABASE ENUMS - Single source of truth
// ============================================================================

export const GenderPreference = z.enum(['male', 'female', 'no_preference']);
export type GenderPreference = z.infer<typeof GenderPreference>;

export const TherapistGender = z.enum(['male', 'female']);
export type TherapistGender = z.infer<typeof TherapistGender>;

export const TherapistStatus = z.enum(['pending_verification', 'verified', 'rejected']);
export type TherapistStatus = z.infer<typeof TherapistStatus>;

export const PatientStatus = z.enum(['pre_confirmation', 'new', 'email_confirmed', 'matched', 'rejected']);
export type PatientStatus = z.infer<typeof PatientStatus>;

export const SessionPreference = z.enum(['online', 'in_person']);
export type SessionPreference = z.infer<typeof SessionPreference>;

export const MatchStatus = z.enum([
  'proposed',
  'therapist_contacted',
  'therapist_responded',
  'patient_selected',
  'accepted',
  'declined',
  'session_booked',
  'completed',
  'failed',
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

// ============================================================================
// REUSABLE FIELD VALIDATORS
// ============================================================================

export const Email = z.string().email('Ungültige E-Mail-Adresse').transform(s => s.toLowerCase().trim());

export const Phone = z.string()
  .min(6, 'Telefonnummer zu kurz')
  .max(20, 'Telefonnummer zu lang')
  .transform(s => s.trim());

export const NonEmptyString = z.string().min(1, 'Pflichtfeld').transform(s => s.trim());

export const OptionalString = z.string().optional().transform(s => s?.trim() || undefined);

export const City = z.string().min(1).transform(s => s.trim());

/** City that treats empty string as undefined (for optional city fields) */
export const OptionalCity = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  City.optional()
);

export const UUID = z.string().uuid();

// ============================================================================
// GERMAN → ENGLISH CONVERTERS
// These handle form inputs that come in German and need to be converted
// ============================================================================

/**
 * Converts German gender preference strings to English enum values
 * Form sends: 'Frau', 'Mann', 'Keine Präferenz', 'Divers/non-binär'
 * API expects: 'male', 'female', 'no_preference'
 */
export const GermanGenderPreference = z.string().transform((val): GenderPreference => {
  const g = val.toLowerCase();
  if (g.includes('frau')) return 'female';
  if (g.includes('mann')) return 'male';
  if (g.includes('keine') || g.includes('divers')) return 'no_preference';
  // If already in English format, validate it
  if (['male', 'female', 'no_preference'].includes(g)) return g as GenderPreference;
  return 'no_preference'; // Safe fallback
});

/**
 * Converts German session preference strings to English enum values
 * Form sends: 'Vor Ort', 'Online', 'Beides'
 * API expects: 'in_person', 'online', or array
 */
export const GermanSessionPreference = z.string().transform((val): SessionPreference | 'both' => {
  const s = val.toLowerCase();
  if (s.includes('ort') || s.includes('person') || s === 'in_person') return 'in_person';
  if (s.includes('online')) return 'online';
  if (s.includes('beid') || s === 'both') return 'both';
  return 'both'; // Safe fallback
});
