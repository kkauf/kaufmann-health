/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { GET as confirmGET } from '@/app/api/public/leads/confirm/route';
import { POST as verifyCodePOST } from '@/app/api/public/verification/verify-code/route';
import { GET as sessionGET } from '@/app/api/public/session/route';
import { supabaseServer } from '@/lib/supabase-server';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/verification/sms', () => ({
  verifySmsCode: vi.fn(),
}));

vi.mock('@/lib/conversion', () => ({
  maybeFirePatientConversion: vi.fn(),
}));

describe('EARTH-204: Session cookie persistence across verification flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EMAIL: cookie set by confirm endpoint is readable by session endpoint', async () => {
    const personId = 'patient-abc';
    const token = 'valid-token-123';
    const email = 'test@example.com';
    const name = 'Test User';

    // Mock person lookup for confirm endpoint
    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email,
              name,
              status: 'pre_confirmation',
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Step 1: Verify email
    const confirmReq = new Request(
      `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}`
    );
    const confirmRes = await confirmGET(confirmReq);

    expect(confirmRes.status).toBe(302);
    const setCookieHeader = confirmRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('kh_client=');

    // Extract cookie value
    const cookieMatch = setCookieHeader!.match(/kh_client=([^;]+)/);
    expect(cookieMatch).toBeTruthy();
    const cookieValue = cookieMatch![1];

    // Step 2: Make subsequent request with cookie
    const sessionReq = new Request('http://localhost:3000/api/public/session', {
      headers: {
        cookie: `kh_client=${cookieValue}`,
      },
    });

    const sessionRes = await sessionGET(sessionReq);
    expect(sessionRes.status).toBe(200);

    const sessionData = await sessionRes.json();
    expect(sessionData.data.verified).toBe(true);
    expect(sessionData.data.contact_method).toBe('email');
    expect(sessionData.data.contact_value).toBe(email);
    expect(sessionData.data.name).toBe(name);
  });

  it('SMS: cookie set by verify-code endpoint is readable by session endpoint', async () => {
    const personId = 'patient-xyz';
    const phone = '+491234567890';
    const name = 'SMS User';

    const { verifySmsCode } = await import('@/lib/verification/sms');
    (verifySmsCode as Mock).mockResolvedValue({ success: true });

    // Mock person lookup for verify-code endpoint (needs chained .eq() calls)
    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: personId,
                    name,
                    email: null,
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Step 1: Verify SMS
    const verifyReq = new Request('http://localhost:3000/api/public/verification/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact: phone,
        contact_type: 'phone',
        code: '123456',
      }),
    });

    const verifyRes = await verifyCodePOST(verifyReq as any);
    expect(verifyRes.status).toBe(200);

    const setCookieHeader = verifyRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('kh_client=');

    // Extract cookie value
    const cookieMatch = setCookieHeader!.match(/kh_client=([^;]+)/);
    expect(cookieMatch).toBeTruthy();
    const cookieValue = cookieMatch![1];

    // Step 2: Make subsequent request with cookie
    const sessionReq = new Request('http://localhost:3000/api/public/session', {
      headers: {
        cookie: `kh_client=${cookieValue}`,
      },
    });

    const sessionRes = await sessionGET(sessionReq);
    expect(sessionRes.status).toBe(200);

    const sessionData = await sessionRes.json();
    expect(sessionData.data.verified).toBe(true);
    expect(sessionData.data.contact_method).toBe('phone');
    expect(sessionData.data.contact_value).toBe(phone);
    expect(sessionData.data.name).toBe(name);
  });

  it('EMAIL: redirect to /therapeuten preserves cookie', async () => {
    const personId = 'patient-redirect';
    const token = 'redirect-token-456';
    const email = 'redirect@example.com';
    const therapistId = 'therapist-123';
    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=booking`;

    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email,
              name: 'Redirect User',
              status: 'pre_confirmation',
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Confirm with redirect
    const confirmReq = new Request(
      `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}&redirect=${encodeURIComponent(redirectPath)}`
    );

    const confirmRes = await confirmGET(confirmReq);

    expect(confirmRes.status).toBe(302);
    const location = confirmRes.headers.get('Location');
    expect(location).toContain('/therapeuten');
    expect(location).toContain('contact=compose');
    expect(location).toContain(`tid=${therapistId}`);

    // Cookie must be set
    const setCookieHeader = confirmRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('kh_client=');

    // Verify cookie attributes for proper persistence
    expect(setCookieHeader).toContain('Path=/');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Lax');
    expect(setCookieHeader).toContain('Max-Age=');
  });

  it('session endpoint returns verified=false without cookie', async () => {
    const req = new Request('http://localhost:3000/api/public/session');
    const res = await sessionGET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.verified).toBe(false);
  });

  it('session endpoint returns verified=false with invalid cookie', async () => {
    const req = new Request('http://localhost:3000/api/public/session', {
      headers: {
        cookie: 'kh_client=invalid-token',
      },
    });

    const res = await sessionGET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data.verified).toBe(false);
  });

  it('EMAIL: already-confirmed status still sets cookie', async () => {
    const personId = 'patient-already';
    const token = 'any-token';
    const email = 'already@example.com';

    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email,
              name: 'Already Confirmed',
              status: 'email_confirmed', // Already confirmed
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
              },
            },
            error: null,
          }),
        }),
      }),
    });

    const confirmReq = new Request(
      `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}`
    );

    const confirmRes = await confirmGET(confirmReq);
    expect(confirmRes.status).toBe(302);

    const setCookieHeader = confirmRes.headers.get('Set-Cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('kh_client=');

    // Extract and verify cookie works
    const cookieMatch = setCookieHeader!.match(/kh_client=([^;]+)/);
    const cookieValue = cookieMatch![1];

    const sessionReq = new Request('http://localhost:3000/api/public/session', {
      headers: { cookie: `kh_client=${cookieValue}` },
    });

    const sessionRes = await sessionGET(sessionReq);
    const sessionData = await sessionRes.json();
    expect(sessionData.data.verified).toBe(true);
  });
});
