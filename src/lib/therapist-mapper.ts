/**
 * Shared therapist data mapping utilities.
 * 
 * Types are defined in src/contracts/therapist.ts (single source of truth).
 * This module provides the mapping logic to transform raw DB rows to display data.
 * 
 * Rule: if we touch this 3+ times, it belongs here.
 */

// Import types for local use
import type {
  TherapistRow,
  TherapistData,
  TherapistProfile,
  AvailabilitySlot,
  NextIntroSlot,
  NextFullSlot,
} from '@/contracts/therapist';

// Re-export types and constants from contracts (single source of truth)
export {
  type TherapistRow,
  type TherapistData,
  type TherapistProfile,
  type AvailabilitySlot,
  TherapistRowSchema,
  TherapistDataSchema,
  parseTherapistRow,
  parseTherapistRows,
  parseTherapistData,
  safeParseTherapistRow,
  THERAPIST_SELECT_COLUMNS,
  THERAPIST_SELECT_COLUMNS_WITH_GENDER,
} from '@/contracts/therapist';

/**
 * Parse HIDE_THERAPIST_IDS env var into a Set
 */
export function getHiddenTherapistIds(): Set<string> {
  const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
  return new Set(
    hideIdsEnv
      ? hideIdsEnv.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  );
}

/**
 * Check if a therapist row should be hidden (via env or metadata.hidden)
 */
export function isTherapistHidden(row: TherapistRow, hideIds: Set<string>): boolean {
  if (hideIds.has(row.id)) return true;
  try {
    const md = (row.metadata || {}) as Record<string, unknown>;
    const hiddenVal: unknown = md['hidden'];
    return hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/**
 * Extract booking settings from raw metadata
 */
function extractBookingSettings(metadata: unknown): { requires_intro_before_booking?: boolean } {
  const mdObj: Record<string, unknown> = 
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const bookingSettingsUnknown = mdObj['booking_settings'];
  const bookingSettings: Record<string, unknown> = 
    bookingSettingsUnknown && typeof bookingSettingsUnknown === 'object' 
      ? (bookingSettingsUnknown as Record<string, unknown>) 
      : {};

  return {
    requires_intro_before_booking: typeof bookingSettings['requires_intro_before_booking'] === 'boolean' 
      ? bookingSettings['requires_intro_before_booking'] 
      : undefined,
  };
}

/**
 * Extract profile fields from raw metadata
 */
function extractProfile(metadata: unknown): TherapistProfile {
  const mdObj: Record<string, unknown> = 
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const profileUnknown = mdObj['profile'];
  const profile: Record<string, unknown> = 
    profileUnknown && typeof profileUnknown === 'object' ? (profileUnknown as Record<string, unknown>) : {};

  return {
    approach_text: typeof profile['approach_text'] === 'string' ? profile['approach_text'] : undefined,
    who_comes_to_me: typeof profile['who_comes_to_me'] === 'string' ? profile['who_comes_to_me'] : undefined,
    session_focus: typeof profile['session_focus'] === 'string' ? profile['session_focus'] : undefined,
    first_session: typeof profile['first_session'] === 'string' ? profile['first_session'] : undefined,
    about_me: typeof profile['about_me'] === 'string' ? profile['about_me'] : undefined,
    languages: Array.isArray(profile['languages']) ? (profile['languages'] as string[]) : undefined,
    years_experience: typeof profile['years_experience'] === 'number' ? profile['years_experience'] : undefined,
    practice_address: typeof profile['practice_address'] === 'string' ? profile['practice_address'] : undefined,
    qualification: typeof profile['qualification'] === 'string' ? profile['qualification'] : undefined,
  };
}

/**
 * Map a raw therapist row to the unified TherapistData shape.
 * Used by: public API, landing helpers, admin API, matches.
 */
export function mapTherapistRow(
  row: TherapistRow,
  options?: {
    availability?: AvailabilitySlot[];
    includeAdminFields?: boolean;
    /** EARTH-248: Pre-cached next intro slot from cal_slots_cache */
    nextIntroSlot?: NextIntroSlot;
    /** Pre-cached next full-session slot from cal_slots_cache */
    nextFullSlot?: NextFullSlot;
  }
): TherapistData {
  const profile = extractProfile(row.metadata);
  // Legacy: approach_text was stored in metadata.profile.approach_text
  const approach_text = profile.approach_text || '';

  // Build clean profile object (only include fields that have values)
  const cleanProfile: TherapistProfile = {};
  if (profile.who_comes_to_me) cleanProfile.who_comes_to_me = profile.who_comes_to_me;
  if (profile.session_focus) cleanProfile.session_focus = profile.session_focus;
  if (profile.first_session) cleanProfile.first_session = profile.first_session;
  if (profile.about_me) cleanProfile.about_me = profile.about_me;
  if (profile.languages && profile.languages.length > 0) cleanProfile.languages = profile.languages;
  if (typeof profile.years_experience === 'number') cleanProfile.years_experience = profile.years_experience;
  if (profile.practice_address) cleanProfile.practice_address = profile.practice_address;
  if (profile.qualification) cleanProfile.qualification = profile.qualification;

  // Languages: prefer top-level column, fallback to metadata.profile.languages
  const languages = Array.isArray(row.languages) && row.languages.length > 0
    ? row.languages
    : (profile.languages && profile.languages.length > 0 ? profile.languages : undefined);

  // Extract booking settings from metadata
  const bookingSettings = extractBookingSettings(row.metadata);

  const result: TherapistData = {
    id: row.id,
    first_name: String(row.first_name || ''),
    last_name: String(row.last_name || ''),
    city: String(row.city || ''),
    modalities: Array.isArray(row.modalities) ? (row.modalities as string[]) : [],
    schwerpunkte: Array.isArray(row.schwerpunkte) ? (row.schwerpunkte as string[]) : [],
    session_preferences: Array.isArray(row.session_preferences) ? (row.session_preferences as string[]) : [],
    accepting_new: Boolean(row.accepting_new),
    photo_url: row.photo_url || undefined,
    approach_text,
    typical_rate: row.typical_rate,
    languages,
    metadata: Object.keys(cleanProfile).length > 0 ? { profile: cleanProfile } : undefined,
    // Cal.com integration
    cal_username: row.cal_username || undefined,
    cal_enabled: row.cal_enabled || false,
    cal_bookings_live: row.cal_bookings_live || false,
    // Booking gating
    requires_intro_before_booking: bookingSettings.requires_intro_before_booking,
  };

  if (options?.availability) {
    result.availability = options.availability;
  }

  // EARTH-248: Include cached next slots
  if (options?.nextIntroSlot) {
    result.next_intro_slot = options.nextIntroSlot;
  }
  if (options?.nextFullSlot) {
    result.next_full_slot = options.nextFullSlot;
  }

  if (options?.includeAdminFields) {
    result.gender = row.gender;
    result.status = row.status;
  }

  return result;
}

