import { z } from 'zod';
import {
  NonEmptyString,
  OptionalString,
  City,
  TherapistGender,
  SessionPreference,
  UUID,
} from './shared';

// ============================================================================
// THERAPIST PROFILE UPDATE
// PATCH /api/public/therapists/[id]/profile
// ============================================================================

export const TherapistProfileUpdate = z.object({
  first_name: NonEmptyString.optional(),
  last_name: NonEmptyString.optional(),
  gender: TherapistGender.optional(),
  city: City.optional(),
  accepting_new: z.boolean().optional(),
  approach_text: z.string().max(2000).optional(),
  session_preferences: z.array(SessionPreference).optional(),
  modalities: z.array(z.string()).optional(),
  schwerpunkte: z.array(z.string()).optional(),
  terms_accepted_version: z.string().optional(),
});

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
