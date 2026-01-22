import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn(async () => true),
}));

// Build a chainable thenable query mock that returns provided rows
function makeQuery(rows: any[]) {
  const builder: any = {
    select: (_cols?: string) => builder,
    order: (_col?: string, _opts?: any) => builder,
    limit: (_n?: number) => builder,
    eq: (_col?: string, _val?: any) => builder,
    ilike: (_col?: string, _pattern?: string) => builder,
    then: (resolve: (v: any) => any) => resolve({ data: rows, error: null }),
  };
  return builder;
}

let listRows: any[] = [];

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer: any = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => makeQuery(listRows),
        } as any;
      }
      if (table === 'cal_slots_cache') {
        // Return empty slot cache for tests
        return {
          select: (_cols?: string) => ({
            in: (_col?: string, _ids?: string[]) => ({
              then: (resolve: (v: any) => any) => resolve({ data: [], error: null }),
            }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return { supabaseServer };
});

function makeReq(url: string, cookie = 'kh_admin=token') {
  return new Request(url, {
    method: 'GET',
    headers: { cookie } as any,
  });
}

beforeEach(() => {
  listRows = [
    {
      id: 't1',
      first_name: 'A',
      last_name: 'One',
      email: 'a@example.com',
      phone: null,
      gender: null,
      city: 'Berlin',
      session_preferences: ['online'],
      modalities: ['NARM'],
      accepting_new: true,
      status: 'pending_verification',
      created_at: '2025-09-10T10:00:00.000Z',
      metadata: { profile: { photo_pending_path: 'applications/t1/profile-photo.jpg', approach_text: 'Text' } },
      photo_url: null,
    },
    {
      id: 't2',
      first_name: 'B',
      last_name: 'Two',
      email: 'b@example.com',
      phone: null,
      gender: null,
      city: 'Hamburg',
      session_preferences: ['in_person'],
      modalities: [],
      accepting_new: true,
      status: 'verified',
      created_at: '2025-09-10T11:00:00.000Z',
      metadata: { profile: {} },
      photo_url: 'https://public.example/t2.jpg',
    },
  ];
});

describe('GET /api/admin/therapists list includes profile flags', () => {
  it('returns derived profile booleans for each therapist', async () => {
    const { GET } = await import('@/app/api/admin/therapists/route');
    const res = await GET(makeReq('http://localhost/api/admin/therapists?status=pending_verification'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);

    const one = json.data.find((r: any) => r.id === 't1');
    expect(one.profile).toBeTruthy();
    expect(one.profile.has_photo_pending).toBe(true);
    expect(one.profile.has_photo_public).toBe(false);
    expect(one.profile.has_approach_text).toBe(true);

    const two = json.data.find((r: any) => r.id === 't2');
    expect(two.profile).toBeTruthy();
    expect(two.profile.has_photo_pending).toBe(false);
    expect(two.profile.has_photo_public).toBe(true);
    expect(two.profile.has_approach_text).toBe(false);
  });
});
