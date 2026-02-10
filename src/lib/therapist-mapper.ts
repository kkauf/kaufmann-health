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
 * Check if a therapist row should be hidden from public views.
 * Hidden when:
 * - Listed in HIDE_THERAPIST_IDS env var
 * - metadata.hidden is true
 * - metadata.is_test is true (test accounts created on staging/localhost or with +test email)
 */
export function isTherapistHidden(row: TherapistRow, hideIds: Set<string>): boolean {
  if (hideIds.has(row.id)) return true;
  try {
    const md = (row.metadata || {}) as Record<string, unknown>;
    const hiddenVal: unknown = md['hidden'];
    if (hiddenVal === true || String(hiddenVal).toLowerCase() === 'true') {
      return true;
    }
    // Hide test accounts from public views (created on staging/localhost or with +test email)
    const isTestVal: unknown = md['is_test'];
    if (isTestVal === true || String(isTestVal).toLowerCase() === 'true') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a therapist row has a complete public profile.
 * Mirrors the portal's completeness check (EditProfileForm.tsx) but runs server-side.
 * Used by: directory API, landing page helpers, match results.
 */
const MIN_PROFILE_CHARS = 50;

export function hasCompleteProfile(row: TherapistRow): boolean {
  const profile = extractProfile(row.metadata);

  const hasRequiredText =
    (profile.who_comes_to_me?.length ?? 0) >= MIN_PROFILE_CHARS &&
    (profile.session_focus?.length ?? 0) >= MIN_PROFILE_CHARS &&
    (profile.first_session?.length ?? 0) >= MIN_PROFILE_CHARS;
  const hasPhoto = Boolean(row.photo_url);
  const hasRate = typeof row.typical_rate === 'number' && row.typical_rate > 0;
  const hasSchwerpunkte = Array.isArray(row.schwerpunkte) && row.schwerpunkte.length >= 1;
  const hasSessionFormat = Array.isArray(row.session_preferences) && row.session_preferences.length >= 1;

  return hasRequiredText && hasPhoto && hasRate && hasSchwerpunkte && hasSessionFormat;
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
  // @legacy: approach_text was populated during early onboarding via free-text input.
  // Still displayed in emails and profiles but should be considered legacy data.
  // See src/contracts/therapist.ts for full list of legacy fields.
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

  // Derive professional title and service descriptor based on credential tier
  const credentialTier = row.credential_tier || 'licensed';
  const primaryModality = Array.isArray(row.modalities) && row.modalities.length > 0 ? row.modalities[0] : null;

  const MODALITY_LABELS: Record<string, string> = {
    'narm': 'NARM',
    'somatic-experiencing': 'Somatic Experiencing',
    'hakomi': 'Hakomi',
    'core-energetics': 'Core Energetics',
  };
  const primaryModalityLabel = primaryModality ? (MODALITY_LABELS[primaryModality] || primaryModality) : null;

  let professional_title: string | undefined;
  let service_descriptor: string | undefined;

  if (credentialTier === 'certified') {
    professional_title = primaryModalityLabel
      ? `Zertifizierte/r ${primaryModalityLabel}-Therapeut:in`
      : profile.qualification || 'Zertifizierte/r Therapeut:in';
    service_descriptor = primaryModalityLabel
      ? `Körpertherapeutische Begleitung · ${primaryModalityLabel}`
      : 'Körpertherapeutische Begleitung';
  } else {
    // Licensed tier: use qualification as-is
    professional_title = profile.qualification || undefined;
    service_descriptor = primaryModalityLabel
      ? `Körperpsychotherapie · ${primaryModalityLabel}`
      : 'Körperpsychotherapie';
  }

  const result: TherapistData = {
    id: row.id,
    first_name: String(row.first_name || ''),
    last_name: String(row.last_name || ''),
    slug: row.slug || undefined,
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
    credential_tier: row.credential_tier || 'licensed',
    professional_title,
    service_descriptor,
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

