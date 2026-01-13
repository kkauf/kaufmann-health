/*
  Admin session signing and verification.
  Uses HMAC-SHA256 with ADMIN_PASSWORD as the key.
  Token format: "exp.signature", where exp is a UNIX timestamp (seconds) and signature = base64url(HMAC("exp=" + exp)).
  Designed to work in both Edge (middleware) and Node (API route) runtimes.
*/

export const ADMIN_SESSION_COOKIE = 'kh_admin';
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 24 hours

function assertEnv(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Missing ADMIN_PASSWORD env var');
  return secret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(bytes: Uint8Array): string {
  // Prefer Buffer if available (Node), else fall back to btoa (Edge has btoa too)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(expiresAtSec: number): Promise<string> {
  const secret = assertEnv();
  const payload = `exp=${expiresAtSec}`;
  const signature = await hmac(payload, secret);
  return `${expiresAtSec}.${signature}`;
}

export type TokenVerifyResult = {
  valid: boolean;
  reason?: 'invalid_format' | 'invalid_expiry' | 'expired' | 'signature_mismatch' | 'exception';
  expiredHoursAgo?: number;
};

export async function verifySessionToken(token: string): Promise<boolean> {
  const result = await verifySessionTokenWithReason(token);
  return result.valid;
}

export async function verifySessionTokenWithReason(token: string): Promise<TokenVerifyResult> {
  try {
    const secret = assertEnv();
    const [expStr, sig] = token.split('.');
    if (!expStr || !sig) {
      console.log('[verifySessionToken] Invalid token format');
      return { valid: false, reason: 'invalid_format' };
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp)) {
      console.log('[verifySessionToken] Invalid expiry');
      return { valid: false, reason: 'invalid_expiry' };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp < nowSec) {
      const expiredHoursAgo = Math.floor((nowSec - exp) / 3600);
      console.log('[verifySessionToken] Token expired', expiredHoursAgo, 'hours ago');
      return { valid: false, reason: 'expired', expiredHoursAgo };
    }
    const payload = `exp=${exp}`;
    const expected = await hmac(payload, secret);
    const valid = timingSafeEqual(sig, expected);
    if (!valid) {
      console.log('[verifySessionToken] Signature mismatch - ADMIN_PASSWORD may have changed');
      return { valid: false, reason: 'signature_mismatch' };
    }
    return { valid: true };
  } catch (e) {
    console.log('[verifySessionToken] Exception:', e);
    return { valid: false, reason: 'exception' };
  }
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
