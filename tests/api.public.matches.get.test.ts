import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/public/matches/[uuid]/route';

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

// Simple chainable supabase mock
function makeSupabaseMock(ref: any, list: any[], therapists: any[], patient: any) {
  return {
    from(table: string) {
      if (table === 'matches') {
        return {
          select(sel: string) {
            return {
              eq(col: string, val: any) {
                if (col === 'secure_uuid') {
                  return {
                    async single() {
                      return { data: ref, error: ref ? null : { message: 'not found' } };
                    },
                  } as any;
                }
                if (col === 'patient_id') {
                  return {
                    gte() {
                      return {
                        order() {
                          return Promise.resolve({ data: list, error: null });
                        },
                      } as any;
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
            return {
              eq() {
                return { single: async () => ({ data: patient, error: null }) } as any;
              },
            } as any;
          },
        } as any;
      }
      if (table === 'therapists') {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({ data: therapists, error: null });
              },
            } as any;
          },
        } as any;
      }
      return { select: () => ({}) } as any;
    },
  } as any;
}

vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: () => ({}) } }));

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('GET /api/public/matches/:uuid', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns patient context and therapist list', async () => {
    const uuid = 'abc-123';
    const patientId = 'patient-1';
    const therapistId = 'therapist-1';
    const ref = { id: 'ref-1', created_at: isoDaysAgo(1), patient_id: patientId };
    const list = [{ id: 'm1', therapist_id: therapistId, created_at: isoDaysAgo(1), metadata: { patient_initiated: true } }];
    const therapists = [{ id: therapistId, first_name: 'Anna', last_name: 'Schmidt', city: 'Berlin', accepting_new: true }];
    const patient = { name: 'Max', metadata: { issue: 'Panik' } };

    const supabase = makeSupabaseMock(ref, list, therapists, patient);
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

  it('returns 410 when link expired', async () => {
    const uuid = 'expired-uuid';
    const ref = { id: 'ref-1', created_at: isoDaysAgo(40), patient_id: 'p1' };
    const supabase = makeSupabaseMock(ref, [], [], { name: 'X', metadata: {} });
    const mod = await import('@/lib/supabase-server');
    // @ts-expect-error override mock
    mod.supabaseServer = supabase;

    const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
    const { GET } = await import('@/app/api/public/matches/[uuid]/route');
    const res = await GET(req as any);
    expect(res.status).toBe(410);
  });
});
