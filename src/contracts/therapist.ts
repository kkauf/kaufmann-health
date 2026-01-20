import { z } from 'zod';

// ============================================================================
// THERAPIST DATA CONTRACTS
// Single source of truth for therapist data shapes across all surfaces:
// - Directory (/therapeuten)
// - Teaser sections (/therapie-finden, /start)
// - Match pages (/matches/[uuid])
// - Admin interfaces
// ============================================================================

// ============================================================================
// PROFILE FIELDS (nested in metadata.profile)
// ============================================================================
// 
// LEGACY FIELDS: The following fields were populated during early onboarding
// via free-text input. They are still displayed in emails and profiles but
// should be considered legacy data. New therapists use structured fields.
//
// Legacy free-text fields:
// - approach_text: Therapist's self-written description of their approach
// - who_comes_to_me: Free-text describing typical clients
// - session_focus: Free-text about session focus areas
// - first_session: Free-text about what to expect in first session
// - about_me: General bio/background text
// - qualification: Free-text qualification description
//
// Structured fields (current):
// - languages: Array of language codes
// - years_experience: Numeric years
// - practice_address: Structured address string
// ============================================================================

export const TherapistProfileSchema = z.object({
  /** @legacy Free-text therapist approach description from early onboarding */
  approach_text: z.string().optional(),
  /** @legacy Free-text describing typical clients */
  who_comes_to_me: z.string().optional(),
  /** @legacy Free-text about session focus areas */
  session_focus: z.string().optional(),
  /** @legacy Free-text about what to expect in first session */
  first_session: z.string().optional(),
  /** @legacy General bio/background text */
  about_me: z.string().optional(),
  /** Structured: Array of language codes (e.g., ['de', 'en']) */
  languages: z.array(z.string()).optional(),
  /** Structured: Numeric years of experience */
  years_experience: z.number().optional(),
  /** Structured: Practice address string */
  practice_address: z.string().optional(),
  /** @legacy Free-text qualification description */
  qualification: z.string().optional(),
});

// ============================================================================
// BOOKING SETTINGS (nested in metadata.booking_settings)
// ============================================================================

export const TherapistBookingSettingsSchema = z.object({
  /** When true, hides "Direkt buchen" / "Sitzung buchen" for users who haven't completed an intro */
  requires_intro_before_booking: z.boolean().optional(),
});

export type TherapistBookingSettings = z.infer<typeof TherapistBookingSettingsSchema>;

export type TherapistProfile = z.infer<typeof TherapistProfileSchema>;

// ============================================================================
// RAW DATABASE ROW (what Supabase returns)
// ============================================================================

export const TherapistRowSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  slug: z.string().nullable().optional(),
  city: z.string().nullable(),
  modalities: z.unknown().transform((v): string[] => 
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  ),
  schwerpunkte: z.unknown().transform((v): string[] => 
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  ),
  session_preferences: z.unknown().transform((v): string[] => 
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  ),
  accepting_new: z.boolean().nullable(),
  photo_url: z.string().nullable(),
  status: z.string().nullable(),
  metadata: z.unknown(),
  typical_rate: z.number().nullable().optional(),
  gender: z.string().nullable().optional(),
  // Cal.com integration fields
  cal_user_id: z.number().int().nullable().optional(),
  cal_username: z.string().nullable().optional(),
  cal_enabled: z.boolean().nullable().optional(),
  cal_bookings_live: z.boolean().nullable().optional(),
  languages: z.unknown().transform((v): string[] => 
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  ),
}).passthrough(); // Preserve unknown fields from DB to avoid silent data loss

export type TherapistRow = z.infer<typeof TherapistRowSchema>;

// ============================================================================
// AVAILABILITY SLOT
// ============================================================================

export const AvailabilitySlotSchema = z.object({
  date_iso: z.string(),
  time_label: z.string(),
  format: z.enum(['online', 'in_person']),
  address: z.string().optional(),
}).passthrough();

export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

// ============================================================================
// DISPLAY DATA (what components receive)
// ============================================================================

