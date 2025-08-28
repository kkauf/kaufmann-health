import { describe, it, expect, vi } from 'vitest';

// Avoid touching real supabase-server which requires env vars
vi.mock('@/lib/supabase-server', () => {
  return {
    supabaseServer: {
      from: () => ({
        select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'x' }, error: null }) }) }),
      }),
    },
  } as any;
});

function makeGet(url: string, headers?: Record<string, string>) {
  return new Request(url, { method: 'GET', headers });
}

function makePost(url: string, body?: any, headers?: Record<string, string>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Admin API unauthorized', () => {
  it('GET /admin/api/leads returns 401 without admin cookie', async () => {
    const { GET } = await import('@/app/admin/api/leads/route');
    const res = await GET(makeGet('http://localhost/admin/api/leads'));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Unauthorized' });
  });

  it('GET /admin/api/therapists returns 401 without admin cookie', async () => {
    const { GET } = await import('@/app/admin/api/therapists/route');
    const res = await GET(makeGet('http://localhost/admin/api/therapists'));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Unauthorized' });
  });

  it('POST /admin/api/matches returns 401 without admin cookie', async () => {
    const { POST } = await import('@/app/admin/api/matches/route');
    const res = await POST(
      makePost('http://localhost/admin/api/matches', {
        patient_id: '00000000-0000-0000-0000-000000000000',
        therapist_id: '11111111-1111-1111-1111-111111111111',
      }),
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Unauthorized' });
  });
});
