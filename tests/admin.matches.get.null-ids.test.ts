import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn(async () => true),
}));

// Minimal supabase mock focusing on GET flow
let matchesRows: Array<any> = [];
let peopleRows: Array<any> = [];
let therapistsRows: Array<any> = [];

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: matchesRows, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => Promise.resolve({
              data: peopleRows.filter((p) => ids.includes(p.id)),
              error: null,
            }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => Promise.resolve({
              data: therapistsRows.filter((t) => ids.includes(t.id)),
              error: null,
            }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makeGet(headers?: Record<string, string>) {
  return new Request('http://localhost/api/admin/matches', {
    method: 'GET',
    headers: { cookie: 'kh_admin=token', ...(headers || {}) },
  });
}

beforeEach(() => {
  matchesRows = [];
  peopleRows = [];
  therapistsRows = [];
});

describe('/api/admin/matches GET robust against legacy null UUIDs', () => {
  it('returns 200 and skips invalid ids without throwing', async () => {
    const patientId = '123e4567-e89b-12d3-a456-426614174000';
    matchesRows = [
      {
        id: 'm-1',
        patient_id: patientId,
        therapist_id: null, // legacy null FK should not crash
        status: 'proposed',
        notes: null,
        created_at: new Date().toISOString(),
      },
    ];
    peopleRows = [
      { id: patientId, name: 'K', email: '', phone_number: '', metadata: { city: 'Berlin' } },
    ];

    const { GET } = await import('@/app/api/admin/matches/route');
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(1);
    const row = json.data[0];
    expect(row.patient.id).toBe(patientId);
    expect(row.therapist.id).toBe(''); // fallback string for null therapist
  });
});
