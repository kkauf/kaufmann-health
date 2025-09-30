import { describe, it, expect } from 'vitest';
import { TERMS_VERSION, TERMS_TITLE, TERMS_SOURCE_FILE } from '@/content/therapist-terms';
import { THERAPIST_TERMS_VERSION } from '@/features/leads/components/TherapistApplicationForm';
import { version as SOURCE_VERSION, title as SOURCE_TITLE, sourceFileName as SOURCE_FILE } from '@/content/therapist-terms/v1.0';

describe('therapist-terms versioning', () => {
  it('shared constants match the latest content module', () => {
    expect(TERMS_VERSION).toBe(SOURCE_VERSION);
    expect(TERMS_TITLE).toBe(SOURCE_TITLE);
    expect(TERMS_SOURCE_FILE).toBe(SOURCE_FILE);
  });

  it('form submits the same version as the latest terms', () => {
    expect(THERAPIST_TERMS_VERSION).toBe(TERMS_VERSION);
  });

  it('source file name matches the version convention', () => {
    expect(TERMS_SOURCE_FILE).toBe(`${TERMS_VERSION}.tsx`);
  });
});
