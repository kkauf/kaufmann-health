import { describe, it, expect, vi, beforeEach } from 'vitest';

let updateArgs: any = null;
let person: any = null;
let trackCalled = false;
let gaCalledWith: any = null;

vi.mock('@/lib/server-analytics', async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    ServerAnalytics: {
      ...mod.ServerAnalytics,
      trackEventFromRequest: vi.fn(async () => {
        trackCalled = true;
      }),
    },
  };
});

vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: {
    trackConversion: vi.fn(async (args: any) => {
      gaCalledWith = args;
    }),
  },
}));

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error('unexpected table');
      return {
        select: (_sel: string) => ({
          eq: (_col: string, _val: string) => ({
            single: async () => ({ data: person, error: null }),
          }),
        }),
        update: (payload: any) => ({
          eq: (_col: string, _val: string) => {
            updateArgs = payload;
            return { data: null, error: null };
          },
        }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeUrl(id: string, token: string) {
  return `http://localhost/api/leads/confirm?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost';
  updateArgs = null;
  trackCalled = false;
  gaCalledWith = null;
  const now = Date.now();
  const sentAt = new Date(now - 10 * 60 * 1000).toISOString(); // 10 minutes ago
  person = {
    id: 'p1',
    email: 'user@example.com',
    status: 'pre_confirmation',
    metadata: { confirm_token: 't1', confirm_sent_at: sentAt },
    campaign_source: '/wieder-lebendig',
    campaign_variant: 'B',
  };
});

describe('EARTH-146 GET /api/leads/confirm', () => {
  it('confirms valid token, updates status and redirects to success', async () => {
    const { GET } = await import('@/app/api/leads/confirm/route');
    const res = await GET(new Request(makeUrl('p1', 't1')));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/preferences?confirm=1&id=p1');
    // status update
    expect(updateArgs).toBeTruthy();
    expect(updateArgs.status).toBe('new');
    expect(updateArgs.metadata.confirm_token).toBeUndefined();
    expect(typeof updateArgs.metadata.confirmed_at).toBe('string');
    // analytics and GA fired
    expect(trackCalled).toBe(true);
    expect(gaCalledWith).toMatchObject({ email: 'user@example.com', conversionAction: 'patient_registration' });
  });

  it('rejects invalid token', async () => {
    person.metadata.confirm_token = 'different';
    const { GET } = await import('@/app/api/leads/confirm/route');
    const res = await GET(new Request(makeUrl('p1', 't1')));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/confirm?state=invalid');
    expect(updateArgs).toBeNull();
  });

  it('rejects expired token', async () => {
    // sent 25 hours ago
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    person.metadata.confirm_sent_at = past;
    const { GET } = await import('@/app/api/leads/confirm/route');
    const res = await GET(new Request(makeUrl('p1', 't1')));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/confirm?state=expired');
    expect(updateArgs).toBeNull();
  });
});
