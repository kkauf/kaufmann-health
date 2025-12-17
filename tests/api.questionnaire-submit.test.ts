import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastInsertedPayload: any = null;

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          insert: (payload: any) => {
            lastInsertedPayload = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'p-1' }, error: null }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              contains: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        } as any;
      }

      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              not: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        } as any;
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as any;

  return { supabaseServer };
});

vi.mock('@/features/leads/lib/match', () => {
  return {
    createInstantMatchesForPatient: vi.fn(async () => null),
  };
});

vi.mock('@/lib/server-analytics', () => {
  return {
    ServerAnalytics: {
      trackEventFromRequest: vi.fn(async () => {}),
    },
    parseAttributionFromRequest: () => ({}),
    parseCampaignFromRequest: () => ({ campaign_source: undefined, campaign_variant: undefined, landing_page: undefined }),
  };
});

vi.mock('@/lib/logger', () => {
  return {
    track: vi.fn(async () => {}),
  };
});

describe('POST /api/public/questionnaire-submit', () => {
  beforeEach(() => {
    lastInsertedPayload = null;
  });

  it("accepts session_preference='either' and normalizes to session_preferences", async () => {
    const { POST } = await import('@/app/api/public/questionnaire-submit/route');

    const req = new Request('http://localhost/api/public/questionnaire-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_preference: 'either',
        city: 'Berlin',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({
      data: {
        patientId: 'p-1',
        matchesUrl: null,
        matchQuality: 'none',
      },
      error: null,
    });

    expect(lastInsertedPayload).toBeTruthy();
    const meta = lastInsertedPayload.metadata || {};
    expect(meta.session_preferences).toEqual(['online', 'in_person']);
    expect(meta.session_preference).toBeUndefined();
  });
});
