import { describe, it, expect, beforeEach } from 'vitest';

// We import create/verify to mint a valid cookie for the allow-case
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, createSessionToken } from '@/lib/auth/adminSession';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';').map((s) => s.trim());
  if (parts.length > 0) {
    const [k, v] = parts[0].split('=');
    if (k && v) map.set(k, v);
  }
  return map;
}

function makeNextUrl(pathname: string) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    get pathname() {
      return url.pathname;
    },
    set pathname(p: string) {
      url.pathname = p;
    },
    get searchParams() {
      return url.searchParams;
    },
    toString() {
      return url.toString();
    },
    get href() {
      return url.href;
    },
    clone() {
      // return a new wrapper so middleware can mutate pathname/searchParams
      return makeNextUrl(url.pathname + (url.search ? url.search : ''));
    },
  } as any;
}

function makeReq(pathname: string, cookie?: string) {
  const cookies = parseCookie(cookie);
  return {
    nextUrl: makeNextUrl(pathname),
    cookies: {
      get(name: string) {
        const value = cookies.get(name);
        return value ? { name, value } : undefined;
      },
    },
  } as any;
}

describe('middleware admin protection', () => {
  beforeEach(() => {
    // Ensure env for signing
    process.env.ADMIN_PASSWORD = 'secret';
  });

  it('redirects /admin to /admin/login when no cookie', async () => {
    const { middleware } = await import('../middleware');
    const res = await middleware(makeReq('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
    expect(res.headers.get('location')).toContain('next=%2Fadmin');
  });

  it('allows /admin/login (no redirect) even without cookie', async () => {
    const { middleware } = await import('../middleware');
    const res = await middleware(makeReq('/admin/login'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects when cookie invalid', async () => {
    const { middleware } = await import('../middleware');
    const cookie = `${ADMIN_SESSION_COOKIE}=invalid; Path=/admin; HttpOnly`;
    const res = await middleware(makeReq('/admin', cookie));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('passes when cookie valid and not expired', async () => {
    const { middleware } = await import('../middleware');
    const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC;
    const token = await createSessionToken(exp);
    const cookie = `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; HttpOnly`;
    const res = await middleware(makeReq('/admin', cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
