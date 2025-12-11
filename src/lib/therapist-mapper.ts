/**
 * Shared therapist data types and mapping utilities.
 * 
 * Consolidates the therapist row → display data transformation
 * so it's consistent across: directory, teaser, matches, admin.
 * 
 * Rule: if we touch this 3+ times, it belongs here.
 */

// Raw database row type (what Supabase returns)
export type TherapistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  modalities: unknown;
  schwerpunkte: unknown;
  session_preferences: unknown;
  accepting_new: boolean | null;
  photo_url: string | null;
  status: string | null;
  metadata: unknown;
  typical_rate?: number | null;
  gender?: string | null;
};

// Availability slot (returned from computeAvailability)
export type AvailabilitySlot = {
  date_iso: string;
  time_label: string;
  format: 'online' | 'in_person';
  address?: string;
};

// Structured profile fields from metadata.profile
export type TherapistProfile = {
  approach_text?: string;
  who_comes_to_me?: string;
  session_focus?: string;
  first_session?: string;
  about_me?: string;
  languages?: string[];
  years_experience?: number;
  practice_address?: string;
  qualification?: string;
};

// The unified therapist data shape used by all display components
export type TherapistData = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  schwerpunkte: string[];
  session_preferences: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  typical_rate?: number | null;
  metadata?: {
    profile?: TherapistProfile;
  };
  availability?: AvailabilitySlot[];
  // Admin-only fields
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

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
    metadata: Object.keys(cleanProfile).length > 0 ? { profile: cleanProfile } : undefined,
  };

  if (options?.availability) {
    result.availability = options.availability;
  }

  if (options?.includeAdminFields) {
    result.gender = row.gender;
    result.status = row.status;
  }

  return result;
}

/**
 * Standard select string for therapist queries.
 * Avoids duplicating the column list everywhere.
 */
export const THERAPIST_SELECT_COLUMNS = 
  'id, first_name, last_name, city, modalities, schwerpunkte, session_preferences, accepting_new, photo_url, status, metadata, typical_rate';

export const THERAPIST_SELECT_COLUMNS_WITH_GENDER = 
  THERAPIST_SELECT_COLUMNS + ', gender';
