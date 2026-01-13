import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
// Provide a default stub; we'll overwrite the export per test before importing the route
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: () => ({}) } }));

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Chainable supabase mock covering matches/people/therapists/therapist_slots/bookings
function makeSupabaseMock({
  ref,
  matches = [],
  therapists = [],
  patient,
  slots = [],
  bookings = [],
}: {
  ref: any,
  matches?: any[],
  therapists?: any[],
  patient: any,
  slots?: any[],
  bookings?: any[],
}) {
  return {
    from(table: string) {
      if (table === 'matches') {
        return {
          select(sel: string) {
            return {
              eq(col: string, val: any) {
                if (col === 'secure_uuid') {
                  return {
                    order() {
                      return {
                        limit() {
                          return Promise.resolve({ data: ref ? [ref] : [], error: null });
                        },
                      } as any;
                    },
                  } as any;
                }
                if (col === 'patient_id') {
                  return {
                    gte() { return { order() { return Promise.resolve({ data: matches, error: null }); } } as any; },
                    order() { return Promise.resolve({ data: matches, error: null }); },
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
      if (table === 'therapist_slots') {
        return {
          select() {
            return { in() { return { eq() { return { limit() { return Promise.resolve({ data: slots, error: null }); } } as any; } } as any; } } as any;
          },
        } as any;
      }
      if (table === 'bookings') {
        return {
          select() {
            return { in() { return { gte() { return { lte() { return { limit() { return Promise.resolve({ data: bookings, error: null }); } } as any; } } as any; } } as any; } } as any;
          },
        } as any;
      }
      return { select: () => ({}) } as any;
    },
  } as any;
}

describe('Matches API - Instant Flow Enhancements (EARTH-231)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('includes patient status, time_slots and match_type; caps therapists to 3', async () => {
    const uuid = 'abc-123';
    const patientId = 'p1';
    const ref = { id: 'ref1', created_at: isoDaysAgo(1), patient_id: patientId };
    const matches = [
      { id: 'm1', therapist_id: 't1', created_at: isoDaysAgo(1), metadata: {} },
      { id: 'm2', therapist_id: 't2', created_at: isoDaysAgo(1), metadata: {} },
      { id: 'm3', therapist_id: 't3', created_at: isoDaysAgo(1), metadata: {} },
      { id: 'm4', therapist_id: 't1', created_at: isoDaysAgo(1), metadata: {} },
    ];
    const therapists = [
      { id: 't1', first_name: 'A', last_name: 'One', session_preferences: ['online', 'in_person'], modalities: ['NARM'], accepting_new: true },
      { id: 't2', first_name: 'B', last_name: 'Two', session_preferences: ['online'], modalities: ['Hakomi'], accepting_new: true },
      { id: 't3', first_name: 'C', last_name: 'Three', session_preferences: ['in_person'], modalities: ['Somatic Experiencing'], accepting_new: true },
    ];
    const patient = { name: 'Max', status: 'pre_confirmation', metadata: { time_slots: ['Morgens (8-12 Uhr)'], session_preference: 'online' } };
    const slots = [
      { therapist_id: 't1', day_of_week: new Date().getDay(), time_local: '09:00', format: 'online', address: null, active: true },
    ];
    const supabase = makeSupabaseMock({ ref, matches, therapists, patient, slots, bookings: [] });
    const mod = await import('@/lib/supabase-server');
    // @ts-expect-error override mock export
    mod.supabaseServer = supabase;
    const { GET } = await import('@/app/api/public/matches/[uuid]/route');
    const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
    const res = await GET(req as any);
    const result = await res.json();

    expect(res.status).toBe(200);
    expect(result.data.patient.status).toBe('pre_confirmation');
    expect(result.data.metadata.match_type).toMatch(/^(exact|partial|none)$/);
    expect(result.data.therapists.length).toBeLessThanOrEqual(3);
  });

  // Note: availability test removed - Cal.com now handles all booking availability

  it('returns 410 when link expired; 404 for invalid UUID', async () => {
    // Expired
    {
      const uuid = 'expired-uuid';
      const ref = { id: 'ref1', created_at: isoDaysAgo(40), patient_id: 'p' };
      const supabase = makeSupabaseMock({ ref, matches: [], therapists: [], patient: { name: 'X', metadata: {} } });
      const mod = await import('@/lib/supabase-server');
      // @ts-expect-error override mock export
      mod.supabaseServer = supabase;
      const { GET } = await import('@/app/api/public/matches/[uuid]/route');
      const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
      const res = await GET(req as any);
      expect(res.status).toBe(410);
    }
    // Invalid UUID
    {
      const uuid = 'invalid-uuid-format';
      const supabase = makeSupabaseMock({ ref: null, matches: [], therapists: [], patient: { name: 'X', metadata: {} } });
      const mod = await import('@/lib/supabase-server');
      // @ts-expect-error override mock export
      mod.supabaseServer = supabase;
      const { GET } = await import('@/app/api/public/matches/[uuid]/route');
      const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
      const res = await GET(req as any);
      expect([404, 410]).toContain(res.status);
    }
  });
});
