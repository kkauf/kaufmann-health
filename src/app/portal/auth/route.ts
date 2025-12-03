import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyTherapistSessionToken, createTherapistSessionToken, getTherapistSessionCookieName } from '@/lib/auth/therapistSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /portal/auth?token=xxx
 * 
 * Verify magic link token, set session cookie, and redirect to portal.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/portal/login', req.url));
  }

  // Verify the token
  const payload = await verifyTherapistSessionToken(token);
  
  if (!payload?.therapist_id) {
    // Invalid or expired token
    return NextResponse.redirect(new URL('/portal/login?error=invalid_token', req.url));
  }

  // Generate a fresh token for the cookie (to reset expiry)
  const freshToken = await createTherapistSessionToken({
    therapist_id: payload.therapist_id,
    email: payload.email,
    name: payload.name,
  });

  // Set the cookie
  const cookieStore = await cookies();
  const cookieName = getTherapistSessionCookieName();
  const isProduction = process.env.NODE_ENV === 'production';
  
  cookieStore.set(cookieName, freshToken, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
  });

  // Redirect to portal (clean URL without token)
  return NextResponse.redirect(new URL('/portal', req.url));
}
