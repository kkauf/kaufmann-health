import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTherapistSessionCookieName } from '@/lib/auth/therapistSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/public/therapist-logout
 * 
 * Clear the therapist session cookie and redirect to login.
 */
export async function POST() {
  const cookieStore = await cookies();
  const cookieName = getTherapistSessionCookieName();
  
  // Delete the cookie
  cookieStore.delete(cookieName);
  
  return NextResponse.json({ data: { ok: true }, error: null });
}
