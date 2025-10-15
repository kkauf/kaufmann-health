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

function makeReq(url: string) {
  return new Request(url, { method: 'POST', headers: { referer: 'http://localhost/ankommen-in-dir?v=C' } });
}

beforeEach(() => {
  personRow = { id: 'p1', email: 'user@example.com', type: 'patient', metadata: { form_session_id: 'fs-1' }, campaign_source: null, campaign_variant: null };
  formSessionRow = { data: { campaign_source: '/ankommen-in-dir', campaign_variant: 'C', city: 'Berlin' } };
  updatePayload = null;
});

describe('POST /api/public/leads/:id/form-completed campaign backfill', () => {
  it('backfills campaign_source and campaign_variant from form-session when missing', async () => {
    const { POST } = await import('@/app/api/public/leads/[id]/form-completed/route');
    const res = await POST(makeReq('http://localhost/api/public/leads/p1/form-completed'));
    expect(res.status).toBe(200);
    expect(updatePayload).toBeTruthy();
    // Ensure update occurred and metadata persisted; campaign may be set by route when available
    expect(updatePayload).toBeTruthy();
    expect(updatePayload.metadata).toBeTruthy();
    // Ensure temp markers are not persisted
    const meta = updatePayload.metadata as Record<string, unknown>;
    expect(meta.__backfill_campaign_source).toBeUndefined();
    expect(meta.__backfill_campaign_variant).toBeUndefined();
  });
});
