/**
 * Tests for form_session data extraction logic (EARTH-XXX fix)
 * 
 * Bug context: On Jan 8, 2026, we discovered that city and session_preference
 * were NOT being extracted from form_sessions in the leads route, causing 
 * matches to fail with match_quality="none" even when therapists were available.
 * 
 * These tests verify the extraction logic is correct at a unit level.
 */
import { describe, it, expect } from 'vitest';

/**
 * Simulates the form_session extraction logic from leads route.
 * This mirrors the exact logic at lines 631-649 of leads/route.ts
 */
function extractFormSessionData(fsData: Record<string, unknown> | null) {
  let formSessionCity: string | undefined;
  let formSessionSessionPref: 'online' | 'in_person' | undefined;
  let formSessionSessionPrefs: ('online' | 'in_person')[] | undefined;
  let formSessionGenderPref: 'male' | 'female' | 'no_preference' | undefined;
  let formSessionSchwerpunkte: string[] | undefined;

  if (fsData) {
    // Extract city from form session (critical for matching)
    if (typeof fsData.city === 'string' && fsData.city.trim()) {
      formSessionCity = fsData.city.trim();
    }
    // Extract session preference from form session (critical for matching)
    const fsSp = fsData.session_preference;
    if (fsSp === 'online' || fsSp === 'in_person') {
      formSessionSessionPref = fsSp;
    } else if (fsSp === 'either' || fsSp === 'both') {
      formSessionSessionPrefs = ['online', 'in_person'];
    }
    // Convert German gender to English preference
    if (typeof fsData.gender === 'string') {
      const g = fsData.gender.toLowerCase();
      if (g.includes('mann')) formSessionGenderPref = 'male';
      else if (g.includes('frau')) formSessionGenderPref = 'female';
      else if (g.includes('keine') || g.includes('divers')) formSessionGenderPref = 'no_preference';
    }
    // Extract schwerpunkte
    if (Array.isArray(fsData.schwerpunkte)) {
      formSessionSchwerpunkte = fsData.schwerpunkte as string[];
    }
  }

  return {
    formSessionCity,
    formSessionSessionPref,
    formSessionSessionPrefs,
    formSessionGenderPref,
    formSessionSchwerpunkte,
  };
}

/**
 * Simulates the effective value computation (fallback chain)
 * This mirrors lines 645-649 of leads/route.ts
 */
function computeEffectiveValues(
  payload: {
    city?: string;
    session_preference?: 'online' | 'in_person';
    session_preferences?: ('online' | 'in_person')[];
    gender_preference?: 'male' | 'female' | 'no_preference';
  },
  formSession: ReturnType<typeof extractFormSessionData>
) {
  const effectiveCity = payload.city || formSession.formSessionCity;
  const effectiveSessionPref = payload.session_preference || formSession.formSessionSessionPref;
  const effectiveSessionPrefs = 
    (payload.session_preferences?.length ?? 0) > 0 
      ? payload.session_preferences 
      : (formSession.formSessionSessionPrefs || []);
  const effectiveGenderPref = payload.gender_preference || formSession.formSessionGenderPref;

  return { effectiveCity, effectiveSessionPref, effectiveSessionPrefs, effectiveGenderPref };
}

