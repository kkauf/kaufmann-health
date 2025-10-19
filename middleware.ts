import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Edge cache for the therapie-finden page
  if (pathname === '/therapie-finden') {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res;
  }

  // Only guard /admin routes; allow the login page itself
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  // Bypass middleware for API routes under /api/admin. These endpoints enforce their own auth
  // (admin session cookie OR cron secret headers). This allows Vercel Cron to hit
  // endpoints like /api/admin/therapists/reminders without being redirected.
  if (pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    console.log('[middleware] No admin cookie found for', pathname);
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  
  const valid = await verifySessionToken(token);
  if (!valid) {
    console.log('[middleware] Token validation failed for', pathname, 'token:', token.substring(0, 20) + '...');
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

