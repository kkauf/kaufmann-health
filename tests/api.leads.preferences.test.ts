import { describe, it, expect, vi, beforeEach } from 'vitest';

let selectPayload: any = null;
let updatePayload: any = null;
let personRow: any = null;

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error('unexpected table');
      return {
        select: (_sel: string) => ({
          eq: (_col: string, _val: string) => ({
            single: async () => ({ data: personRow, error: null }),
          }),
        }),
        update: (payload: any) => ({
          eq: (_col: string, _val: string) => {
            updatePayload = payload;
            return { data: null, error: null };
          },
        }),
      };
    },
  };
  return { supabaseServer: api };
});

// server analytics mocked to avoid network
vi.mock('@/lib/server-analytics', async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    ServerAnalytics: {
      ...mod.ServerAnalytics,
      trackEventFromRequest: vi.fn(async () => {}),
    },
  };
});

function makeReq(url: string, body?: any) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  selectPayload = null;
  updatePayload = null;
  personRow = { id: 'p1', type: 'patient', metadata: {} };
});

describe('POST /api/leads/[id]/preferences', () => {
  it('returns 400 when id missing', async () => {
    const { POST } = await import('@/app/api/leads/[id]/preferences/route');
    const res = await POST(makeReq('http://localhost/api/leads//preferences'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when person not found', async () => {
    personRow = null;
    const { POST } = await import('@/app/api/leads/[id]/preferences/route');
    const res = await POST(makeReq('http://localhost/api/leads/p1/preferences', {
      name: 'Max', city: 'Berlin', consent_share_with_therapists: true, privacy_version: '2025-09-01.v1'
    }));
    expect(res.status).toBe(404);
  });

  it('validates required fields and consent', async () => {
    const { POST } = await import('@/app/api/leads/[id]/preferences/route');
    let res = await POST(makeReq('http://localhost/api/leads/p1/preferences', { name: '', city: '', consent_share_with_therapists: false }));
    expect(res.status).toBe(400);
    const json1 = await res.json();
    expect(json1.error).toBeTruthy();

    res = await POST(makeReq('http://localhost/api/leads/p1/preferences', { name: 'Max', city: 'Berlin', consent_share_with_therapists: false }));
    expect(res.status).toBe(400);
    const json2 = await res.json();
    expect(json2.error).toContain('Einwilligung');
  });

  it('updates metadata and returns ok', async () => {
    const { POST } = await import('@/app/api/leads/[id]/preferences/route');
    const res = await POST(makeReq('http://localhost/api/leads/p1/preferences', {
      name: 'Max',
      city: 'Berlin',
      issue: 'Stress',
      session_preference: 'online',
      consent_share_with_therapists: true,
      privacy_version: '2025-09-01.v2',
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.ok).toBe(true);
    expect(updatePayload).toBeTruthy();
    expect(updatePayload.name).toBe('Max');
    expect(updatePayload.metadata.city).toBe('Berlin');
    expect(updatePayload.metadata.session_preference).toBe('online');
    expect(updatePayload.metadata.consent_share_with_therapists).toBe(true);
    expect(updatePayload.metadata.consent_privacy_version).toBe('2025-09-01.v2');
  });
});
