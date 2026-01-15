/**
 * Tests for the new matching algorithm
 * See: /docs/therapist-matching-algorithm-spec.md
 */
import { describe, it, expect } from 'vitest';
import {
  isEligible,
  calculatePlatformScore,
  calculateMatchScore,
  calculateTotalScore,
  hasFullCalComJourney,
  computeMismatches,
  type PatientMeta,
  type TherapistRowForMatch,
} from '@/features/leads/lib/match';

describe('Eligibility (Hard Filters)', () => {
  it('E2: rejects therapist not accepting new clients', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      accepting_new: false,
    };
    expect(isEligible(therapist)).toBe(false);
  });

  it('E3: rejects therapist hidden from directory', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      accepting_new: true,
      metadata: { hide_from_directory: true },
    };
    expect(isEligible(therapist)).toBe(false);
  });

  it('E4: rejects gender mismatch when patient specifies', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      gender: 'male',
      accepting_new: true,
    };
    const patient: PatientMeta = {
      gender_preference: 'female',
    };
    expect(isEligible(therapist, patient)).toBe(false);
  });

  it('E4: accepts any gender when patient says "any"', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      gender: 'male',
      accepting_new: true,
    };
    const patient: PatientMeta = {
      gender_preference: 'any',
    };
    expect(isEligible(therapist, patient)).toBe(true);
  });

  it('E5: rejects format mismatch when patient wants only online', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      accepting_new: true,
      session_preferences: ['in_person'],
    };
    const patient: PatientMeta = {
      session_preferences: ['online'],
    };
    expect(isEligible(therapist, patient)).toBe(false);
  });

  it('E5: accepts when patient wants both formats', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      accepting_new: true,
      session_preferences: ['online'],
    };
    const patient: PatientMeta = {
      session_preferences: ['online', 'in_person'],
    };
    expect(isEligible(therapist, patient)).toBe(true);
  });
});

describe('Platform Score', () => {
  it('P1: 3+ slots + complete profile = 40', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      photo_url: 'https://example.com/photo.jpg',
      approach_text: 'My approach...',
      who_comes_to_me: 'People who...',
      city: 'Berlin',
    };
    // 25 (3+ slots in 7 days) + 15 (complete profile) = 40
    expect(calculatePlatformScore(therapist, 4, 4)).toBe(40);
  });

  it('P2: No intake slots + complete profile = 15', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      photo_url: 'https://example.com/photo.jpg',
      approach_text: 'My approach...',
      who_comes_to_me: 'People who...',
      city: 'Berlin',
    };
    // 0 (no slots) + 15 (complete profile) = 15
    expect(calculatePlatformScore(therapist, 0, 0)).toBe(15);
  });

  it('P3: No Cal.com, basic profile only = 5', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      photo_url: 'https://example.com/photo.jpg',
      city: 'Berlin',
    };
    // 0 (no Cal.com) + 0 (no slots) + 5 (basic profile) = 5
    expect(calculatePlatformScore(therapist, 0, 0)).toBe(5);
  });

  it('P4: Intake slots in 14-day fallback = 10', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      photo_url: 'https://example.com/photo.jpg',
      city: 'Berlin',
    };
    // 0 (no Cal.com) + 10 (14-day fallback) + 5 (basic profile) = 15
    expect(calculatePlatformScore(therapist, 0, 2)).toBe(15);
  });

  it('hasFullCalComJourney: requires both event types', () => {
    expect(hasFullCalComJourney({
      id: '1',
      metadata: { cal_username: 'test', cal_event_types: ['intake'] },
    })).toBe(false);
    
    expect(hasFullCalComJourney({
      id: '1',
      metadata: { cal_username: 'test', cal_event_types: ['intake', 'session'] },
    })).toBe(true);
    
    expect(hasFullCalComJourney({
      id: '1',
      metadata: { cal_username: 'test', cal_event_types: ['kennenlernen', 'sitzung'] },
    })).toBe(true);
  });
});

describe('Match Score', () => {
  it('M1: Perfect schwerpunkte match (2 overlaps) = 30', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      schwerpunkte: ['trauma', 'angst'],
    };
    const patient: PatientMeta = {
      schwerpunkte: ['trauma', 'angst', 'depression'],
    };
    // 30 (2 schwerpunkte overlaps)
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(30);
  });

  it('M2: No schwerpunkte overlap = 0 (but not excluded)', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      schwerpunkte: ['beziehung'],
    };
    const patient: PatientMeta = {
      schwerpunkte: ['trauma'],
    };
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(0);
  });

  it('M3: In-person city bonus when patient accepts both = +20', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      city: 'Berlin',
      session_preferences: ['in_person', 'online'],
    };
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preferences: ['online', 'in_person'],
    };
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(20);
  });

  it('M4: Online-only therapist when patient accepts both = no city bonus', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      city: 'Berlin',
      session_preferences: ['online'],
    };
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preferences: ['online', 'in_person'],
    };
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(0);
  });

  it('Modality overlap = +15', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      modalities: ['narm', 'hakomi'],
    };
    const patient: PatientMeta = {
      specializations: ['NARM'],
    };
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(15);
  });

  it('Gender match bonus = +10', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      gender: 'female',
    };
    const patient: PatientMeta = {
      gender_preference: 'female',
    };
    const score = calculateMatchScore(therapist, patient);
    expect(score).toBe(10);
  });
});

describe('Total Score and Ranking', () => {
  it('R2: Match view weights Match Score 1.5x', () => {
    // Therapist A: Match 80, Platform 30 → Total = 150
    expect(calculateTotalScore(80, 30)).toBe(150);
    
    // Therapist B: Match 40, Platform 70 → Total = 130
    expect(calculateTotalScore(40, 70)).toBe(130);
  });

  it('R3: Platform Score as tiebreaker', () => {
    // Same match score, different platform
    // A: Match 60, Platform 50 → Total = 140
    // B: Match 60, Platform 40 → Total = 130
    expect(calculateTotalScore(60, 50)).toBe(140);
    expect(calculateTotalScore(60, 40)).toBe(130);
  });
});

describe('computeMismatches', () => {
  it('calculates schwerpunkte overlap correctly', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      schwerpunkte: ['trauma', 'angst', 'depression'],
    };
    const patient: PatientMeta = {
      schwerpunkte: ['trauma', 'angst'],
    };
    const result = computeMismatches(patient, therapist);
    expect(result.schwerpunkteOverlap).toBe(2);
    expect(result.mismatches.schwerpunkte).toBe(false);
  });

  it('flags schwerpunkte mismatch when no overlap', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      schwerpunkte: ['beziehung'],
    };
    const patient: PatientMeta = {
      schwerpunkte: ['trauma'],
    };
    const result = computeMismatches(patient, therapist);
    expect(result.schwerpunkteOverlap).toBe(0);
    expect(result.mismatches.schwerpunkte).toBe(true);
  });

  it('does not flag schwerpunkte mismatch when patient has none', () => {
    const therapist: TherapistRowForMatch = {
      id: '1',
      schwerpunkte: ['beziehung'],
    };
    const patient: PatientMeta = {};
    const result = computeMismatches(patient, therapist);
    expect(result.mismatches.schwerpunkte).toBe(false);
  });
});
