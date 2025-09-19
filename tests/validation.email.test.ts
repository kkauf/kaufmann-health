import { describe, it, expect } from 'vitest';
import { getEmailError } from '@/lib/validation';

// German messages must match exactly to keep UI consistent (informal "du")
const REQUIRED = 'Bitte gib deine E‑Mail‑Adresse ein.';
const INVALID = 'Bitte gib eine gültige E‑Mail‑Adresse ein.';

describe('getEmailError', () => {
  it('returns required message for empty, null, undefined, or whitespace-only', () => {
    expect(getEmailError('')).toBe(REQUIRED);
    expect(getEmailError('   ')).toBe(REQUIRED);
    expect(getEmailError(undefined)).toBe(REQUIRED);
    expect(getEmailError(null as unknown as string)).toBe(REQUIRED);
  });

  it('returns invalid message for malformed emails', () => {
    const bad = [
      'plainaddress',
      '@no-local-part.com',
      'no-at-symbol.com',
      'user@',
      'user@.com',
      'user@com',
      'user@@example.com',
      'user name@example.com',
      'user@example',
    ];
    for (const e of bad) {
      expect(getEmailError(e)).toBe(INVALID);
    }
  });

  it('trims input and accepts common valid emails', () => {
    const good = [
      'test@example.com',
      'USER@EXAMPLE.COM',
      ' user@example.com ',
      'user.name+tag+sorting@example.com',
      'user_name@example.co.uk',
      'u@d.io',
    ];
    for (const e of good) {
      expect(getEmailError(e)).toBeNull();
    }
  });
});
