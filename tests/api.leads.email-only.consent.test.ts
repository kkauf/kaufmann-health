import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks and shared state
let lastInsertPayload: any = null;
let nextInsertId = 'p_ok';
let simulateSchemaCacheFailure = false;

vi.mock('@/lib/leads/rateLimit', () => ({
  isIpRateLimited: vi.fn(async () => false),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

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

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error(`unexpected table ${table}`);
      return {
        insert: (payload: any) => {
          lastInsertPayload = payload;
          return {
            select: (_sel: string) => ({
              single: async () => {
                // Simulate schema cache failure on first attempt when campaign fields are present
                if (simulateSchemaCacheFailure && payload && 'campaign_source' in payload) {
                  return { data: null, error: { message: 'schema cache out of date' } };
                }
                return { data: { id: nextInsertId }, error: null };
              },
            }),
          };
        },
        // The email-only path may look up existing emails only on unique violation; our tests don't trigger that path
        select: (_sel: string) => ({ eq: (_col: string, _val: string) => ({ single: async () => ({ data: null, error: null }) }) }),
        update: (_payload: any) => ({ eq: (_col: string, _val: string) => ({ data: null, error: null }) }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any, referer: string = 'http://localhost/wieder-lebendig?v=C') {
  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  lastInsertPayload = null;
  nextInsertId = 'p_ok';
  simulateSchemaCacheFailure = false;
});

describe('POST /api/public/leads (email-only consent)', () => {
  it('returns 400 when privacy_version missing', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const req = makeReq({ email: 'test@example.com', type: 'patient', consent_share_with_therapists: true });
    const res = await POST(req as any);
    if (!res) throw new Error('Expected Response from POST /api/public/leads');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(String(json.error)).toContain('Datenschutz'); // message: "Datenschutzhinweis erforderlich"
  });

  it('persists consent metadata when privacy_version present', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const req = makeReq({ email: 'test@example.com', type: 'patient', consent_share_with_therapists: true, privacy_version: '2025-09-01.v2' });
    const res = await POST(req as any);
    if (!res) throw new Error('Expected Response from POST /api/public/leads');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toBeTruthy();
    expect(json.data.id).toBe(nextInsertId);
    expect(json.data.requiresConfirmation).toBe(true);
    // Verify consent metadata persisted on insert
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.metadata).toBeTruthy();
    expect(lastInsertPayload.metadata.consent_share_with_therapists).toBe(true);
    expect(lastInsertPayload.metadata.consent_privacy_version).toBe('2025-09-01.v2');
    expect(typeof lastInsertPayload.metadata.consent_share_with_therapists_at).toBe('string');
  });

  it('schema mismatch retry still persists consent metadata', async () => {
    simulateSchemaCacheFailure = true;
    nextInsertId = 'p_retry';
    const { POST } = await import('@/app/api/public/leads/route');
    const req = makeReq({ email: 'test@example.com', type: 'patient', consent_share_with_therapists: true, privacy_version: '2025-09-01.v2' });
    const res = await POST(req as any);
    if (!res) throw new Error('Expected Response from POST /api/public/leads');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.id).toBe('p_retry');
    // The last successful insert (fallback without campaign fields) should still include consent metadata
    expect(lastInsertPayload).toBeTruthy();
    expect(lastInsertPayload.metadata).toBeTruthy();
    expect(lastInsertPayload.metadata.consent_share_with_therapists).toBe(true);
    expect(lastInsertPayload.metadata.consent_privacy_version).toBe('2025-09-01.v2');
  });
});
