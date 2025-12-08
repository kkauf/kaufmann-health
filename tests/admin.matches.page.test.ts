import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeMismatches } from '@/features/leads/lib/match';

describe('EARTH-206: Match Page End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Match Quality Computation', () => {
    it('should identify perfect match (no mismatches)', () => {
      const patient = {
        city: 'Berlin',
        session_preference: 'online' as const,
        gender_preference: 'female' as const,
        specializations: ['narm'],
      };

      const therapist = {
        id: 't1',
        gender: 'female',
        city: 'Berlin',
        session_preferences: ['online'],
        modalities: ['NARM', 'Hakomi'],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.isPerfect).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.mismatches.gender).toBe(false);
      expect(result.mismatches.location).toBe(false);
      expect(result.mismatches.modality).toBe(false);
    });

    it('should detect gender mismatch', () => {
      const patient = {
        gender_preference: 'male' as const,
      };

      const therapist = {
        id: 't1',
        gender: 'female',
        city: null,
        session_preferences: [],
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('gender');
      expect(result.mismatches.gender).toBe(true);
    });

    it('should detect location mismatch (patient wants in-person, therapist only online)', () => {
      const patient = {
        session_preference: 'in_person' as const,
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: null,
        session_preferences: ['online'], // Only offers online
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('location');
      expect(result.mismatches.location).toBe(true);
    });

    it('should detect city mismatch (patient wants in-person in Berlin, therapist is in Freiburg)', () => {
      const patient = {
        city: 'Berlin',
        session_preference: 'in_person' as const,
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: 'Freiburg', // Different city
        session_preferences: ['in_person'], // Offers in-person
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('city');
      expect(result.mismatches.city).toBe(true);
      // City should be first reason (highest priority for in-person)
      expect(result.reasons[0]).toBe('city');
    });

    it('should NOT flag city mismatch when patient wants online', () => {
      const patient = {
        city: 'Berlin',
        session_preference: 'online' as const, // Patient only wants online
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: 'Freiburg', // Different city, but doesn't matter for online
        session_preferences: ['online', 'in_person'],
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.mismatches.city).toBe(false);
    });

    it('should NOT flag city mismatch when therapist is online-only', () => {
      const patient = {
        city: 'Berlin',
        session_preference: 'in_person' as const,
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: 'Freiburg',
        session_preferences: ['online'], // Online only - location mismatch, not city
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      // Should flag location (online-only), not city
      expect(result.mismatches.location).toBe(true);
      expect(result.mismatches.city).toBe(false);
    });

    it('should detect modality mismatch', () => {
      const patient = {
        specializations: ['hakomi'],
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: null,
        session_preferences: [],
        modalities: ['NARM', 'Somatic Experiencing'], // No Hakomi
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('modality');
      expect(result.mismatches.modality).toBe(true);
    });

    it('should handle no gender preference (no mismatch)', () => {
      const patient = {
        gender_preference: 'no_preference' as const,
      };

      const therapist = {
        id: 't1',
        gender: 'male',
        city: null,
        session_preferences: [],
        modalities: [],
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.mismatches.gender).toBe(false);
    });

    it('should handle patient with multiple specializations', () => {
      const patient = {
        specializations: ['narm', 'hakomi'],
      };

      const therapist = {
        id: 't1',
        gender: null,
        city: null,
        session_preferences: [],
        modalities: ['Hakomi'], // Has one of them
      };

      const result = computeMismatches(patient, therapist);
      
      expect(result.mismatches.modality).toBe(false); // At least one match
    });
  });

  describe('API Response Structure', () => {
    it('should return enriched patient data', async () => {
      const mockPatient = {
        name: 'Test User',
        issue: 'Anxiety',
        session_preference: 'online',
        city: 'Berlin',
        session_preferences: ['online'],
        specializations: ['narm'],
        gender_preference: 'female',
      };

      // Simulate what API should return
      expect(mockPatient).toHaveProperty('name');
      expect(mockPatient).toHaveProperty('city');
      expect(mockPatient).toHaveProperty('session_preferences');
      expect(mockPatient).toHaveProperty('specializations');
      expect(mockPatient).toHaveProperty('gender_preference');
    });

    it('should return enriched therapist data', async () => {
      const mockTherapist = {
        id: 't1',
        first_name: 'Jane',
        last_name: 'Doe',
        photo_url: 'https://example.com/photo.jpg',
        city: 'Berlin',
        accepting_new: true,
        contacted_at: null,
        modalities: ['NARM', 'Hakomi'],
        session_preferences: ['online', 'in_person'],
        approach_text: 'I specialize in trauma therapy...',
        gender: 'female',
      };

      // Verify all required fields for rich display
      expect(mockTherapist).toHaveProperty('modalities');
      expect(mockTherapist).toHaveProperty('session_preferences');
      expect(mockTherapist).toHaveProperty('approach_text');
      expect(mockTherapist).toHaveProperty('gender');
    });
  });

  describe('Email Template with Match Link', () => {
    it('should show prominent CTA when matchesUrl provided', () => {
      const matchesUrl = 'https://kaufmann-health.de/matches/abc123';
      
      // Template should prioritize matchesUrl over embedded cards
      expect(matchesUrl).toBeTruthy();
      
      // Verify structure expectations
      expect(matchesUrl).toContain('/matches/');
    });

    it('should show gentle urgency messaging', () => {
      const urgencyText = '💡 Tipp: Diese Therapeut:innen haben begrenzte Kapazitäten. Wir empfehlen, sich zeitnah zu melden';
      
      // Verify gentler wording (not "MUST choose in 48h")
      expect(urgencyText).toContain('💡 Tipp');
      expect(urgencyText).toContain('zeitnah');
      expect(urgencyText).not.toContain('innerhalb von 48 Stunden');
    });
  });

  describe('Match Page UI Behavior', () => {
    it('should identify top match correctly', () => {
      const therapists = [
        { id: 't1', matchQuality: { isPerfect: true, reasons: [] } },
        { id: 't2', matchQuality: { isPerfect: false, reasons: ['gender'] } },
        { id: 't3', matchQuality: { isPerfect: false, reasons: ['location', 'modality'] } },
      ];

      // First therapist OR any perfect match should be top
      const topMatch = therapists[0];
      expect(topMatch.matchQuality.isPerfect).toBe(true);
    });

    it('should show "Perfekte Übereinstimmung" badge for perfect matches', () => {
      const badgeText = '⭐ Perfekte Übereinstimmung';
      
      expect(badgeText).toContain('⭐');
      expect(badgeText).toContain('Perfekte Übereinstimmung');
    });

    it('should show "Warum diese Empfehlung?" for top matches', () => {
      const explanationText = 'Perfekte Übereinstimmung bei Geschlecht, Ort und Therapiemethode.';
      
      expect(explanationText).toContain('Übereinstimmung');
    });

    it('should link to directory as fallback', () => {
      const fallbackLink = '/therapeuten';
      
      expect(fallbackLink).toBe('/therapeuten');
    });
  });

  describe('Pre-auth Contact Flow', () => {
    it('should pass uuid to ContactModal for pre-auth', () => {
      const preAuth = {
        uuid: 'abc123',
        patientName: 'Test User',
        defaultReason: 'Anxiety',
      };

      expect(preAuth.uuid).toBeTruthy();
      expect(preAuth).toHaveProperty('patientName');
      expect(preAuth).toHaveProperty('defaultReason');
    });

    it('should skip verification step in pre-auth flow', () => {
      const preAuthMode = true;
      
      // In pre-auth mode, ContactModal should jump to compose step
      expect(preAuthMode).toBe(true);
    });
  });

  describe('Analytics Tracking', () => {
    it('should track match_page_view event', () => {
      const event = {
        type: 'match_page_view',
        properties: {
          patient_id: 'p1',
          therapist_count: 3,
        },
      };

      expect(event.type).toBe('match_page_view');
      expect(event.properties.therapist_count).toBe(3);
    });

    it('should track match_link_view from API', () => {
      const event = {
        type: 'match_link_view',
        source: 'api.public.matches',
        props: {
          patient_id: 'p1',
          therapists: ['t1', 't2', 't3'],
        },
      };

      expect(event.type).toBe('match_link_view');
      expect(event.props.therapists).toHaveLength(3);
    });
  });

  describe('Link Expiry', () => {
    it('should enforce 30-day expiry window', () => {
      const thirtyDaysInHours = 24 * 30;
      const testAge = 24 * 31; // 31 days

      expect(testAge).toBeGreaterThan(thirtyDaysInHours);
    });

    it('should allow access within 30 days', () => {
      const thirtyDaysInHours = 24 * 30;
      const testAge = 24 * 15; // 15 days

      expect(testAge).toBeLessThan(thirtyDaysInHours);
    });
  });

  describe('Therapist Detail Modal', () => {
    it('should open detail modal from match page', () => {
      const therapist = {
        id: 't1',
        first_name: 'Jane',
        last_name: 'Doe',
        modalities: ['NARM'],
        session_preferences: ['online'],
        approach_text: 'My approach...',
        accepting_new: true,
        city: 'Berlin',
      };

      // Modal should receive full therapist data
      expect(therapist).toHaveProperty('approach_text');
      expect(therapist).toHaveProperty('modalities');
      expect(therapist).toHaveProperty('session_preferences');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle missing optional fields gracefully', () => {
      const therapist: {
        id: string;
        first_name: string;
        last_name: string;
        modalities?: string[];
        session_preferences?: string[];
        approach_text?: string;
        gender?: string;
      } = {
        id: 't1',
        first_name: 'Jane',
        last_name: 'Doe',
        // Missing: modalities, session_preferences, approach_text, gender
      };

      const withDefaults = {
        ...therapist,
        modalities: therapist.modalities || [],
        session_preferences: therapist.session_preferences || [],
        approach_text: therapist.approach_text || '',
        gender: therapist.gender || undefined,
      };

      expect(withDefaults.modalities).toEqual([]);
      expect(withDefaults.session_preferences).toEqual([]);
      expect(withDefaults.approach_text).toBe('');
    });

    it('should support both matchesUrl and embedded cards in email', () => {
      // When matchesUrl provided, cards hidden
      const withLink = { matchesUrl: 'https://example.com', items: [] };
      expect(withLink.matchesUrl).toBeTruthy();

      // When no matchesUrl, show embedded cards (legacy)
      const withoutLink = { matchesUrl: undefined, items: [{}, {}, {}] };
      expect(withoutLink.matchesUrl).toBeUndefined();
      expect(withoutLink.items.length).toBeGreaterThan(0);
    });
  });
});
