import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state for the supabase mock
let rateLimited = false;
let lastInsertedPayload: any = null;
let insertError: any = null;
let insertResultId = 'test-id-123';

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          // Rate limit query chain
          select: (_cols?: string) => ({
            contains: (_col?: string, _val?: any) => ({
              gte: (_col?: string, _cutoff?: string) => ({
                limit: (_n?: number) =>
                  Promise.resolve({ data: rateLimited ? [{}] : [], error: null }),
              }),
            }),
          }),
          // Insert path
          insert: (payload: any) => {
            lastInsertedPayload = payload;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve(
                    insertError
                      ? { data: null, error: insertError }
                      : { data: { id: insertResultId }, error: null },
                  ),
              }),
            };
          },
        } as any;
      }
      if (table === 'therapist_contracts') {
        return {
          insert: (_payload: any) => Promise.resolve({ data: { id: 'contract-id' }, error: null }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;

  return { supabaseServer };
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimited = false;
  lastInsertedPayload = null;
  insertError = null;
  insertResultId = 'test-id-123';
  // Ensure notification code is disabled
  process.env.RESEND_API_KEY = '';
  process.env.LEADS_NOTIFY_EMAIL = '';
});

describe('/api/leads POST', () => {
  it('400 on invalid email', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(makeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Invalid email' });
  });

  it('429 when rate limited by IP within 60s', async () => {
    rateLimited = true;
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({ email: 'user@example.com' }, { 'x-forwarded-for': '1.2.3.4' }),
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Rate limited' });
  });

  it('200 on success and filters specializations to allowed set', async () => {
    const { POST } = await import('@/app/api/leads/route');
    const res = await POST(
      makeReq({
        email: 'ok@example.com',
        type: 'therapist',
        specializations: ['narm', 'invalid', 'somatic-experiencing', ' Hakomi '],
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'test-id-123' }, error: null });

    // Assert payload was filtered and normalized
    expect(lastInsertedPayload).toBeTruthy();
    const specs = lastInsertedPayload.metadata?.specializations || [];
    // Order is preserved for allowed entries after normalization
    expect(specs).toEqual(['narm', 'somatic-experiencing', 'hakomi']);
  });
});
