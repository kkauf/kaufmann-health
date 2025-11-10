import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, createSessionToken } from '@/lib/auth/adminSession';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';
import { track, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const loginLimiter = getFixedWindowLimiter('admin-login', 10, 60_000); // 10 req/min/IP

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const next = url.searchParams.get('next') || '/admin';
    const ip = extractIpFromHeaders(req.headers);
    const ua = req.headers.get('user-agent') || undefined;

    type LoginPayload = { password?: string };
    let body: LoginPayload | null = null;
    try {
      body = (await req.json()) as LoginPayload;
    } catch {
      // no-op; body may be empty or invalid JSON
    }
    const password = typeof body?.password === 'string' ? body.password : undefined;

    // Rate limit by IP
    const { allowed, retryAfterSec } = loginLimiter.check(ip);
    if (!allowed) {
      await track({ type: 'admin_login_rate_limited', props: { ip }, ua, ip, source: 'api.admin.login' });
      return NextResponse.json(
        { data: null, error: 'Too many attempts, try again later' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    if (!password) {
      return NextResponse.json({ data: null, error: 'Missing password' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not set');
      await logError('api.admin.login', new Error('ADMIN_PASSWORD not set'), { ip });
      return NextResponse.json({ data: null, error: 'Server misconfiguration' }, { status: 500 });
    }

    if (password !== adminPassword) {
      await track({ type: 'admin_login_failed', props: { reason: 'invalid_credentials' }, ua, ip, source: 'api.admin.login' });
      return NextResponse.json({ data: null, error: 'Invalid credentials' }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
    const token = await createSessionToken(exp);
    
    console.log('[admin login] Created token with expiry:', new Date(exp * 1000).toISOString());

    const res = NextResponse.json({ data: { ok: true, redirect: next }, error: null }, { status: 200 });
    
    // Set cookies with standard attribute order: name=value; Domain; Path; Expires; Max-Age; Secure; HttpOnly; SameSite
    // Chrome requires this order for proper persistence
    const host = url.hostname;
    const isKaufmannDomain = host === 'kaufmann-health.de' || host === 'www.kaufmann-health.de';
    const domain = isKaufmannDomain ? 'kaufmann-health.de' : undefined;
    const expiresDate = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SEC * 1000);
    const expiresStr = expiresDate.toUTCString();
    const isSecure = url.protocol === 'https:';
    
    const buildCookie = (path: string) => {
      const parts = [
        `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
        ...(domain ? [`Domain=${domain}`] : []),
        `Path=${path}`,
        `Expires=${expiresStr}`,
        `Max-Age=${ADMIN_SESSION_MAX_AGE_SEC}`,
        ...(isSecure ? ['Secure'] : []),
        'HttpOnly',
        'SameSite=Lax',
      ];
      return parts.join('; ');
    };
    
    // Cookie for /admin pages
    res.headers.append('Set-Cookie', buildCookie('/admin'));
    // Cookie for /api/admin endpoints (client-side fetches)
    res.headers.append('Set-Cookie', buildCookie('/api/admin'));
    await track({ type: 'admin_login_success', props: { }, ua, ip, source: 'api.admin.login' });
    return res;
  } catch (err) {
    console.error('POST /api/admin/login error:', err);
    await logError('api.admin.login', err);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
