export const COOKIES_ENABLED: boolean = (process.env.NEXT_PUBLIC_COOKIES || '').toLowerCase() === 'true';

export type VerificationMode = 'email' | 'sms' | 'both' | 'choice';

function parseVerificationMode(v?: string | null): VerificationMode {
  const s = (v || '').trim().toLowerCase();
  if (s === 'sms' || s === 'both' || s === 'choice' || s === 'email') return s as VerificationMode;
  return 'email';
}

// Verification mode (server-controlled)
export const VERIFICATION_MODE: VerificationMode = parseVerificationMode(
  typeof process !== 'undefined' && process.env ? process.env.VERIFICATION_MODE : undefined,
);

