import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: () => ({}) } }));

describe('GET /api/public/matches/:uuid duplicate secure_uuid fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('falls back to latest row when .single() fails to coerce', async () => {
    const uuid = 'dup-uuid-1';
    const patientId = 'patient-x';
    const therapistId = 'therapist-y';
    const ref = { id: 'ref-x', created_at: new Date().toISOString(), patient_id: patientId };
    const list = [{ id: 'm1', therapist_id: therapistId, created_at: new Date().toISOString(), metadata: { patient_initiated: true } }];
    const therapists = [{ id: therapistId, first_name: 'Anna', last_name: 'Schmidt', city: 'Berlin', accepting_new: true }];
    const patient = { name: 'Max', metadata: { issue: 'Panik' } };

    let secureUuidCalls = 0;

    const supabase = {
      from(table: string) {
        if (table === 'matches') {
          return {
            select() {
              return {
                eq(col: string, val: any) {
                  if (col === 'secure_uuid') {
                    secureUuidCalls += 1;
                    if (secureUuidCalls === 1) {
                      return { single: async () => ({ data: null, error: { message: 'Cannot coerce the result to a single JSON object' } }) } as any;
                    }
                    return {
                      order() {
                        return {
                          limit() {
                            return Promise.resolve({ data: [ref], error: null });
                          },
                        } as any;
                      },
                    } as any;
                  }
                  if (col === 'patient_id') {
                    return {
                      gte() {
                        return { order() { return Promise.resolve({ data: list, error: null }); } } as any;
                      },
                    } as any;
                  }
                  return { single: async () => ({ data: null, error: { message: 'not found' } }) } as any;
                },
              } as any;
            },
          } as any;
        }
        if (table === 'people') {
          return {
            select() {
              return { eq() { return { single: async () => ({ data: patient, error: null }) } as any; } } as any;
            },
          } as any;
        }
        if (table === 'therapists') {
          return {
            select() {
              return { in() { return Promise.resolve({ data: therapists, error: null }); } } as any;
            },
          } as any;
        }
        return { select: () => ({}) } as any;
      },
    } as any;

    const mod = await import('@/lib/supabase-server');
    // @ts-expect-error override mock
    mod.supabaseServer = supabase;

    const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
    const { GET } = await import('@/app/api/public/matches/[uuid]/route');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json?.data?.patient?.name).toBe('Max');
    expect(Array.isArray(json?.data?.therapists)).toBe(true);
  });
});
