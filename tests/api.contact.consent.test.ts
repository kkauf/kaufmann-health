import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRIVACY_VERSION } from '@/lib/privacy';

// Captured calls
let lastPeopleInsert: any = null;
let lastPeopleUpdate: any = null;
let existingPatientId: string | null = null;
let lastTracked: Array<{ type: string; props?: Record<string, unknown> }> = [];

// Therapist/match stubs
const THERAPIST_ID = 't_ok';

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async () => true),
}));

vi.mock('@/lib/logger', async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    track: vi.fn(async (evt: any) => {
      lastTracked.push({ type: evt?.type, props: evt?.props });
    }),
    logError: vi.fn(async () => {}),
  };
});

vi.mock('@/lib/auth/clientSession', () => ({
  getClientSession: vi.fn(async () => null),
  createClientSessionToken: vi.fn(async () => 'tok'),
  createClientSessionCookie: vi.fn(() => 'kh_client=tok; Path=/; HttpOnly'),
}));

vi.mock('@/lib/supabase-server', () => {
  function peopleApi() {
    return {
      insert: (payload: any) => {
        lastPeopleInsert = payload;
        return {
          select: (_sel: string) => ({ single: async () => ({ data: { id: 'p_new' }, error: null }) }),
        };
      },
      select: (sel: string) => {
        const chain: any = {
          _filters: [] as Array<{ col: string; val: unknown }>,
          eq(col: string, val: unknown) {
            this._filters.push({ col, val });
            return this;
          },
          single: async () => {
            if (sel.includes('id')) {
              // Existing patient lookup by contact
              if (existingPatientId) return { data: { id: existingPatientId }, error: null };
              return { data: null, error: null };
            }
            if (sel.includes('metadata')) {
              return { data: { metadata: {} }, error: null };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
      update: (payload: any) => {
        lastPeopleUpdate = payload;
        return { eq: (_col: string, _val: unknown) => ({ data: null, error: null }) };
      },
    };
  }
  function therapistsApi() {
    return {
      select: (_sel: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_c2: string, _v2: unknown) => ({ single: async () => ({ data: { id: THERAPIST_ID, first_name: 'T', last_name: 'X', email: 't@example.com' }, error: null }) }),
        }),
      }),
    };
  }
  function matchesApi() {
    return {
      select: (_sel: string) => ({
        eq: (_col: string, _val: unknown) => ({
          gte: (_c2: string, _v2: unknown) => ({ async then(resolve: any) { resolve({ data: [], error: null }); } }),
        }),
      }),
      insert: (_payload: any) => ({ select: (_sel: string) => ({ single: async () => ({ data: { id: 'm1', secure_uuid: 's1' }, error: null }) }) }),
    };
  }
  const api: any = {
    from: (table: string) => {
      if (table === 'people') return peopleApi();
      if (table === 'therapists') return therapistsApi();
      if (table === 'matches') return matchesApi();
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { supabaseServer: api };
});

function makeReq(body: any) {
  return new Request('http://localhost/api/public/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer: 'http://localhost/therapeuten' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  lastPeopleInsert = null;
  lastPeopleUpdate = null;
  existingPatientId = null;
  lastTracked = [];
});

describe('POST /api/public/contact (consent)', () => {
  it('stores consent markers in metadata for new patients and tracks consent_captured', async () => {
    const { POST } = await import('@/app/api/public/contact/route');
    const req = makeReq({
      therapist_id: THERAPIST_ID,
      contact_type: 'booking',
      patient_name: 'Alice',
      patient_email: 'alice@example.com',
      contact_method: 'email',
      patient_reason: 'Anliegen',
      session_format: 'online',
    });
    const res = await POST(req as any);
    expect(res?.status).toBe(200);

    // Insert path has metadata with consent markers
    expect(lastPeopleInsert?.metadata?.consent_share_with_therapists).toBe(true);
    expect(lastPeopleInsert?.metadata?.consent_privacy_version).toBe(PRIVACY_VERSION);
    expect(typeof lastPeopleInsert?.metadata?.consent_share_with_therapists_at).toBe('string');
    expect(lastPeopleInsert?.metadata?.consent_terms_version).toEqual(PRIVACY_VERSION ? expect.any(String) : undefined);

    // Update path merges consent markers
    expect(lastPeopleUpdate?.metadata?.consent_share_with_therapists).toBe(true);
    expect(lastPeopleUpdate?.metadata?.consent_privacy_version).toBe(PRIVACY_VERSION);
    expect(typeof lastPeopleUpdate?.metadata?.consent_terms_version).toBe('string');

    // Analytics
    const hasConsentCaptured = lastTracked.some((e) => e.type === 'consent_captured' && (e.props as any)?.privacy_version === PRIVACY_VERSION);
    expect(hasConsentCaptured).toBe(true);
  });

  it('merges consent markers for existing patients and tracks consent_captured', async () => {
    existingPatientId = 'p_exist';
    const { POST } = await import('@/app/api/public/contact/route');
    const req = makeReq({
      therapist_id: THERAPIST_ID,
      contact_type: 'consultation',
      patient_name: 'Bob',
      patient_email: 'bob@example.com',
      contact_method: 'email',
      patient_reason: 'Frage',
      session_format: 'online',
    });
    const res = await POST(req as any);
    expect(res?.status).toBe(200);

    // No insert in this path
    expect(lastPeopleInsert).toBeNull();
    // Update path merges consent markers
    expect(lastPeopleUpdate?.metadata?.consent_share_with_therapists).toBe(true);
    expect(lastPeopleUpdate?.metadata?.consent_privacy_version).toBe(PRIVACY_VERSION);

    const hasConsentCaptured = lastTracked.some((e) => e.type === 'consent_captured' && (e.props as any)?.method === 'email');
    expect(hasConsentCaptured).toBe(true);
  });
});
