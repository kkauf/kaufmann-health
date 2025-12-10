/**
 * Critical tests for patient-therapist matching logic
 * These tests ensure preferences are respected correctly
 */
import { describe, it, expect } from 'vitest';
import { computeMismatches, type PatientMeta, type TherapistRowForMatch } from '@/features/leads/lib/match';

describe('computeMismatches - Gender Preference', () => {
  it('detects gender mismatch when patient wants female but therapist is male', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-1',
      gender: 'male',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(true);
    expect(result.isPerfect).toBe(false);
    expect(result.reasons).toContain('gender');
  });

  it('no gender mismatch when patient wants female and therapist is female', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-2',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['hakomi'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(false);
    expect(result.isPerfect).toBe(true);
    expect(result.reasons).not.toContain('gender');
  });

  it('no gender mismatch when patient has no preference', () => {
    const patient: PatientMeta = {
      gender_preference: 'no_preference',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-3',
      gender: 'male',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(false);
  });

  it('no gender mismatch when patient gender_preference is undefined', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-4',
      gender: 'male',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(false);
  });
});

describe('computeMismatches - City/Location', () => {
  it('detects city mismatch when patient wants in_person only and cities differ', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-5',
      gender: 'female',
      city: 'Freiburg',
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.city).toBe(true);
    expect(result.isPerfect).toBe(false);
    expect(result.reasons).toContain('city');
  });

  it('no city mismatch when cities match', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-6',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['hakomi'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.city).toBe(false);
    expect(result.isPerfect).toBe(true);
  });

  it('detects location mismatch when patient wants in_person but therapist is online only', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-7',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['online'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.location).toBe(true);
    expect(result.isPerfect).toBe(false);
  });
});

describe('computeMismatches - Combined Preferences (Johanna scenario)', () => {
  // This test replicates the exact bug scenario with Johanna
  it('female Berlin in_person patient should match female Berlin in_person therapist', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    
    // This is a Berlin female therapist - should be PERFECT match
    const berlinFemale: TherapistRowForMatch = {
      id: 'berlin-female',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person', 'online'],
      modalities: ['hakomi'],
    };

    const result = computeMismatches(patient, berlinFemale);
    
    expect(result.mismatches.gender).toBe(false);
    expect(result.mismatches.city).toBe(false);
    expect(result.mismatches.location).toBe(false);
    expect(result.mismatches.modality).toBe(false);
    expect(result.isPerfect).toBe(true);
  });

  it('female Berlin in_person patient should NOT perfectly match male Berlin therapist', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    
    // Male therapist - should have gender mismatch
    const berlinMale: TherapistRowForMatch = {
      id: 'berlin-male',
      gender: 'male',
      city: 'Berlin',
      session_preferences: ['in_person', 'online'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, berlinMale);
    
    expect(result.mismatches.gender).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('female Berlin in_person patient should NOT perfectly match female Freiburg therapist', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
    };
    
    // Wrong city - should have city mismatch
    const freiburgFemale: TherapistRowForMatch = {
      id: 'freiburg-female',
      gender: 'female',
      city: 'Freiburg',
      session_preferences: ['in_person', 'online'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, freiburgFemale);
    
    expect(result.mismatches.city).toBe(true);
    expect(result.isPerfect).toBe(false);
  });
});

describe('Gender preference conversion (German to English)', () => {
  // These test the conversion logic that should happen in the leads API
  
  function convertGermanGender(german: string): 'male' | 'female' | 'no_preference' | undefined {
    const g = german.toLowerCase();
    if (g.includes('mann')) return 'male';
    if (g.includes('frau')) return 'female';
    if (g.includes('keine') || g.includes('divers')) return 'no_preference';
    return undefined;
  }

  it('converts "Frau" to "female"', () => {
    expect(convertGermanGender('Frau')).toBe('female');
  });

  it('converts "Mann" to "male"', () => {
    expect(convertGermanGender('Mann')).toBe('male');
  });

  it('converts "Keine Präferenz" to "no_preference"', () => {
    expect(convertGermanGender('Keine Präferenz')).toBe('no_preference');
  });

  it('converts "Divers/non-binär" to "no_preference"', () => {
    expect(convertGermanGender('Divers/non-binär')).toBe('no_preference');
  });
});

