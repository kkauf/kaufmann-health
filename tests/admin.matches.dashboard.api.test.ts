import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state for mocks
let matchRows: any[] = [];
let peopleRows: any[] = [];
let therapistRows: any[] = [];
let updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];
let updateMode: 'ok' | 'missing_column' | 'error' = 'ok';

vi.mock('@/lib/auth/adminSession', () => {
  return {
    ADMIN_SESSION_COOKIE: 'kh_admin',
    verifySessionToken: vi.fn(async () => true),
  } as any;
});

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            order: (_c?: string, _o?: any) => ({
              limit: async (_n?: number) => ({ data: matchRows, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              updateCalls.push({ id, payload });
              if (updateMode === 'ok') return { error: null } as const;
              if (updateMode === 'missing_column') {
                const hasTimestamp =
                  Object.prototype.hasOwnProperty.call(payload, 'therapist_contacted_at') ||
                  Object.prototype.hasOwnProperty.call(payload, 'therapist_responded_at') ||
                  Object.prototype.hasOwnProperty.call(payload, 'patient_confirmed_at');
                if (hasTimestamp) {
                  return { error: { message: 'column "therapist_contacted_at" does not exist' } } as const;
                }
                return { error: null } as const;
              }
              return { error: { message: 'update failed' } } as const;
            },
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            in: async (_col: string, _ids: string[]) => ({ data: peopleRows, error: null }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            in: async (_col: string, _ids: string[]) => ({ data: therapistRows, error: null }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makeReq(method: string, body?: any) {
  return new Request('http://localhost/api/admin/matches', {
    method,
    headers: { 'content-type': 'application/json', cookie: 'kh_admin=token' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  matchRows = [];
  peopleRows = [];
  therapistRows = [];
  updateCalls = [];
  updateMode = 'ok';
});

describe('/api/admin/matches GET', () => {
  it('returns empty data when no matches', async () => {
    const { GET } = await import('@/app/api/admin/matches/route');
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: [], error: null });
  });

  it('returns assembled rows with patient and therapist info', async () => {
    matchRows = [
      { id: 'm1', patient_id: 'p1', therapist_id: 't1', status: 'proposed', notes: 'n', created_at: '2025-08-29T00:00:00.000Z' },
    ];
    peopleRows = [
      { id: 'p1', name: 'Alice', email: 'alice@example.com', metadata: { city: 'Berlin', issue: 'Trauma' } },
    ];
    therapistRows = [
      { id: 't1', first_name: 'Dr.', last_name: 'Bob', email: 'bob@example.com', phone: '' },
    ];
    const { GET } = await import('@/app/api/admin/matches/route');
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data[0]).toMatchObject({
      id: 'm1',
      status: 'proposed',
      patient: { name: 'Alice', email: 'alice@example.com', city: 'Berlin', issue: 'Trauma' },
      therapist: { name: 'Dr. Bob', email: 'bob@example.com' },
    });
  });
});

describe('/api/admin/matches PATCH', () => {
  it('updates status and falls back if timestamp columns missing', async () => {
    updateMode = 'missing_column';
    const { PATCH } = await import('@/app/api/admin/matches/route');
    const res = await PATCH(makeReq('PATCH', { id: 'm1', status: 'therapist_contacted', notes: 'hello' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'm1', status: 'therapist_contacted', notes: 'hello' }, error: null });
    // First attempt with timestamp, second fallback with safe cols
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0].payload).toHaveProperty('therapist_contacted_at');
    expect(updateCalls[1].payload).not.toHaveProperty('therapist_contacted_at');
  });

  it('rejects invalid status', async () => {
    const { PATCH } = await import('@/app/api/admin/matches/route');
    const res = await PATCH(makeReq('PATCH', { id: 'm1', status: 'bogus' }));
    expect(res.status).toBe(400);
  });
});