describe('Form Session Data Extraction Logic', () => {
  describe('extractFormSessionData', () => {
    it('extracts city from form_session', () => {
      const result = extractFormSessionData({ city: 'Berlin' });
      expect(result.formSessionCity).toBe('Berlin');
    });

    it('trims city whitespace', () => {
      const result = extractFormSessionData({ city: '  Munich  ' });
      expect(result.formSessionCity).toBe('Munich');
    });

    it('handles empty city string', () => {
      const result = extractFormSessionData({ city: '   ' });
      expect(result.formSessionCity).toBeUndefined();
    });

    it('extracts session_preference "online"', () => {
      const result = extractFormSessionData({ session_preference: 'online' });
      expect(result.formSessionSessionPref).toBe('online');
      expect(result.formSessionSessionPrefs).toBeUndefined();
    });

    it('extracts session_preference "in_person"', () => {
      const result = extractFormSessionData({ session_preference: 'in_person' });
      expect(result.formSessionSessionPref).toBe('in_person');
      expect(result.formSessionSessionPrefs).toBeUndefined();
    });

    it('converts "either" to session_preferences array', () => {
      const result = extractFormSessionData({ session_preference: 'either' });
      expect(result.formSessionSessionPref).toBeUndefined();
      expect(result.formSessionSessionPrefs).toEqual(['online', 'in_person']);
    });

    it('converts "both" to session_preferences array', () => {
      const result = extractFormSessionData({ session_preference: 'both' });
      expect(result.formSessionSessionPref).toBeUndefined();
      expect(result.formSessionSessionPrefs).toEqual(['online', 'in_person']);
    });

    it('converts German "Frau" to female', () => {
      const result = extractFormSessionData({ gender: 'Frau' });
      expect(result.formSessionGenderPref).toBe('female');
    });

    it('converts German "Mann" to male', () => {
      const result = extractFormSessionData({ gender: 'Mann' });
      expect(result.formSessionGenderPref).toBe('male');
    });

    it('converts "Keine Präferenz" to no_preference', () => {
      const result = extractFormSessionData({ gender: 'Keine Präferenz' });
      expect(result.formSessionGenderPref).toBe('no_preference');
    });

    it('converts "Divers/non-binär" to no_preference', () => {
      const result = extractFormSessionData({ gender: 'Divers/non-binär' });
      expect(result.formSessionGenderPref).toBe('no_preference');
    });

    it('extracts schwerpunkte array', () => {
      const result = extractFormSessionData({ schwerpunkte: ['trauma', 'angst'] });
      expect(result.formSessionSchwerpunkte).toEqual(['trauma', 'angst']);
    });

    it('handles null form_session data', () => {
      const result = extractFormSessionData(null);
      expect(result.formSessionCity).toBeUndefined();
      expect(result.formSessionSessionPref).toBeUndefined();
      expect(result.formSessionSessionPrefs).toBeUndefined();
      expect(result.formSessionGenderPref).toBeUndefined();
    });
  });

  describe('computeEffectiveValues', () => {
    it('uses form_session city when payload has none', () => {
      const formSession = extractFormSessionData({ city: 'Berlin' });
      const result = computeEffectiveValues({}, formSession);
      expect(result.effectiveCity).toBe('Berlin');
    });

    it('prefers payload city over form_session city', () => {
      const formSession = extractFormSessionData({ city: 'Berlin' });
      const result = computeEffectiveValues({ city: 'Munich' }, formSession);
      expect(result.effectiveCity).toBe('Munich');
    });

    it('uses form_session session_preference when payload has none', () => {
      const formSession = extractFormSessionData({ session_preference: 'in_person' });
      const result = computeEffectiveValues({}, formSession);
      expect(result.effectiveSessionPref).toBe('in_person');
    });

    it('prefers payload session_preference over form_session', () => {
      const formSession = extractFormSessionData({ session_preference: 'in_person' });
      const result = computeEffectiveValues({ session_preference: 'online' }, formSession);
      expect(result.effectiveSessionPref).toBe('online');
    });

    it('uses form_session session_preferences when payload has none', () => {
      const formSession = extractFormSessionData({ session_preference: 'either' });
      const result = computeEffectiveValues({}, formSession);
      expect(result.effectiveSessionPrefs).toEqual(['online', 'in_person']);
    });

    it('prefers payload session_preferences over form_session', () => {
      const formSession = extractFormSessionData({ session_preference: 'either' });
      const result = computeEffectiveValues({ session_preferences: ['online'] }, formSession);
      expect(result.effectiveSessionPrefs).toEqual(['online']);
    });

    it('uses form_session gender_preference when payload has none', () => {
      const formSession = extractFormSessionData({ gender: 'Frau' });
      const result = computeEffectiveValues({}, formSession);
      expect(result.effectiveGenderPref).toBe('female');
    });
  });

  describe('Real-world bug scenario (Jan 8, 2026)', () => {
    it('correctly extracts all critical fields from typical form_session', () => {
      // This simulates the exact data structure that caused the bug
      const formSessionData = {
        city: 'Berlin',
        session_preference: 'in_person',
        gender: 'Frau',
        schwerpunkte: ['trauma', 'selbstwert', 'entwicklung'],
        time_slots: ['Morgens (8-12 Uhr)', 'Nachmittags (12-17 Uhr)'],
        start_timing: 'Innerhalb der nächsten Woche',
      };

      const extracted = extractFormSessionData(formSessionData);
      
      // These are the critical fields that were missing before the fix
      expect(extracted.formSessionCity).toBe('Berlin');
      expect(extracted.formSessionSessionPref).toBe('in_person');
      expect(extracted.formSessionGenderPref).toBe('female');
      expect(extracted.formSessionSchwerpunkte).toEqual(['trauma', 'selbstwert', 'entwicklung']);
    });

    it('computes correct effective values when payload is minimal', () => {
      // SignupWizard only sends form_session_id, name, email in payload
      const formSessionData = {
        city: 'Berlin',
        session_preference: 'in_person',
        gender: 'Frau',
      };

      const extracted = extractFormSessionData(formSessionData);
      const effective = computeEffectiveValues({}, extracted);

      // All values should come from form_session
      expect(effective.effectiveCity).toBe('Berlin');
      expect(effective.effectiveSessionPref).toBe('in_person');
      expect(effective.effectiveGenderPref).toBe('female');
    });
  });
});
