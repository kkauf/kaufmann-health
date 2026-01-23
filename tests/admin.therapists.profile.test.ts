import { describe, it, expect, vi, beforeEach } from 'vitest';

let fetchedTherapist: any = null;
let updatedTherapist: any = null;
let storageCalls: any[] = [];

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn(async () => true),
}));

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer: any = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _id: string) => ({
              single: async () => ({ data: fetchedTherapist, error: null }),
            }),
          }),
          update: (payload: any) => {
            updatedTherapist = payload;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        } as any;
      }
      if (table === 'events') {
        // Handle rejection history query
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: string) => ({
              contains: (_col2: string, _val2: any) => ({
                order: (_col3: string, _opts: any) => ({
                  limit: (_n: number) => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, _expires: number) => {
          storageCalls.push({ type: 'sign', bucket, path });
          return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
        },
        download: async (path: string) => {
          storageCalls.push({ type: 'download', bucket, path });
          const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'image/jpeg' });
          return { data: blob, error: null } as any;
        },
        upload: async (path: string, data: ArrayBuffer | Buffer, opts: { contentType?: string; upsert?: boolean }) => {
          storageCalls.push({ type: 'upload', bucket, path, size: (data as any).byteLength ?? 0, contentType: opts.contentType, upsert: opts.upsert });
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          storageCalls.push({ type: 'remove', bucket, paths });
          return { data: null, error: null };
        },
        getPublicUrl: (path: string) => {
          storageCalls.push({ type: 'publicUrl', bucket, path });
          return { data: { publicUrl: `https://public.example/${path}` } } as any;
        },
      }),
    },
  };
  return { supabaseServer };
});

function makeReq(url: string, method: string, body?: any, cookie = 'kh_admin=token') {
  return new Request(url, {
    method,
    headers: { 'content-type': body ? 'application/json' : undefined as any, cookie } as any,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  fetchedTherapist = {
    id: 'tid-1',
    first_name: 'Thera',
    last_name: 'Pist',
    email: 't@example.com',
    phone: null,
    city: null,
    status: 'pending_verification',
    photo_url: null,
    metadata: { profile: { photo_pending_path: 'applications/tid-1/profile-photo-123.jpg', approach_text: 'Existing' } },
  };
  updatedTherapist = null;
  storageCalls = [];
});

describe('/api/admin/therapists/:id profile admin endpoints', () => {
  it('GET returns profile with signed photo URL and approach text', async () => {
    const { GET } = await import('@/app/api/admin/therapists/[id]/route');
    const res = await GET(makeReq('http://localhost/api/admin/therapists/tid-1', 'GET'), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.profile.photo_pending_url).toContain('https://signed.example/applications/tid-1/profile-photo-123.jpg');
    expect(json.data.profile.approach_text).toBe('Existing');
  });

  it('PATCH approve_profile moves photo, sets public URL and clears pending path', async () => {
    const { PATCH } = await import('@/app/api/admin/therapists/[id]/route');
    const res = await PATCH(
      makeReq('http://localhost/api/admin/therapists/tid-1', 'PATCH', { approve_profile: true }),
      { params: Promise.resolve({ id: 'tid-1' }) },
    );
    expect(res.status).toBe(200);
    expect(updatedTherapist).toBeTruthy();
    expect(updatedTherapist.photo_url).toBe('https://public.example/tid-1.jpg');
    const meta = updatedTherapist.metadata || {};
    expect(meta.profile).toBeTruthy();
    expect('photo_pending_path' in meta.profile).toBe(false);
    // Ensure storage calls performed
    const types = storageCalls.map((c) => c.type);
    expect(types).toEqual(expect.arrayContaining(['download', 'upload', 'remove', 'publicUrl']));
  });
});
