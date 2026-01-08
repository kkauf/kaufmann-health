import { describe, it, expect, vi, beforeEach } from 'vitest';

let nextInsertId = 'p_ok';

vi.mock('@/lib/leads/rateLimit', () => ({
  isIpRateLimited: vi.fn(async () => false),
}));

const trackSpy = vi.fn(async () => {});

vi.mock('@/lib/server-analytics', async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    ServerAnalytics: {
      ...mod.ServerAnalytics,
      trackEventFromRequest: trackSpy,
    },
  };
});

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error(`unexpected table ${table}`);
      return {
        insert: (_payload: any) => ({
          select: (_sel: string) => ({ single: async () => ({ data: { id: nextInsertId }, error: null }) }),
        }),
        select: (_sel: string) => ({ eq: (_col: string, _val: string) => ({ single: async () => ({ data: null, error: null }) }) }),
        update: (_payload: any) => ({ eq: (_col: string, _val: string) => ({ data: null, error: null }) }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any) {
  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer: 'http://localhost/therapie-finden?v=A' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  trackSpy.mockClear();
  nextInsertId = 'p_ok';
});

describe('POST /api/public/leads (consent_captured)', () => {
  it('emits consent_captured with method and privacy_version', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const req = makeReq({ email: 'x@example.com', type: 'patient', consent_share_with_therapists: true, privacy_version: '2025-09-01.v2' });
    const res = await POST(req as any);
    expect(res?.status).toBe(200);

    // Find an event with type consent_captured
    const calls: any[][] = (trackSpy as any).mock.calls || [];
    const payloads: any[] = calls
      .map((args) => (Array.isArray(args) ? args.find((a) => a && typeof a === 'object' && 'type' in a) : undefined))
      .filter(Boolean) as any[];
    const hasConsentCaptured = payloads.some((evt: any) => evt?.type === 'consent_captured' && evt?.props?.privacy_version === '2025-09-01.v2');
    expect(hasConsentCaptured).toBe(true);
  });
});