describe('computeMismatches - Modality/Specialization', () => {
  it('detects modality mismatch when patient wants NARM but therapist only has Hakomi', () => {
    const patient: PatientMeta = {
      specializations: ['narm'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-mod-1',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['hakomi'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.modality).toBe(true);
    expect(result.isPerfect).toBe(false);
    expect(result.reasons).toContain('modality');
  });

  it('no modality mismatch when therapist has one of patient requested modalities', () => {
    const patient: PatientMeta = {
      specializations: ['narm', 'hakomi'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-mod-2',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['hakomi', 'core-energetics'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.modality).toBe(false);
  });

  it('no modality mismatch when patient has no modality preference', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
      // No specializations - patient doesn't care about modality
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-mod-3',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.modality).toBe(false);
  });

  it('normalizes modality names for comparison (handles dashes, spaces, case)', () => {
    const patient: PatientMeta = {
      specializations: ['Somatic Experiencing'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-mod-4',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['somatic-experiencing'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.modality).toBe(false);
  });
});

describe('computeMismatches - Schwerpunkte (Focus Areas)', () => {
  it('detects schwerpunkte mismatch when patient wants trauma but therapist has none', () => {
    const patient: PatientMeta = {
      schwerpunkte: ['trauma', 'anxiety'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sp-1',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
      schwerpunkte: ['relationships', 'depression'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.schwerpunkte).toBe(true);
    expect(result.schwerpunkteOverlap).toBe(0);
    expect(result.reasons).toContain('schwerpunkte');
  });

  it('no schwerpunkte mismatch when therapist has matching focus area', () => {
    const patient: PatientMeta = {
      schwerpunkte: ['trauma', 'anxiety'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sp-2',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
      schwerpunkte: ['trauma', 'depression'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.schwerpunkte).toBe(false);
    expect(result.schwerpunkteOverlap).toBe(1); // 'trauma' matches
  });

  it('counts multiple schwerpunkte overlaps correctly', () => {
    const patient: PatientMeta = {
      schwerpunkte: ['trauma', 'anxiety', 'depression'],
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sp-3',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
      schwerpunkte: ['trauma', 'anxiety', 'relationships'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.schwerpunkteOverlap).toBe(2); // 'trauma' and 'anxiety' match
  });

  it('no schwerpunkte mismatch when patient has no schwerpunkte preference', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
      // No schwerpunkte - patient doesn't care
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sp-4',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
      schwerpunkte: ['trauma'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.schwerpunkte).toBe(false);
  });
});

describe('computeMismatches - Session Preferences', () => {
  it('detects location mismatch when patient wants in_person but therapist only online', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sess-1',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['online'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.location).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('no location mismatch when therapist offers both online and in_person', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preference: 'in_person',
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sess-2',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['online', 'in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.location).toBe(false);
  });

  it('city mismatch does not apply when patient accepts online', () => {
    const patient: PatientMeta = {
      city: 'Berlin',
      session_preferences: ['online', 'in_person'], // Accepts both
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-sess-3',
      gender: 'female',
      city: 'Munich', // Different city
      session_preferences: ['in_person'],
      modalities: ['narm'],
    };

    const result = computeMismatches(patient, therapist);
    
    // City mismatch should NOT apply because patient also accepts online
    expect(result.mismatches.city).toBe(false);
  });
});

describe('computeMismatches - Multiple Criteria Combined', () => {
  it('perfect match requires all criteria to pass', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
      specializations: ['narm'],
      schwerpunkte: ['trauma'],
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-perfect',
      gender: 'female',
      city: 'Berlin',
      session_preferences: ['in_person'],
      modalities: ['narm'],
      schwerpunkte: ['trauma', 'anxiety'],
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(false);
    expect(result.mismatches.city).toBe(false);
    expect(result.mismatches.location).toBe(false);
    expect(result.mismatches.modality).toBe(false);
    expect(result.mismatches.schwerpunkte).toBe(false);
    expect(result.isPerfect).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('multiple mismatches are all reported', () => {
    const patient: PatientMeta = {
      gender_preference: 'female',
      city: 'Berlin',
      session_preference: 'in_person',
      specializations: ['narm'],
      schwerpunkte: ['trauma'],
    };
    const therapist: TherapistRowForMatch = {
      id: 'test-multiple',
      gender: 'male', // Mismatch
      city: 'Munich', // Mismatch
      session_preferences: ['in_person'],
      modalities: ['hakomi'], // Mismatch
      schwerpunkte: ['relationships'], // Mismatch
    };

    const result = computeMismatches(patient, therapist);
    
    expect(result.mismatches.gender).toBe(true);
    expect(result.mismatches.city).toBe(true);
    expect(result.mismatches.modality).toBe(true);
    expect(result.mismatches.schwerpunkte).toBe(true);
    expect(result.isPerfect).toBe(false);
    expect(result.reasons).toContain('gender');
    expect(result.reasons).toContain('city');
    expect(result.reasons).toContain('modality');
    expect(result.reasons).toContain('schwerpunkte');
  });
});
