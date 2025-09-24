import { describe, it, expect, vi, beforeEach } from 'vitest';

let sentEmails: any[] = [];

// Mock email client to capture email sends
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async (params: any) => { sentEmails.push(params); }),
}));

// Minimal supabase mock for email-only flow
let insertedId = 'lead-emailonly-1';
let simulateUniqueViolation = false;
let existingStatus: string | null = null;

vi.mock('@/lib/supabase-server', () => {
  const api: any = {
    from: (table: string) => {
      if (table !== 'people') throw new Error('unexpected table');
      return {
        insert: (_payload: any) => ({
          select: (_sel?: string) => ({
            single: async () => {
              if (simulateUniqueViolation) return { data: null, error: { code: '23505' } };
              return { data: { id: insertedId }, error: null };
            },
          }),
        }),
        select: (_sel?: string) => ({
          eq: (_col: string, _val: string) => ({
            single: async () => {
              if (!simulateUniqueViolation) return { data: { id: insertedId }, error: null };
              return { data: { id: insertedId, status: existingStatus ?? 'pre_confirmation', metadata: {} }, error: null };
            },
          }),
        }),
        update: (_payload: any) => ({ eq: (_col: string, _val: string) => ({ data: null, error: null }) }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads?v=B', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer: 'http://localhost/ankommen-in-dir?utm_source=x', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.REQUIRE_EMAIL_CONFIRMATION = 'true';
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost';
  sentEmails = [];
  simulateUniqueViolation = false;
  existingStatus = null;
});

describe('EARTH-146 /api/leads POST (email-only)', () => {
  it('creates pre_confirmation lead and sends confirmation email', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(makeReq({ email: 'user@example.com', type: 'patient' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.id).toBe(insertedId);
    expect(json.data.requiresConfirmation).toBe(true);

    expect(sentEmails.length).toBe(1);
    const html: string = sentEmails[0].html;
    expect(html).toContain('/api/leads/confirm?token=');
    expect(html).toContain(`&id=${insertedId}`);
  });

  it('treats existing confirmed email as success without resending', async () => {
    simulateUniqueViolation = true;
    existingStatus = 'new';
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(makeReq({ email: 'user@example.com', type: 'patient' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.id).toBe(insertedId);
    expect(json.data.requiresConfirmation).toBe(false);
    expect(sentEmails.length).toBe(0);
  });
});
