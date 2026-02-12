import { z } from 'zod';

// ============================================================================
// THERAPIST COUNT (for progressive filtering in wizard)
// GET /api/public/therapists/count
// ============================================================================

/**
 * Query parameters for filtering therapist count
 */
export const TherapistCountQuery = z.object({
  // Session format preference
  session_preference: z.enum(['online', 'in_person', 'either']).optional(),
  // City for in-person filtering
  city: z.string().optional(),
  // Gender preference
  gender_preference: z.enum(['male', 'female', 'no_preference']).optional(),
  // Schwerpunkte (comma-separated category IDs)
  schwerpunkte: z.string().optional(),
  // Modality preference
  modality: z.string().optional(),
  // Whether patient opted in to see certified (non-HP) practitioners
  accept_certified: z.enum(['true', 'false']).optional(),
});

export type TherapistCountQuery = z.infer<typeof TherapistCountQuery>;

/**
 * Response with therapist count
 */
export const TherapistCountOutput = z.object({
  count: z.number(),
  // Available counts (for display: "X+ Therapeuten")
  hasMore: z.boolean(),
});

export type TherapistCountOutput = z.infer<typeof TherapistCountOutput>;
