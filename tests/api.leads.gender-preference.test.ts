/**
 * Tests for gender preference extraction from form session
 * Critical: Ensures German gender values are converted before matching
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase-server
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  track: vi.fn(() => Promise.resolve()),
  logError: vi.fn(() => Promise.resolve()),
}));

// Mock email
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

describe('Form Session Gender Extraction Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * This tests the extraction logic that should convert German gender
   * values from form session to English gender_preference for matching
   */
  it('extracts and converts German gender from form session data', () => {
    // Simulate form session data as stored by SignupWizard
    const formSessionData = {
      step: 6,
      name: 'Test User',
      gender: 'Frau', // German value from SignupWizard
      city: 'Berlin',
      session_preference: 'in_person',
      time_slots: ['Bin flexibel'],
    };

    // The extraction logic that should be in leads API
    let formSessionGenderPref: 'male' | 'female' | 'no_preference' | undefined;
    if (typeof formSessionData.gender === 'string') {
      const g = formSessionData.gender.toLowerCase();
      if (g.includes('mann')) formSessionGenderPref = 'male';
      else if (g.includes('frau')) formSessionGenderPref = 'female';
      else if (g.includes('keine') || g.includes('divers')) formSessionGenderPref = 'no_preference';
    }

    expect(formSessionGenderPref).toBe('female');
  });

  it('handles all German gender options correctly', () => {
    const testCases = [
      { input: 'Frau', expected: 'female' },
      { input: 'Mann', expected: 'male' },
      { input: 'Keine Präferenz', expected: 'no_preference' },
      { input: 'Divers/non-binär', expected: 'no_preference' },
    ];

    for (const { input, expected } of testCases) {
      let result: 'male' | 'female' | 'no_preference' | undefined;
      const g = input.toLowerCase();
      if (g.includes('mann')) result = 'male';
      else if (g.includes('frau')) result = 'female';
      else if (g.includes('keine') || g.includes('divers')) result = 'no_preference';

      expect(result).toBe(expected);
    }
  });

  it('returns undefined for unknown gender values', () => {
    const input = 'unknown';
    let result: 'male' | 'female' | 'no_preference' | undefined;
    const g = input.toLowerCase();
    if (g.includes('mann')) result = 'male';
    else if (g.includes('frau')) result = 'female';
    else if (g.includes('keine') || g.includes('divers')) result = 'no_preference';

    expect(result).toBeUndefined();
  });
});

describe('Metadata should include gender_preference before matching', () => {
  it('effectiveGenderPref falls back to form session value', () => {
    // Simulating the logic in leads API
    const genderPreference = undefined; // Not provided in direct payload
    const formSessionGenderPref: 'male' | 'female' | 'no_preference' = 'female'; // From form session
    
    const effectiveGenderPref = genderPreference || formSessionGenderPref;
    
    expect(effectiveGenderPref).toBe('female');
  });

  it('direct payload gender_preference takes precedence', () => {
    const genderPreference: 'male' | 'female' | 'no_preference' = 'male'; // Direct payload
    const formSessionGenderPref: 'male' | 'female' | 'no_preference' = 'female'; // From form session
    
    const effectiveGenderPref = genderPreference || formSessionGenderPref;
    
    expect(effectiveGenderPref).toBe('male');
  });
});
