import { describe, it, expect } from 'vitest';

function makeReq(body: any, next?: string) {
  const url = new URL('http://localhost/api/admin/login');
  if (next) url.searchParams.set('next', next);
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/admin/login POST', () => {
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
});