// EARTH-248: Next slot schema (cached from Cal.com) - used for both intro and full session
export const NextSlotSchema = z.object({
  date_iso: z.string(),      // YYYY-MM-DD in Europe/Berlin
  time_label: z.string(),    // HH:MM in Europe/Berlin  
  time_utc: z.string(),      // Full ISO timestamp
}).nullable();

// Alias for backward compatibility
export const NextIntroSlotSchema = NextSlotSchema;
export type NextIntroSlot = z.infer<typeof NextIntroSlotSchema>;
export type NextFullSlot = z.infer<typeof NextSlotSchema>;

export const TherapistDataSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
  slug: z.string().nullable().optional(),
  photo_url: z.string().optional(),
  modalities: z.array(z.string()),
  schwerpunkte: z.array(z.string()),
  session_preferences: z.array(z.string()),
  /** @legacy Free-text therapist approach description from early onboarding */
  approach_text: z.string(),
  accepting_new: z.boolean(),
  city: z.string(),
  languages: z.array(z.string()).optional(),
  typical_rate: z.number().nullable().optional(),
  metadata: z.object({
    profile: TherapistProfileSchema.optional(),
    booking_settings: TherapistBookingSettingsSchema.optional(),
  }).passthrough().optional(),
  availability: z.array(AvailabilitySlotSchema).optional(),
  // Cal.com integration fields
  cal_username: z.string().nullable().optional(),
  cal_enabled: z.boolean().nullable().optional(),
  cal_bookings_live: z.boolean().nullable().optional(),
  // EARTH-248: Pre-cached next slots for fast display
  next_intro_slot: NextIntroSlotSchema.optional(),
  next_full_slot: NextSlotSchema.optional(),
  // Booking gating: whether therapist requires intro before allowing full session booking
  requires_intro_before_booking: z.boolean().optional(),
  // Match-specific: whether this patient has completed an intro with this therapist
  has_completed_intro: z.boolean().optional(),
  // Admin-only fields
  gender: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
}).passthrough();

export type TherapistData = z.infer<typeof TherapistDataSchema>;

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const TherapistsApiResponseSchema = z.object({
  therapists: z.array(TherapistDataSchema),
}).passthrough();

export type TherapistsApiResponse = z.infer<typeof TherapistsApiResponseSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Parse and validate a therapist row from the database.
 * Throws if validation fails - use in server code where you want to catch bad data early.
 */
export function parseTherapistRow(data: unknown): TherapistRow {
  return TherapistRowSchema.parse(data);
}

/**
 * Safely parse a therapist row, returning null if invalid.
 * Use when you want to filter out invalid records instead of throwing.
 */
export function safeParseTherapistRow(data: unknown): TherapistRow | null {
  const result = TherapistRowSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Parse and validate therapist display data.
 * Use to validate data before passing to components.
 */
export function parseTherapistData(data: unknown): TherapistData {
  return TherapistDataSchema.parse(data);
}

/**
 * Validate an array of therapist rows.
 * In development: throws on first invalid row to catch schema mismatches early.
 * In production: logs errors and filters out invalid rows for resilience.
 */
export function parseTherapistRows(data: unknown[]): TherapistRow[] {
  return data
    .map((row, i) => {
      const result = TherapistRowSchema.safeParse(row);
      if (!result.success) {
        const errorMsg = `[therapist-contract] Invalid row at index ${i}: ${JSON.stringify(result.error.issues)}`;
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
          throw new Error(errorMsg);
        }
        console.error(errorMsg);
        return null;
      }
      return result.data;
    })
    .filter((row): row is TherapistRow => row !== null);
}

// ============================================================================
// SELECT COLUMNS (for consistent Supabase queries)
// ============================================================================

export const THERAPIST_SELECT_COLUMNS = 
  'id, first_name, last_name, slug, city, modalities, schwerpunkte, session_preferences, accepting_new, photo_url, status, metadata, typical_rate, cal_username, cal_enabled, cal_bookings_live, languages, created_at';

export const THERAPIST_SELECT_COLUMNS_WITH_GENDER = 
  THERAPIST_SELECT_COLUMNS + ', gender';
