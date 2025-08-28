import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-test mutable state for supabase mock
let matchByUUID: Record<string, { id: string; status?: string | null; created_at?: string | null; patient_id: string }> = {};
let updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];
let updateMode: 'ok' | 'missing_responded_at' | 'error' = 'ok';

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, value: string) => ({
              single: async () => {
                // value is secure_uuid when selecting the match, else id when fetching details
                const byUuid = matchByUUID[value as string];
                return byUuid
                  ? { data: byUuid, error: null }
                  : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              updateCalls.push({ id, payload });
              if (updateMode === 'ok') return { error: null };
              if (updateMode === 'missing_responded_at') {
                const hasRespAt = Object.prototype.hasOwnProperty.call(payload, 'responded_at');
                return hasRespAt ? ({ error: { message: 'column "responded_at" does not exist' } } as const) : ({ error: null } as const);
              }
              return { error: { message: 'update failed' } } as const;
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makePost(url: string, body?: any) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  matchByUUID = {};
  updateCalls = [];
  updateMode = 'ok';
});

describe('/api/match/[uuid]/respond POST', () => {
  it('accepts successfully when within 72h', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-1'] = { id: 'm-1', status: 'proposed', created_at: nowIso, patient_id: 'p-1' };
    const { POST } = await import('@/app/api/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-1/respond', { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { status: 'accepted' }, error: null });
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    expect(updateCalls[0]).toEqual({ id: 'm-1', payload: expect.objectContaining({ status: 'accepted' }) });
  });

  it('returns 410 when link expired (>72h) and does not update', async () => {
    const past = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
    matchByUUID['u-2'] = { id: 'm-2', status: 'proposed', created_at: past, patient_id: 'p-2' };
    const { POST } = await import('@/app/api/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-2/respond', { action: 'decline' }));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Link expired' });
    expect(updateCalls.length).toBe(0);
  });

  it('is idempotent when already accepted/declined', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-3'] = { id: 'm-3', status: 'accepted', created_at: nowIso, patient_id: 'p-3' };
    const { POST } = await import('@/app/api/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-3/respond', { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { status: 'accepted' }, error: null });
    expect(updateCalls.length).toBe(0);
  });

  it('falls back when responded_at column missing (retry without it)', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-4'] = { id: 'm-4', status: 'proposed', created_at: nowIso, patient_id: 'p-4' };
    updateMode = 'missing_responded_at';
    const { POST } = await import('@/app/api/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-4/respond', { action: 'decline' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { status: 'declined' }, error: null });
    // First call failed, second succeeded
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0].payload).toHaveProperty('responded_at');
    expect(updateCalls[1].payload).not.toHaveProperty('responded_at');
  });
});
