/**
 * Therapist session management for self-service portal (EARTH-234)
 * 
 * Functional cookie `kh_therapist` allows verified therapists to access
 * their profile editing portal for 30 days. This is a service-delivery
 * cookie, not a tracking cookie.
 * 
 * Security: HTTP-only, Secure in production, SameSite=Lax
 */

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'kh_therapist';
const TOKEN_EXPIRY = '30d';

function getTokenSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw && raw.length > 0) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[therapistSession] JWT_SECRET is not set in production');
  }
  return new TextEncoder().encode('dev-only-fallback');
}

export interface TherapistSessionPayload {
  /** Therapist ID from therapists table */
  therapist_id: string;
  /** Therapist email (verified via magic link) */
  email: string;
  /** Therapist name for display */
  name?: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiry timestamp */
  exp?: number;
}

/**
 * Create a signed JWT token for therapist session
 */
export async function createTherapistSessionToken(
  payload: Omit<TherapistSessionPayload, 'iat' | 'exp'>
): Promise<string> {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getTokenSecret());
  
  return token;
}

/**
 * Verify and decode a therapist session token
 */
export async function verifyTherapistSessionToken(
  token: string
): Promise<TherapistSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getTokenSecret());
    return payload as unknown as TherapistSessionPayload;
  } catch (err) {
    console.error('[therapistSession] Token verification failed:', err);
    return null;
  }
}

/**
 * Generate Set-Cookie header for therapist session
 */
export function createTherapistSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  
  if (isProduction) {
    parts.push('Secure');
  }
  
  return parts.join('; ');
}

/**
 * Generate Set-Cookie header to clear therapist session
 */
export function clearTherapistSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Extract therapist session from request cookies
 */
export async function getTherapistSession(
  request: Request
): Promise<TherapistSessionPayload | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  
  if (!sessionCookie) return null;
  
  const token = sessionCookie.substring(`${COOKIE_NAME}=`.length);
  return verifyTherapistSessionToken(token);
}

/**
 * Get cookie name (for client-side access if needed)
 */
export function getTherapistSessionCookieName(): string {
  return COOKIE_NAME;
}
