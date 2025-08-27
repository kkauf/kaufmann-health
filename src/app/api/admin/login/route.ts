import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, createSessionToken } from '@/lib/auth/adminSession';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const next = url.searchParams.get('next') || '/admin';

    type LoginPayload = { password?: string };
    let body: LoginPayload | null = null;
    try {
      body = (await req.json()) as LoginPayload;
    } catch {
      // no-op; body may be empty or invalid JSON
    }
    const password = typeof body?.password === 'string' ? body.password : undefined;

    if (!password) {
      return NextResponse.json({ data: null, error: 'Missing password' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not set');
      return NextResponse.json({ data: null, error: 'Server misconfiguration' }, { status: 500 });
    }

    if (password !== adminPassword) {
      return NextResponse.json({ data: null, error: 'Invalid credentials' }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
    const token = await createSessionToken(exp);

    const res = NextResponse.json({ data: { ok: true, redirect: next }, error: null }, { status: 200 });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/admin',
      maxAge: ADMIN_SESSION_MAX_AGE_SEC, // seconds
    });
    return res;
  } catch (err) {
    console.error('POST /api/admin/login error:', err);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
