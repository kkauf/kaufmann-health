import { describe, it, expect, vi, beforeEach } from 'vitest';

let sentEmails: any[] = [];
let person: any = null;
let updateCalled = false;
let ipLimited = false;

// Mock email client to capture sends
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async (params: any) => {
    sentEmails.push(params);
  }),
}));

// Mock rate limiter with a toggle
vi.mock('@/lib/leads/rateLimit', () => ({
  isIpRateLimited: vi.fn(async () => ipLimited),
}));

// Minimal supabase mock
vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error('unexpected table');
      return {
        select: (_sel: string) => ({
          eq: (_col: string, _val: string) => ({
            eq: (_col2: string, _val2: string) => ({
              single: async () => ({ data: person, error: null }),
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: (_col: string, _val: string) => {
            updateCalled = true;
            if (person) {
              person.metadata = payload.metadata;
            }
            return { data: null, error: null };
          },
        }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads/resend-confirmation', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sentEmails = [];
  person = null;
  updateCalled = false;
  ipLimited = false;
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost';
});

describe('POST /api/leads/resend-confirmation', () => {
  it('always returns ok for invalid/unknown email and does not send', async () => {
    const { POST } = await import('@/app/api/public/leads/resend-confirmation/route');
    const res = await POST(makeReq({ email: 'not-an-email' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });
    expect(sentEmails.length).toBe(0);

    const res2 = await POST(makeReq({ email: 'unknown@example.com' }));
    expect(res2.status).toBe(200);
    expect(sentEmails.length).toBe(0);
  });

  it('reissues token and sends email for pre_confirmation', async () => {
    const now = Date.now();
    person = { id: 'p1', status: 'pre_confirmation', metadata: { confirm_sent_at: new Date(now - 11 * 60 * 1000).toISOString() } };

    const { POST } = await import('@/app/api/public/leads/resend-confirmation/route');
    const res = await POST(makeReq({ email: 'user@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.ok).toBe(true);

    // Email sent
    expect(sentEmails.length).toBe(1);
    const html: string = sentEmails[0].html;
    expect(html).toContain('/api/leads/confirm?token=');
    expect(html).toContain('&id=p1');

    // Metadata updated
    expect(person.metadata.confirm_token).toBeTruthy();
    expect(typeof person.metadata.confirm_sent_at).toBe('string');
    expect(updateCalled).toBe(true);
  });

  it('throttles resend within 10 minutes', async () => {
    person = { id: 'p2', status: 'pre_confirmation', metadata: { confirm_sent_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() } };

    const { POST } = await import('@/app/api/public/leads/resend-confirmation/route');
    const res = await POST(makeReq({ email: 'user2@example.com' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.ok).toBe(true);

    // No email and no metadata update when throttled
    expect(sentEmails.length).toBe(0);
    expect(updateCalled).toBe(false);
  });

  it('skips sending when IP is rate limited (still ok)', async () => {
    ipLimited = true;
    person = { id: 'p3', status: 'pre_confirmation', metadata: {} };

    const { POST } = await import('@/app/api/public/leads/resend-confirmation/route');
    const res = await POST(makeReq({ email: 'user3@example.com' }, { 'x-forwarded-for': '203.0.113.10' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.ok).toBe(true);

    expect(sentEmails.length).toBe(0);
    expect(updateCalled).toBe(false);
  });
});
