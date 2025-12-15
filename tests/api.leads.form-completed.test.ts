import { describe, it, expect, vi, beforeEach } from 'vitest';

let personRow: any = null;
let formSessionRow: any = null;
let updatePayload: any = null;

vi.mock('@/lib/server-analytics', async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    ServerAnalytics: {
      ...mod.ServerAnalytics,
      trackEventFromRequest: vi.fn(async () => {}),
    },
  };
});

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          select: (_sel?: string) => ({
            eq: (_col?: string, _val?: string) => ({
              single: async () => ({ data: personRow, error: personRow ? null : { message: 'not found' } }),
            }),
          }),
          update: (payload: any) => ({
            eq: (_col?: string, _val?: string) => {
              updatePayload = payload;
              return { data: null, error: null };
            },
          }),
        } as any;
      }
      if (table === 'form_sessions') {
        return {
          select: (_sel?: string) => ({
            eq: (_col?: string, _val?: string) => ({
              single: async () => ({ data: formSessionRow, error: null }),
            }),
          }),
        } as any;
      }
      throw new Error('unexpected table');
    },
  };
  return { supabaseServer: api };
});

// Avoid real Google Ads upload inside these tests
vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: { trackConversion: vi.fn(async () => {}) },
}));

function makeReq(url: string) {
  return new Request(url, { method: 'POST' });
}

beforeEach(() => {
  personRow = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    type: 'patient',
    metadata: { is_test: true, form_session_id: '22222222-2222-4222-8222-222222222222' },
  };
  formSessionRow = { data: { city: 'Berlin', session_preference: 'online' } };
  updatePayload = null;
});

describe('POST /api/public/leads/:id/form-completed', () => {
  it('returns 404 when person not found', async () => {
    personRow = null;
    const { POST } = await import('@/app/api/public/leads/[id]/form-completed/route');
    const res = await POST(makeReq('http://localhost/api/public/leads/11111111-1111-4111-8111-111111111111/form-completed'));
    expect(res.status).toBe(404);
  });

  it('stamps form_completed_at and merges subset from form_sessions', async () => {
    const { POST } = await import('@/app/api/public/leads/[id]/form-completed/route');
    const res = await POST(makeReq('http://localhost/api/public/leads/11111111-1111-4111-8111-111111111111/form-completed'));
    expect(res.status).toBe(200);
    expect(updatePayload).toBeTruthy();
    expect(updatePayload.metadata).toBeTruthy();
    const meta = updatePayload.metadata as Record<string, unknown>;
    expect(typeof meta.form_completed_at).toBe('string');
    expect(meta.city).toBe('Berlin');
    expect(meta.session_preference).toBe('online');
  });
});
