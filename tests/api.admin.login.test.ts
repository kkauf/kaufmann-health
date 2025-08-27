import { describe, it, expect, beforeEach } from 'vitest';
import { __resetAllRateLimitersForTests } from '@/lib/rate-limit';

function makeReq(body: any, next?: string, headers?: Record<string, string>) {
  const url = new URL('http://localhost/api/admin/login');
  if (next) url.searchParams.set('next', next);
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/login POST', () => {
  beforeEach(() => {
    __resetAllRateLimitersForTests();
  });

  it('400 when password is missing', async () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Missing password' });
  });

  it('401 on invalid credentials', async () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeReq({ password: 'wrong' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Invalid credentials' });
  });

  it('200 sets admin cookie and returns redirect', async () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeReq({ password: 'secret' }, '/admin/tools'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true, redirect: '/admin/tools' }, error: null });

    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('kh_admin=');
    expect(setCookie.toLowerCase()).toContain('path=/admin');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('500 if server misconfigured (missing ADMIN_PASSWORD)', async () => {
    delete process.env.ADMIN_PASSWORD;
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeReq({ password: 'anything' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Server misconfiguration' });
  });

  it('429 after 10 attempts per minute per IP', async () => {
    process.env.ADMIN_PASSWORD = 'secret';
    const { POST } = await import('@/app/api/admin/login/route');
    const headers = { 'x-forwarded-for': '203.0.113.1' };
    // 10 attempts allowed
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeReq({ password: 'wrong' }, undefined, headers));
      if (i < 9) expect(res.status).toBe(401);
      else expect(res.status).toBe(401);
    }
    // 11th should be rate-limited
    const res = await POST(makeReq({ password: 'wrong' }, undefined, headers));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Too many attempts, try again later' });
  });
});
