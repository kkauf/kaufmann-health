import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifySessionTokenWithReason } from '@/lib/auth/adminSession';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  const hostname = req.nextUrl.hostname;
  if (hostname === 'kaufmann-health.de') {
    const url = req.nextUrl.clone();
    url.hostname = 'www.kaufmann-health.de';
    return NextResponse.redirect(url, 308);
  }

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
    const allCookies = req.cookies.getAll?.().map(c => c.name) || [];
    console.log('[middleware]', pathname, '- No kh_admin cookie. All cookies:', allCookies);
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    url.searchParams.set('reason', 'no_cookie');
    return NextResponse.redirect(url);
  }
  
  const result = await verifySessionTokenWithReason(token);
  if (!result.valid) {
    console.log('[middleware]', pathname, '- Token INVALID. Reason:', result.reason, 
      result.expiredHoursAgo ? `(expired ${result.expiredHoursAgo}h ago)` : '');
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    url.searchParams.set('reason', result.reason || 'unknown');
    if (result.expiredHoursAgo) {
      url.searchParams.set('expired_hours', String(result.expiredHoursAgo));
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

