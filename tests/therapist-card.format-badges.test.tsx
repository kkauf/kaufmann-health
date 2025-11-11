import { describe, it, expect } from 'vitest';

/**
 * EARTH-225: Test format badge derivation from availability vs session_preferences
 * 
 * Business rule: When slots exist, badges reflect actual slot formats.
 * When no slots exist, badges fall back to session_preferences (for message-only therapists).
 */

type Availability = { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[];

/**
 * Logic extracted from TherapistCard for testing
 */
function deriveFormatBadges(
  availability: Availability | undefined,
  session_preferences: string[]
): { offersOnline: boolean; offersInPerson: boolean } {
  const availabilityArr = availability || [];
  const hasSlots = Array.isArray(availabilityArr) && availabilityArr.length > 0;

  if (hasSlots) {
    // Derive from actual slot availability
    const hasOnlineSlots = availabilityArr.some(s => s.format === 'online');
    const hasInPersonSlots = availabilityArr.some(s => s.format === 'in_person');
    return {
      offersOnline: hasOnlineSlots,
      offersInPerson: hasInPersonSlots,
    };
  }

  // Fallback to session preferences when no slots available
  const normalizedPrefs = new Set(
    (Array.isArray(session_preferences) ? session_preferences : []).map(v =>
      String(v).toLowerCase().replace(/[\s-]+/g, '_')
    )
  );
  const hasEither = normalizedPrefs.has('either') || normalizedPrefs.has('both');
  return {
    offersOnline: normalizedPrefs.has('online') || hasEither,
    offersInPerson: normalizedPrefs.has('in_person') || normalizedPrefs.has('inperson') || hasEither,
  };
}

describe('TherapistCard format badges (EARTH-225)', () => {
  it('derives both badges when therapist has both online and in-person slots', () => {
    const result = deriveFormatBadges(
      [
        { date_iso: '2025-11-12', time_label: '10:00', format: 'online' },
        { date_iso: '2025-11-13', time_label: '14:00', format: 'in_person' },
      ],
      ['online', 'in_person']
    );

    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(true);
  });

  it('derives only online badge when therapist has only online slots', () => {
    const result = deriveFormatBadges(
      [
        { date_iso: '2025-11-12', time_label: '10:00', format: 'online' },
        { date_iso: '2025-11-13', time_label: '14:00', format: 'online' },
      ],
      ['online', 'in_person'] // session_preferences claims both, but only online slots exist
    );

    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(false);
  });

  it('derives only in-person badge when therapist has only in-person slots', () => {
    const result = deriveFormatBadges(
      [
        { date_iso: '2025-11-12', time_label: '10:00', format: 'in_person' },
        { date_iso: '2025-11-13', time_label: '14:00', format: 'in_person' },
      ],
      ['online', 'in_person'] // session_preferences claims both, but only in_person slots exist
    );

    expect(result.offersOnline).toBe(false);
    expect(result.offersInPerson).toBe(true);
  });

  it('falls back to session_preferences when no slots available', () => {
    const result = deriveFormatBadges(
      [], // No slots
      ['online', 'in_person']
    );

    // Should derive both formats based on session_preferences
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(true);
  });

  it('falls back to session_preferences when availability is undefined', () => {
    const result = deriveFormatBadges(
      undefined, // No availability data
      ['online']
    );

    // Should derive badge based on session_preferences
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(false);
  });

  it('handles "either" in session_preferences fallback', () => {
    const result = deriveFormatBadges(
      [], // No slots
      ['either']
    );

    // "either" should expand to both formats
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(true);
  });

  it('handles "both" in session_preferences fallback', () => {
    const result = deriveFormatBadges(
      [], // No slots
      ['both']
    );

    // "both" should expand to both formats
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(true);
  });

  it('derives no format badges when no slots and no session_preferences', () => {
    const result = deriveFormatBadges(
      [], // No slots
      [] // No preferences
    );

    expect(result.offersOnline).toBe(false);
    expect(result.offersInPerson).toBe(false);
  });

  it('normalizes session_preferences with spaces and hyphens in fallback', () => {
    const result = deriveFormatBadges(
      [], // No slots
      ['in person', 'online'] // Note the space (should normalize to in_person)
    );

    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(true);
  });

  it('prefers slot availability over mismatched session_preferences', () => {
    const result = deriveFormatBadges(
      [
        { date_iso: '2025-11-12', time_label: '10:00', format: 'online' },
      ],
      ['in_person'] // Claims in-person only, but has online slots
    );

    // Should derive only online (from slots), ignoring session_preferences
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(false);
  });

  it('ensures at least one format is derived for message-only therapists', () => {
    const result = deriveFormatBadges(
      [], // No booking slots (message-only)
      ['online'] // Still has preferences
    );

    // Should derive online badge from session_preferences
    expect(result.offersOnline).toBe(true);
    expect(result.offersInPerson).toBe(false);
  });
});
