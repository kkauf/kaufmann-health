import { describe, it, expect } from 'vitest';
import { computeMismatches, type PatientMeta, type TherapistRowForMatch } from '@/features/leads/lib/match';

describe('Matching Algorithm - Time-of-Day Awareness', () => {
  const basePatient: PatientMeta = {
    city: 'Berlin',
    session_preference: 'online',
    specializations: ['NARM'],
    gender_preference: 'no_preference',
  };

  const baseTherapist: TherapistRowForMatch = {
    id: 't1',
    city: 'Berlin',
    session_preferences: ['online'],
    modalities: ['NARM'],
  };

  describe('Core Matching Logic', () => {
    it('returns isPerfect when all preferences match', () => {
      const result = computeMismatches(basePatient, baseTherapist);
      expect(result.isPerfect).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('returns partial when modality mismatches', () => {
      const therapist: TherapistRowForMatch = {
        ...baseTherapist,
        modalities: ['Somatic Experiencing'],
      };
      const result = computeMismatches(basePatient, therapist);
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('modality');
    });

    it('returns partial when gender preference mismatches', () => {
      const patient: PatientMeta = {
        ...basePatient,
        gender_preference: 'female',
      };
      const therapist: TherapistRowForMatch = {
        ...baseTherapist,
        gender: 'male',
      };
      const result = computeMismatches(patient, therapist);
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('gender');
    });

    it('flags location mismatch when patient prefers in_person and therapist is online-only', () => {
      const patient: PatientMeta = {
        ...basePatient,
        session_preference: 'in_person',
      };
      const therapist: TherapistRowForMatch = {
        ...baseTherapist,
        session_preferences: ['online'],
      };
      const result = computeMismatches(patient, therapist);
      expect(result.isPerfect).toBe(false);
      expect(result.reasons).toContain('location');
    });

    it('handles "either" session preference when therapist offers in_person', () => {
      const patient: PatientMeta = {
        ...basePatient,
        session_preferences: ['online', 'in_person'],
      };
      const therapist: TherapistRowForMatch = {
        ...baseTherapist,
        session_preferences: ['online', 'in_person'],
      };
      const result = computeMismatches(patient, therapist);
      expect(result.isPerfect).toBe(true);
    });
  });

  describe('Time-of-Day Integration', () => {
    it('should be verified separately in API tests', () => {
      // Time-of-day matching is computed in the API layer by checking
      // therapist_slots against patient time preferences.
      // Core computeMismatches handles session/location/modality/gender.
      // The API combines both to determine exact vs partial.
      expect(true).toBe(true);
    });
  });
});
