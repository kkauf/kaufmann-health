import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastUpdate: any = null;
let uploads: Array<{ bucket: string; path: string; contentType: string; size: number }>; 
let therapistRow: { id: string; status: string; metadata?: any } | null = { id: 'tid-1', status: 'pending_verification', metadata: {} };

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer: any = {
    from: (table: string) => {
      if (table === 'therapists') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              single: async () => ({ data: therapistRow, error: therapistRow ? null : { message: 'not found' } }),
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

// Spy on google ads tracker
const trackConversion = vi.fn(async (_d: any) => {});
vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: { trackConversion },
}));

function makeReq(form: FormData, headers?: Record<string, string>) {
  return new Request('http://localhost/api/therapists/tid-1/documents', {
    method: 'POST',
    headers: { ...(headers || {}) },
    body: form,
  });
}

beforeEach(() => {
  lastUpdate = null;
  uploads = [];
  therapistRow = { id: 'tid-1', status: 'pending_verification', metadata: {} };
});

describe('/api/therapists/:id/documents POST', () => {
  it('400 when psychotherapy_license missing and certificate provided (license must be uploaded first)', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    const form = new FormData();
    form.set('specialization_cert', new File([new Uint8Array([0])], 'cert.pdf', { type: 'application/pdf' }));
    const res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('License must be uploaded first');
  });

  it('200 when specialization_cert omitted (optional)', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    const form = new FormData();
    form.set('psychotherapy_license', new File([new Uint8Array([0])], 'license.pdf', { type: 'application/pdf' }));
    const res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });
  });

  it('404 when therapist not found or not pending', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    therapistRow = null;
    let res = await POST(makeReq(new FormData()), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);

    therapistRow = { id: 'tid-1', status: 'verified', metadata: {} };
    const form = new FormData();
    form.set('psychotherapy_license', new File([new Uint8Array([0])], 'license.pdf', { type: 'application/pdf' }));
    form.set('specialization_cert', new File([new Uint8Array([0])], 'cert.pdf', { type: 'application/pdf' }));
    res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(404);
  });

  it('400 on invalid file type or size for license', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    // invalid type
    let form = new FormData();
    form.set('psychotherapy_license', new File([new Uint8Array([0])], 'license.gif', { type: 'image/gif' }));
    form.set('specialization_cert', new File([new Uint8Array([0])], 'cert.pdf', { type: 'application/pdf' }));
    let res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(400);

    // too large (4MB + 1)
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    form = new FormData();
    form.set('psychotherapy_license', new File([big], 'license.pdf', { type: 'application/pdf' }));
    form.set('specialization_cert', new File([new Uint8Array([0])], 'cert.pdf', { type: 'application/pdf' }));
    res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(400);
  });

  it('200 on success: uploads docs to correct buckets and updates metadata', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    const form = new FormData();
    form.set('psychotherapy_license', new File([new Uint8Array([0,1,2])], 'license.pdf', { type: 'application/pdf' }));
    form.set('specialization_cert', new File([new Uint8Array([3,4,5])], 'cert1.jpg', { type: 'image/jpeg' }));
    form.set('specialization_cert', new File([new Uint8Array([6,7,8])], 'cert2.png', { type: 'image/png' }));
    form.set('profile_photo', new File([new Uint8Array([9,10,11,12])], 'photo.jpg', { type: 'image/jpeg' }));
    form.set('approach_text', 'Kurzbeschreibung');

    const res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });

    // Verify uploads: expect license present, at least one specialization, and one profile photo
    expect(uploads.length).toBeGreaterThanOrEqual(3);
    expect(uploads.some(u => u.bucket === 'therapist-documents' && u.path.includes('therapists/tid-1/license-'))).toBe(true);
    const specUploads = uploads.filter(u => u.bucket === 'therapist-documents' && u.path.includes('therapists/tid-1/specialization-'));
    expect(specUploads.length).toBeGreaterThanOrEqual(1);
    expect(specUploads.length).toBeLessThanOrEqual(5);
    expect(uploads.some(u => u.bucket === 'therapist-applications' && u.path.includes('applications/tid-1/profile-photo-'))).toBe(true);

    // Verify metadata update shape
    expect(lastUpdate).toBeTruthy();
    const meta = lastUpdate.metadata || {};
    expect(meta.documents).toBeTruthy();
    expect(meta.documents.license).toContain('therapists/tid-1/license-');
    expect(Array.isArray(meta.documents.specialization.uncategorized)).toBe(true);
    expect(meta.documents.specialization.uncategorized.length).toBeGreaterThanOrEqual(1);
    const profile = meta.profile || {};
    expect(typeof profile.photo_pending_path).toBe('string');
    expect(profile.approach_text).toBe('Kurzbeschreibung');
  });

  it('fires therapist_registration conversion on successful upload', async () => {
    const { POST } = await import('@/app/api/therapists/[id]/documents/route');
    therapistRow = { id: 'tid-1', status: 'pending_verification', metadata: {}, email: 'therapist@example.com' } as any;
    const form = new FormData();
    form.set('psychotherapy_license', new File([new Uint8Array([0,1,2])], 'license.pdf', { type: 'application/pdf' }));
    const res = await POST(makeReq(form), { params: Promise.resolve({ id: 'tid-1' }) });
    expect(res.status).toBe(200);

    await Promise.resolve();
    expect(trackConversion).toHaveBeenCalledTimes(1);
    const call = trackConversion.mock.calls[0][0];
    expect(call.conversionAction).toBe('therapist_registration');
    expect(call.conversionValue).toBe(25);
    expect(call.orderId).toBe('tid-1');
    expect(call.email).toBe('therapist@example.com');
  });
});
