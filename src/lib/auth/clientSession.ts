/**
 * Client session management for patient-initiated contact flow (EARTH-203)
 * 
 * Functional cookie `kh_client` allows verified users to contact therapists
 * without re-verification for 30 days. This is a service-delivery cookie,
 * not a tracking cookie.
 * 
 * Security: HTTP-only, Secure in production, SameSite=Lax
 */

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'kh_client';
const TOKEN_EXPIRY = '30d';

function getTokenSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw && raw.length > 0) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[clientSession] JWT_SECRET is not set in production');
  }
  return new TextEncoder().encode('dev-only-fallback');
}

export interface ClientSessionPayload {
  /** Patient ID from people table */
  patient_id: string;
  /** Verified contact method */
  contact_method: 'email' | 'phone';
  /** Verified contact value (email or phone) */
  contact_value: string;
  /** Patient name */
  name?: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiry timestamp */
  exp?: number;
}

/**
 * Create a signed JWT token for client session
 */
export async function createClientSessionToken(
  payload: Omit<ClientSessionPayload, 'iat' | 'exp'>
): Promise<string> {
  const token = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getTokenSecret());
  
  return token;
}

/**
 * Verify and decode a client session token
 */
export async function verifyClientSessionToken(
  token: string
): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getTokenSecret());
    return payload as unknown as ClientSessionPayload;
  } catch (err) {
    console.error('[clientSession] Token verification failed:', err);
    return null;
  }
}

/**
 * Generate Set-Cookie header for client session
 */
export function createClientSessionCookie(token: string): string {
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
 * Generate Set-Cookie header to clear client session
 */
export function clearClientSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/**
 * Extract client session from request cookies
 */
export async function getClientSession(
  request: Request
): Promise<ClientSessionPayload | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  
  if (!sessionCookie) return null;
  
  const token = sessionCookie.substring(`${COOKIE_NAME}=`.length);
  return verifyClientSessionToken(token);
}

/**
 * Get cookie name (for client-side access if needed)
 */
export function getClientSessionCookieName(): string {
  return COOKIE_NAME;
}
