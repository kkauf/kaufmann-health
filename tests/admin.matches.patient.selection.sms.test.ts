import { describe, it, expect, vi, beforeEach } from 'vitest';

let events: any[] = [];
let smsCalls: Array<{ to: string; body: string }> = [];

// In-memory fixtures
let peopleById: Record<string, any> = {};
let therapistsById: Record<string, any> = {};
let secureUuidByPatient: Record<string, string> = {};

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn(async () => true),
}));

vi.mock('@/lib/logger', () => ({
  track: vi.fn(async (p: any) => { events.push(p); }),
  logError: vi.fn(async () => {}),
}));

vi.mock('@/lib/sms/client', () => ({
  sendTransactionalSms: vi.fn(async (to: string, body: string) => {
    smsCalls.push({ to, body });
    return true;
  }),
}));

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                const p = peopleById[id];
                return p ? { data: p, error: null } : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
          update: (_payload: any) => ({
            eq: (_col: string, _id: string) => {
              // pretend update success
              return Promise.resolve({ data: null, error: null });
            },
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            in: (_col: string, ids: string[]) => {
              const arr = ids.map((id) => therapistsById[id]).filter(Boolean);
              return Promise.resolve({ data: arr, error: null });
            },
          }),
        } as any;
      }
      if (table === 'matches') {
        return {
          select: (cols?: string) => {
            if (cols && cols.includes('secure_uuid')) {
              // chain: eq(...).not(...).order(...).limit(1).maybeSingle()
              let pid = '';
              return {
                eq: (_c: string, p: string) => {
                  pid = p;
                  return {
                    not: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: { secure_uuid: secureUuidByPatient[pid] || 'su-test' }, error: null }),
                        }),
                      }),
                    }),
                  } as any;
                },
              } as any;
            }
            if (cols && cols.includes('therapist_id')) {
              // chain: eq('patient_id', ...).eq('status','proposed').order(...).limit(3)
              return {
                eq: () => ({
                  eq: () => ({
                    order: () => ({
                      limit: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              } as any;
            }
            return { eq: () => ({ single: async () => ({ data: null, error: { message: 'not used' } }) }) } as any;
          },
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makePost(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/admin/matches/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'kh_admin=token', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  events = [];
  smsCalls = [];
  peopleById = {};
  therapistsById = {};
  secureUuidByPatient = {};
});

describe('/api/admin/matches/email selection SMS fallback', () => {
  it('sends SMS when patient has no email but has phone, and tracks events', async () => {
    const patient_id = 'p-1';
    const therapist_ids = ['t-1', 't-2'];
    peopleById[patient_id] = { id: patient_id, name: 'K X', email: null, phone_number: '+491234567890', metadata: {} };
    therapistsById['t-1'] = { id: 't-1', first_name: 'A', last_name: 'B', modalities: [], metadata: { profile: {} }, accepting_new: true };
    therapistsById['t-2'] = { id: 't-2', first_name: 'C', last_name: 'D', modalities: [], metadata: { profile: {} }, accepting_new: true };
    secureUuidByPatient[patient_id] = 'su-abc';

    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(makePost({ template: 'selection', patient_id, therapist_ids }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true, via: 'sms' }, error: null });

    expect(smsCalls.length).toBe(1);
    const sms = smsCalls[0];
    expect(sms.to).toBe('+491234567890');
    expect(sms.body).toContain('/matches/su-abc');

    const types = events.map((e) => e.type);
    expect(types).toContain('sms_attempted');
    expect(types).toContain('sms_sent');
  });
});
