import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastTherapistInsert: any = null;
let lastTherapistUpdate: any = null;
let uploads: Array<{ bucket: string; path: string; contentType: string; size: number }>; 

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer: any = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          insert: (payload: any) => {
            lastTherapistInsert = payload;
            return {
              select: () => ({ single: () => Promise.resolve({ data: { id: 'tid-1' }, error: null }) }),
            };
          },
          update: (payload: any) => {
            lastTherapistUpdate = payload;
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        } as any;
      }
      if (table === 'therapist_contracts') {
        return { insert: () => Promise.resolve({ data: { id: 'cid-1' }, error: null }) } as any;
      }
      // people not needed as we skip IP header for multipart path
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, data: ArrayBuffer | Buffer | Blob, opts: { contentType?: string }) => {
          const size = (data as any).size ?? (data as Buffer).byteLength ?? 0;
          uploads.push({ bucket, path, contentType: opts.contentType || '', size });
          return { data: { path }, error: null };
        },
      }),
    },
  };
  return { supabaseServer };
});

vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('@/lib/google-ads', () => ({ googleAdsTracker: { trackConversion: vi.fn(async () => {}) } }));

function makeMultipartReq(form: FormData, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { ...(headers || {}) },
    body: form,
  });
}

beforeEach(() => {
  lastTherapistInsert = null;
  lastTherapistUpdate = null;
  uploads = [];
});

describe('/api/leads POST (multipart therapist profile fields)', () => {
  it('400 when approach_text exceeds 2000 chars', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const form = new FormData();
    form.set('type', 'therapist');
    form.set('email', 't@example.com');
    form.set('name', 'T Name');
    // Minimal required license
    const lic = new File([new Uint8Array([0, 1, 2])], 'license.png', { type: 'image/png' });
    form.set('license', lic);
    form.set('approach_text', 'x'.repeat(2001));

    const res = await POST(makeMultipartReq(form));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('approach_text too long');
  });

  it('valid profile_photo and approach_text stored (pending path), upload to applications bucket', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const form = new FormData();
    form.set('type', 'therapist');
    form.set('email', 't2@example.com');
    form.set('name', 'Thera Two');
    // Required license
    form.set('license', new File([new Uint8Array([0, 1, 2, 3])], 'license.pdf', { type: 'application/pdf' }));
    // Optional profile photo
    form.set('profile_photo', new File([new Uint8Array([0, 1, 2, 3, 4])], 'photo.jpg', { type: 'image/jpeg' }));
    form.set('approach_text', 'My approach');

    const res = await POST(makeMultipartReq(form));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'tid-1' }, error: null });

    // Assert upload occurred to therapist-applications
    expect(uploads.some(u => u.bucket === 'therapist-applications' && u.path.includes('applications/tid-1/profile-photo-'))).toBe(true);
    // Assert metadata update contains profile with pending path and approach text
    expect(lastTherapistUpdate).toBeTruthy();
    const meta = (lastTherapistUpdate.metadata || {}) as any;
    expect(meta.documents).toBeTruthy();
    const profile = meta.profile || {};
    expect(typeof profile.photo_pending_path).toBe('string');
    expect(profile.photo_pending_path).toContain('applications/tid-1/profile-photo-');
    expect(profile.approach_text).toBe('My approach');
  });

  it('rejects invalid profile_photo type', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const form = new FormData();
    form.set('type', 'therapist');
    form.set('email', 't3@example.com');
    form.set('name', 'Thera Three');
    form.set('license', new File([new Uint8Array([0])], 'license.pdf', { type: 'application/pdf' }));
    form.set('profile_photo', new File([new Uint8Array([0])], 'photo.gif', { type: 'image/gif' }));

    const res = await POST(makeMultipartReq(form));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unsupported file type');
  });
});
