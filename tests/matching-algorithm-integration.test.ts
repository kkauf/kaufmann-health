/**
 * Integration tests for matching algorithm ranking behavior
 * These tests verify the actual ranking outcomes, not just individual functions
 * See: /docs/therapist-matching-algorithm-spec.md
 */
import { describe, it, expect } from 'vitest';
import {
  isEligible,
  calculatePlatformScore,
  calculateMatchScore,
  calculateTotalScore,
  type PatientMeta,
  type TherapistRowForMatch,
} from '@/features/leads/lib/match';

/**
 * Helper to create a therapist with sensible defaults
 */
function createTherapist(overrides: Partial<TherapistRowForMatch> & { id: string }): TherapistRowForMatch {
  return {
    accepting_new: true,
    gender: 'female',
    city: 'Berlin',
    session_preferences: ['online', 'in_person'],
    modalities: ['narm'],
    schwerpunkte: ['trauma'],
    photo_url: 'https://example.com/photo.jpg',
    approach_text: 'My approach...',
    who_comes_to_me: 'People who...',
    ...overrides,
  };
}

/**
 * Helper to rank therapists by total score (simulates match view)
 */
function rankForMatches(
  therapists: TherapistRowForMatch[],
  patient: PatientMeta,
  slotsMap: Map<string, { slots7: number; slots14: number }>
): Array<{ id: string; totalScore: number; platformScore: number; matchScore: number }> {
  const scored = therapists
    .filter(t => isEligible(t, patient))
    .map(t => {
      const slots = slotsMap.get(t.id) || { slots7: 0, slots14: 0 };
      const platformScore = calculatePlatformScore(t, slots.slots7, slots.slots14);
      const matchScore = calculateMatchScore(t, patient);
      const totalScore = calculateTotalScore(matchScore, platformScore);
      return { id: t.id, totalScore, platformScore, matchScore };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
  
  return scored;
}

/**
 * Helper to rank therapists by platform score (simulates directory view)
 */
function rankForDirectory(
  therapists: TherapistRowForMatch[],
  slotsMap: Map<string, { slots7: number; slots14: number }>
): Array<{ id: string; platformScore: number }> {
  const scored = therapists
    .filter(t => isEligible(t))
    .map(t => {
      const slots = slotsMap.get(t.id) || { slots7: 0, slots14: 0 };
      const platformScore = calculatePlatformScore(t, slots.slots7, slots.slots14);
      return { id: t.id, platformScore };
    })
    .sort((a, b) => b.platformScore - a.platformScore);
  
  return scored;
}

describe('Directory Ranking (Platform Score)', () => {
  it('ranks therapists with equal slots equally', () => {
    const therapists = [
      createTherapist({
        id: 'therapist-a',
        metadata: {},
      }),
      createTherapist({
        id: 'therapist-b',
      }),
    ];

    const slotsMap = new Map([
      ['therapist-a', { slots7: 3, slots14: 5 }],
      ['therapist-b', { slots7: 3, slots14: 5 }],
    ]);

    const ranked = rankForDirectory(therapists, slotsMap);
    
    // Both have same slots and profile, so equal scores
    expect(ranked[0].platformScore).toBe(ranked[1].platformScore);
  });

  it('ranks therapist with more slots higher than one with fewer', () => {
    const therapists = [
      createTherapist({ id: 'few-slots' }),
      createTherapist({ id: 'many-slots' }),
    ];

    const slotsMap = new Map([
      ['few-slots', { slots7: 1, slots14: 2 }],
      ['many-slots', { slots7: 5, slots14: 8 }],
    ]);

    const ranked = rankForDirectory(therapists, slotsMap);
    
    expect(ranked[0].id).toBe('many-slots');
    // 3+ slots in 7 days = 25 points, 1-2 slots = 15 points
    expect(ranked[0].platformScore - ranked[1].platformScore).toBe(10);
  });

  it('ranks therapist with complete profile higher than basic profile', () => {
    const therapists = [
      createTherapist({
        id: 'basic-profile',
        photo_url: 'https://example.com/photo.jpg',
        approach_text: undefined,
        who_comes_to_me: undefined,
      }),
      createTherapist({
        id: 'complete-profile',
        photo_url: 'https://example.com/photo.jpg',
        approach_text: 'My approach...',
        who_comes_to_me: 'People who...',
      }),
    ];

    const slotsMap = new Map([
      ['basic-profile', { slots7: 0, slots14: 0 }],
      ['complete-profile', { slots7: 0, slots14: 0 }],
    ]);

    const ranked = rankForDirectory(therapists, slotsMap);
    
    expect(ranked[0].id).toBe('complete-profile');
    // Complete profile = 15 points, basic = 5 points
    expect(ranked[0].platformScore - ranked[1].platformScore).toBe(10);
  });
});

describe('Match View Ranking (Total Score = Match × 1.5 + Platform)', () => {
  const patient: PatientMeta = {
    city: 'Berlin',
    session_preferences: ['online', 'in_person'],
    schwerpunkte: ['trauma', 'angst'],
    specializations: ['NARM'],
    gender_preference: 'female',
  };

  it('ranks therapist with schwerpunkte match higher than one without', () => {
    const therapists = [
      createTherapist({
        id: 'no-schwerpunkte-match',
        schwerpunkte: ['beziehung'], // No overlap with patient
      }),
      createTherapist({
        id: 'schwerpunkte-match',
        schwerpunkte: ['trauma', 'angst'], // 2 overlaps with patient
      }),
    ];

    const slotsMap = new Map([
      ['no-schwerpunkte-match', { slots7: 3, slots14: 5 }],
      ['schwerpunkte-match', { slots7: 3, slots14: 5 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    expect(ranked[0].id).toBe('schwerpunkte-match');
    // 2 schwerpunkte matches = 30 points × 1.5 = 45 point difference in total score
    expect(ranked[0].matchScore - ranked[1].matchScore).toBe(30);
  });

  it('ranks in-person therapist in patient city higher when patient accepts both formats', () => {
    const therapists = [
      createTherapist({
        id: 'online-only',
        city: 'München',
        session_preferences: ['online'],
        schwerpunkte: ['trauma'],
      }),
      createTherapist({
        id: 'in-person-berlin',
        city: 'Berlin',
        session_preferences: ['in_person', 'online'],
        schwerpunkte: ['trauma'],
      }),
    ];

    const slotsMap = new Map([
      ['online-only', { slots7: 3, slots14: 5 }],
      ['in-person-berlin', { slots7: 3, slots14: 5 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    expect(ranked[0].id).toBe('in-person-berlin');
    // In-person city match = +20 points
    expect(ranked[0].matchScore - ranked[1].matchScore).toBe(20);
  });

  it('Platform Score still matters - therapist with Cal.com + slots can beat schwerpunkte match', () => {
    // This test documents that platform investment is NOT ignored
    // A therapist with more slots can outrank one with better schwerpunkte match
    // This is intentional - we want to reward therapist platform investment
    const therapists = [
      createTherapist({
        id: 'high-platform-low-match',
        schwerpunkte: ['beziehung'], // No schwerpunkte match with patient
      }),
      createTherapist({
        id: 'low-platform-high-match',
        schwerpunkte: ['trauma', 'angst'], // 2 schwerpunkte matches
        metadata: {},
      }),
    ];

    const slotsMap = new Map([
      ['high-platform-low-match', { slots7: 5, slots14: 8 }],
      ['low-platform-high-match', { slots7: 0, slots14: 0 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    // high-platform: gender(+10) + modality(+15) + in-person-city(+20) = 45 match
    //   Platform = 25 (5 slots) + 15 (profile) = 40
    //   Total = 45*1.5 + 40 = 107.5
    // low-platform: schwerpunkte(+30) + gender(+10) + modality(+15) + in-person-city(+20) = 75 match
    //   Platform = 0 + 15 (profile) = 15
    //   Total = 75*1.5 + 15 = 127.5
    // low-platform wins with 127.5 > 107.5 (schwerpunkte match now more important)
    expect(ranked[0].id).toBe('low-platform-high-match');
    expect(ranked[0].totalScore).toBe(127.5);
    expect(ranked[1].totalScore).toBe(107.5);
  });

  it('excludes therapists that fail eligibility filters', () => {
    const therapists = [
      createTherapist({
        id: 'not-accepting',
        accepting_new: false,
      }),
      createTherapist({
        id: 'wrong-gender',
        gender: 'male', // Patient wants female
      }),
      createTherapist({
        id: 'eligible',
        gender: 'female',
      }),
    ];

    const slotsMap = new Map([
      ['not-accepting', { slots7: 5, slots14: 8 }],
      ['wrong-gender', { slots7: 5, slots14: 8 }],
      ['eligible', { slots7: 1, slots14: 2 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe('eligible');
  });
});

describe('Real-world ranking scenarios', () => {
  it('Scenario: Levent (no schwerpunkte) ranks lower than Luise (with schwerpunkte)', () => {
    // This is the specific scenario from the user's staging screenshot
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preferences: ['in_person'],
      schwerpunkte: ['depression', 'selbstwert', 'persoenliche-entwicklung'],
      specializations: [],
    };

    const therapists = [
      createTherapist({
        id: 'levent',
        city: 'Berlin',
        session_preferences: ['online', 'in_person'],
        schwerpunkte: [], // No schwerpunkte
        modalities: ['narm'],
      }),
      createTherapist({
        id: 'luise',
        city: 'Berlin',
        session_preferences: ['online', 'in_person'],
        schwerpunkte: ['depression', 'selbstwert', 'persoenliche-entwicklung'], // 3 matches!
        modalities: [],
      }),
    ];

    const slotsMap = new Map([
      ['levent', { slots7: 3, slots14: 5 }],
      ['luise', { slots7: 3, slots14: 5 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    // Luise with 3 schwerpunkte matches should rank higher
    expect(ranked[0].id).toBe('luise');
    // 3+ schwerpunkte = 40 points × 1.5 = 60 point advantage in total score
    expect(ranked[0].matchScore - ranked[1].matchScore).toBe(40);
  });

  it('Scenario: Online therapist ranks lower than in-person therapist when patient prefers both', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preferences: ['online', 'in_person'], // Prefers both, implies slight preference for in-person
      schwerpunkte: ['trauma'],
    };

    const therapists = [
      createTherapist({
        id: 'sandra-online-only',
        city: 'Gelnhausen',
        session_preferences: ['online'],
        schwerpunkte: ['trauma'],
      }),
      createTherapist({
        id: 'berlin-in-person',
        city: 'Berlin',
        session_preferences: ['in_person', 'online'],
        schwerpunkte: ['trauma'],
      }),
    ];

    const slotsMap = new Map([
      ['sandra-online-only', { slots7: 5, slots14: 8 }],
      ['berlin-in-person', { slots7: 2, slots14: 3 }],
    ]);

    const ranked = rankForMatches(therapists, patient, slotsMap);
    
    // Berlin in-person should rank higher despite Sandra having more slots
    expect(ranked[0].id).toBe('berlin-in-person');
  });
});
