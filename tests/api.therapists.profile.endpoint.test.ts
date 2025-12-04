import { describe, it, expect, vi, beforeEach } from 'vitest';

let fetchedTherapist: any = null;
let lastUpdate: any = null;
let uploads: Array<{ bucket: string; path: string; contentType: string; size: number }>; 

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer: any = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _id: string) => ({
              single: async () => ({ data: fetchedTherapist, error: fetchedTherapist ? null : { message: 'not found' } }),
            }),
          }),
          update: (payload: any) => {
            lastUpdate = payload;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, data: ArrayBuffer | Buffer | Blob, opts: { contentType?: string; upsert?: boolean }) => {
          const size = (data as any).size ?? (data as Buffer).byteLength ?? 0;
          uploads.push({ bucket, path, contentType: opts.contentType || '', size });
          return { data: { path }, error: null };
        },
      }),
    },
  };
  return { supabaseServer };
});

vi.mock('@/lib/logger', () => ({ logError: vi.fn(async () => {}), track: vi.fn(async () => {}) }));

function makeJsonReq(body: any) {
  return new Request('http://localhost/api/therapists/tid-1/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeFormReq(form: FormData, headers?: Record<string, string>) {
  return new Request('http://localhost/api/therapists/tid-1/profile', {
    method: 'POST',
    headers: { ...(headers || {}) },
    body: form,
  });
}

beforeEach(() => {
  fetchedTherapist = {
    id: 'tid-1',
    status: 'pending_verification',
    metadata: {},
    gender: null,
    city: null,
    accepting_new: null,
  };
  lastUpdate = null;
  uploads = [];
});

describe('/api/therapists/:id/profile POST', () => {
  it('404 when therapist not found, 401 when verified without session', async () => {
    const { POST } = await import('@/app/api/public/therapists/[id]/profile/route');
    fetchedTherapist = null;
    let res = await POST(makeJsonReq({}), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);

    // Verified therapists without session get 401 (requires auth)
    fetchedTherapist = { id: 'tid-1', status: 'verified', metadata: {} };
    res = await POST(makeJsonReq({}), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(401);
  });

  it('400 for invalid gender', async () => {
    const { POST } = await import('@/app/api/public/therapists/[id]/profile/route');
    const res = await POST(makeJsonReq({ gender: 'other' }), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('invalid gender');
  });

  it('400 when profile field too long', async () => {
    const { POST } = await import('@/app/api/public/therapists/[id]/profile/route');
    // who_comes_to_me limit is 200 chars
    const big = 'x'.repeat(201);
    const res = await POST(makeJsonReq({ who_comes_to_me: big }), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('who_comes_to_me too long');
  });

  it('JSON: updates basic fields and profile sections', async () => {
    const { POST } = await import('@/app/api/public/therapists/[id]/profile/route');
    const res = await POST(makeJsonReq({ 
      gender: 'female', 
      city: 'Berlin', 
      accepting_new: true, 
      who_comes_to_me: 'Hello',
      session_focus: 'Focus',
      first_session: 'First',
      about_me: 'About'
    }), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.ok).toBe(true);
    expect(lastUpdate).toBeTruthy();
    expect(lastUpdate.gender).toBe('female');
    expect(lastUpdate.city).toBe('Berlin');
    expect(lastUpdate.accepting_new).toBe(true);
    const meta = lastUpdate.metadata || {};
    expect(meta.profile).toBeTruthy();
    expect(meta.profile.who_comes_to_me).toBe('Hello');
    expect(meta.profile.session_focus).toBe('Focus');
    expect(meta.profile.first_session).toBe('First');
    expect(meta.profile.about_me).toBe('About');
  });

  it('Multipart: uploads photo to applications bucket and sets metadata.profile.photo_pending_path', async () => {
    const { POST } = await import('@/app/api/public/therapists/[id]/profile/route');
    const form = new FormData();
    form.set('profile_photo', new File([new Uint8Array([1,2,3])], 'photo.jpg', { type: 'image/jpeg' }));
    form.set('who_comes_to_me', 'Desc');
    const res = await POST(makeFormReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);
    expect(uploads.some(u => u.bucket === 'therapist-applications' && u.path.includes('applications/tid-1/profile-photo-'))).toBe(true);
    expect(lastUpdate).toBeTruthy();
    const meta = lastUpdate.metadata || {};
    expect(meta.profile).toBeTruthy();
    expect(typeof meta.profile.photo_pending_path).toBe('string');
    expect(meta.profile.who_comes_to_me).toBe('Desc');
  });
});
