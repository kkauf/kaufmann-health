import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-test mutable state for supabase mock
let matchByUUID: Record<string, { id: string; status?: string | null; created_at?: string | null; patient_id: string; therapist_id: string } > = {};
let peopleById: Record<string, { id: string; name?: string | null; email?: string | null; phone?: string | null }> = {};
let updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, value: string) => ({
              single: async () => {
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
              const target = Object.values(matchByUUID).find((m) => m.id === id);
              if (target && typeof payload?.status === 'string') target.status = payload.status;
              return { error: null } as const;
            },
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: (cols?: string) => {
            const columns = String(cols || '');
            return {
              eq: (_col: string, id: string) => ({
                single: async () => {
                  const p = peopleById[id];
                  if (!p) return { data: null, error: { message: 'not found' } } as const;
                  // emulate column selection minimalistically
                  const data: any = {};
                  if (columns.includes('name')) data.name = p.name ?? null;
                  if (columns.includes('email')) data.email = p.email ?? null;
                  if (columns.includes('phone_number')) data.phone_number = p.phone ?? null;
                  if (columns.includes('phone')) data.phone = p.phone ?? null;
                  data.id = p.id;
                  return { data, error: null } as const;
                },
              }),
              in: async (_col: string, ids: string[]) => {
                const data = ids.map((id) => {
                  const p = peopleById[id] || { id };
                  const out: any = { id: p.id };
                  if (columns.includes('name')) out.name = p.name ?? null;
                  if (columns.includes('email')) out.email = p.email ?? null;
                  if (columns.includes('phone_number')) out.phone_number = p.phone ?? null;
                  if (columns.includes('phone')) out.phone = p.phone ?? null;
                  return out;
                });
                return { data, error: null } as const;
              },
            };
          },
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
  peopleById = {};
  updateCalls = [];
});

describe('/api/match/[uuid]/respond contact reveal', () => {
  it('reveals contact on initial accept when reveal=1', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-r1'] = { id: 'm-r1', status: 'proposed', created_at: nowIso, patient_id: 'p-1', therapist_id: 't-1' };
    peopleById['p-1'] = { id: 'p-1', name: 'Maria Schmidt', email: 'maria@example.com', phone: '+49 30 123456' };
    peopleById['t-1'] = { id: 't-1', name: 'Thera T', email: 'thera@example.com' };

    const { POST } = await import('@/app/api/public/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-r1/respond?reveal=1', { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      data: expect.objectContaining({
        status: 'accepted',
        contact: expect.objectContaining({ email: 'maria@example.com', phone: '+49 30 123456' }),
      }),
      error: null,
    });
  });

  it('reveals contact for already accepted (idempotent) when reveal=1', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-r2'] = { id: 'm-r2', status: 'accepted', created_at: nowIso, patient_id: 'p-2', therapist_id: 't-2' };
    peopleById['p-2'] = { id: 'p-2', name: 'Alex M', email: 'alex@example.com', phone: '+49 40 555' };

    const { POST } = await import('@/app/api/public/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-r2/respond?reveal=1', { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      data: expect.objectContaining({
        status: 'accepted',
        contact: expect.objectContaining({ email: 'alex@example.com', phone: '+49 40 555' }),
      }),
      error: null,
    });
    // idempotent: no update calls
    expect(updateCalls.length).toBe(0);
  });

  it('does not include contact when reveal is not requested', async () => {
    const nowIso = new Date().toISOString();
    matchByUUID['u-r3'] = { id: 'm-r3', status: 'proposed', created_at: nowIso, patient_id: 'p-3', therapist_id: 't-3' };
    peopleById['p-3'] = { id: 'p-3', name: 'No Show', email: 'noshow@example.com', phone: '+49 89 777' };

    const { POST } = await import('@/app/api/public/match/[uuid]/respond/route');

    const res = await POST(makePost('http://localhost/api/match/u-r3/respond', { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { status: 'accepted' }, error: null });
  });
});
