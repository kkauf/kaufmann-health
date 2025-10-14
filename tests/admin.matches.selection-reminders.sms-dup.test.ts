import { describe, it, expect, vi, beforeEach } from 'vitest';

let events: any[] = [];

// Fixtures
let matchesRows: Array<{ id: string; patient_id: string; therapist_id: string; status: string; created_at: string }>; 
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

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (cols?: string) => {
            if (cols && cols.includes('secure_uuid')) {
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
            // Chain: eq('status','proposed').order('created_at', { ascending: false }).lt(...).gte(...).limit(1000)
            const chain: any = {
              eq: () => chain,
              order: () => chain,
              lt: () => chain,
              gte: () => chain,
              limit: async () => ({ data: matchesRows, error: null }),
            };
            return chain;
          },
        } as any;
      }
      if (table === 'events') {
        return {
          select: () => ({
            in: () => ({
              gte: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'e-1',
                        properties: { kind: 'patient_selection_reminder', stage: '24h', patient_id: 'p-1' },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              single: async () => {
                const p = peopleById[id];
                return p ? { data: p, error: null } : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: () => ({
            in: (_c: string, ids: string[]) => Promise.resolve({ data: ids.map((id) => therapistsById[id]).filter(Boolean), error: null }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makeGet(url: string, headers?: Record<string, string>) {
  return new Request(url, {
    method: 'GET',
    headers: { cookie: 'kh_admin=token', origin: 'http://localhost', host: 'localhost', ...(headers || {}) } as any,
  });
}

beforeEach(() => {
  events = [];
  matchesRows = [
    { id: 'm-1', patient_id: 'p-1', therapist_id: 't-1', status: 'proposed', created_at: new Date().toISOString() },
  ];
  peopleById = {
    'p-1': { id: 'p-1', name: 'K', email: '', phone_number: '+491234567890', metadata: {} },
  };
  therapistsById = {
    't-1': { id: 't-1', first_name: 'T', last_name: 'X', modalities: [], metadata: { profile: {} }, accepting_new: true },
  };
  secureUuidByPatient = { 'p-1': 'su-1' };
});

describe('/api/admin/matches/selection-reminders GET duplicate stage using sms_sent', () => {
  it('skips sending when an sms_sent exists for the stage window', async () => {
    const { GET } = await import('@/app/api/admin/matches/selection-reminders/route');
    const res = await GET(makeGet('http://localhost/api/admin/matches/selection-reminders?stage=24h'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.skipped_duplicate_stage).toBeGreaterThanOrEqual(1);
  });
});
