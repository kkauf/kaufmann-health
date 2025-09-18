import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock admin auth to always authorize
vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn().mockResolvedValue(true),
}));

// Fixtures for people rows across two days and multiple campaigns
const PEOPLE_FIXTURES = [
  // 2025-09-17 UTC
  {
    status: 'new',
    type: 'patient',
    campaign_source: '/wieder-lebendig',
    campaign_variant: 'A',
    created_at: '2025-09-17T12:00:00.000Z',
  },
  {
    status: 'pre_confirmation',
    type: 'patient',
    campaign_source: '/wieder-lebendig',
    campaign_variant: 'A',
    created_at: '2025-09-17T13:00:00.000Z',
  },
  // 2025-09-18 UTC
  {
    status: 'new',
    type: 'patient',
    campaign_source: '/ankommen-in-dir',
    campaign_variant: 'B',
    created_at: '2025-09-18T09:00:00.000Z',
  },
  {
    status: 'new',
    type: 'patient',
    campaign_source: '/therapie-finden',
    campaign_variant: 'A',
    created_at: '2025-09-18T10:00:00.000Z',
  },
];

// Minimal chainable supabase mock that returns empty data by default
function makeChain(table: string) {
  const state: any = { table };
  const chain: any = {
    // Default result-like fields so route code can read .count/.error even without awaiting
    count: 0,
    error: null,
    data: null,
    select(sel: string, opts?: any) {
      state.sel = sel; state.opts = opts;
      // For count/head usage, stay chainable and expose count/error fields
      if (opts?.head && opts?.count) {
        chain.count = 0;
        chain.error = null;
        return chain;
      }
      return chain;
    },
    eq(col: string, val: any) { state.eq = { col, val }; return chain; },
    not(col: string, op: string, v: any) { state.not = { col, op, v }; return chain; },
    gte(col: string, val: any) { state.gte = { col, val }; return chain; },
    order() { return chain; },
    in() { return chain; },
    limit() {
      // People dataset for campaign stats
      if (state.table === 'people' && String(state.sel || '').includes('campaign_source')) {
        return Promise.resolve({ data: PEOPLE_FIXTURES as any[], error: null });
      }
      // Everything else: empty
      return Promise.resolve({ data: [] as any[], error: null });
    },
  };
  return chain;
}

vi.mock('@/lib/supabase-server', () => {
  return {
    supabaseServer: {
      from: (table: string) => makeChain(table),
    },
  } as any;
});

function makeGet(url: string, headers?: Record<string, string>) {
  // Include admin cookie to satisfy auth logic
  const merged = { ...(headers || {}), cookie: 'kh_admin=dummy' };
  return new Request(url, { method: 'GET', headers: merged });
}

describe('Admin Stats: campaign aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns campaignStats and campaignByDay with correct aggregation', async () => {
    const { GET } = await import('@/app/admin/api/stats/route');
    const res = await GET(makeGet('http://localhost/admin/api/stats?days=7'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const data = json.data as any;

    expect(Array.isArray(data.campaignStats)).toBe(true);
    expect(Array.isArray(data.campaignByDay)).toBe(true);

    // campaignStats should contain aggregates per source/variant
    expect(data.campaignStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campaign_source: '/wieder-lebendig', campaign_variant: 'A', leads: 2, confirmed: 1, confirmation_rate: 50 }),
        expect.objectContaining({ campaign_source: '/ankommen-in-dir', campaign_variant: 'B', leads: 1, confirmed: 1, confirmation_rate: 100 }),
        expect.objectContaining({ campaign_source: '/therapie-finden', campaign_variant: 'A', leads: 1, confirmed: 1, confirmation_rate: 100 }),
      ])
    );

    // Daily breakdown should reflect the two dates
    expect(data.campaignByDay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: '2025-09-17', campaign_source: '/wieder-lebendig', campaign_variant: 'A', leads: 2, confirmed: 1, confirmation_rate: 50 }),
        expect.objectContaining({ day: '2025-09-18', campaign_source: '/ankommen-in-dir', campaign_variant: 'B', leads: 1, confirmed: 1, confirmation_rate: 100 }),
        expect.objectContaining({ day: '2025-09-18', campaign_source: '/therapie-finden', campaign_variant: 'A', leads: 1, confirmed: 1, confirmation_rate: 100 }),
      ])
    );
  });
});
