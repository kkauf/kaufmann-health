import { describe, it, expect, vi, beforeEach } from 'vitest';

let insertedId = 'lead-phone-1';
let simulateUniqueViolation = false;
let existingRow: any = null;
let capturedUpdate: any = null;

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
            single: async () => ({ data: existingRow, error: null }),
          }),
        }),
        update: (payload: any) => ({
          eq: (_col: string, _val: string) => {
            capturedUpdate = payload;
            return { data: null, error: null };
          },
        }),
      };
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/public/leads?v=C', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      referer: 'http://localhost/ankommen-in-dir?v=C',
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  capturedUpdate = null;
  simulateUniqueViolation = true;
  existingRow = { id: insertedId, name: null, status: 'new', metadata: {} };
});

describe('POST /api/public/leads (phone) upserts missing attributes for existing new lead', () => {
  it('upserts name, campaign, and form_session_id for existing new phone lead', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(
      makeReq({
        type: 'patient',
        name: 'John Doe',
        phone_number: '+4917612345678',
        contact_method: 'phone',
        form_session_id: 'fs-1',
        consent_share_with_therapists: true,
        privacy_version: 'test-v1',
      }),
    );
    expect(res).toBeTruthy();
    const json = await res!.json();
    expect(json.error).toBeNull();
    expect(json.data.id).toBe(insertedId);
    expect(json.data.requiresConfirmation).toBe(false);

    expect(capturedUpdate).toBeTruthy();
    expect(capturedUpdate.name).toBe('John Doe');
    expect(capturedUpdate.campaign_source).toBe('/ankommen-in-dir');
    expect(capturedUpdate.campaign_variant).toBe('c');
    const meta = capturedUpdate.metadata as Record<string, unknown> | undefined;
    expect(meta).toBeTruthy();
    expect(meta!['form_session_id']).toBe('fs-1');
    expect(meta!['contact_method']).toBe('phone');
  });
});
