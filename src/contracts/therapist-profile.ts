import { z } from 'zod';
import {
  NonEmptyString,
  OptionalString,
  City,
  TherapistGender,
  SessionPreference,
} from './shared';

const TherapistProfileGender = z.string().refine(
  (v) => ['male', 'female', 'diverse'].includes(v),
  { message: 'invalid gender' }
);

const SessionPreferences = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return v;
}, z.array(SessionPreference));

const AcceptingNew = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(s)) return true;
    if (['false', '0', 'no'].includes(s)) return false;
  }
  return v;
}, z.boolean());

const TypicalRate = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) return parseInt(v, 10);
  return v;
}, z.number().int().positive());

// ============================================================================
// THERAPIST PROFILE UPDATE
// PATCH /api/public/therapists/[id]/profile
// ============================================================================

export const TherapistProfileUpdate = z.object({
  first_name: NonEmptyString.optional(),
  last_name: NonEmptyString.optional(),
  gender: TherapistProfileGender.optional(),
  city: City.optional(),
  accepting_new: AcceptingNew.optional(),
  approach_text: z.string().max(2000).optional(),
  session_preferences: SessionPreferences.optional(),
  modalities: z.array(z.string()).optional(),
  schwerpunkte: z.array(z.string()).optional(),
  typical_rate: TypicalRate.optional(),
  practice_street: OptionalString,
  practice_postal_code: OptionalString,
  practice_city: OptionalString,
  who_comes_to_me: OptionalString,
  session_focus: OptionalString,
  first_session: OptionalString,
  about_me: OptionalString,
  terms_accepted_version: OptionalString,
}).passthrough();

export type TherapistProfileUpdate = z.infer<typeof TherapistProfileUpdate>;

// ============================================================================
// THERAPIST SLOT
// POST /api/admin/therapists/[id]/slots
// ============================================================================

export const TherapistSlotInput = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  session_type: SessionPreference,
  address: OptionalString,
  is_recurring: z.boolean().default(false),
  recurrence_rule: OptionalString,
});

export type TherapistSlotInput = z.infer<typeof TherapistSlotInput>;

// ============================================================================
// THERAPIST SEARCH/LIST (query params)
// GET /api/public/therapists
// ============================================================================

export const TherapistListQuery = z.object({
  city: City.optional(),
  modality: z.string().optional(),
  gender: TherapistGender.optional(),
  session_type: SessionPreference.optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type TherapistListQuery = z.infer<typeof TherapistListQuery>;
