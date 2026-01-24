/**
 * Regression test: Ensure matches API includes Cal.com fields in therapist response.
 *
 * Note: cal_bookings_live is no longer used. Booking availability is now determined
 * automatically by cached slot data. New Cal.com accounts start with 0 availability,
 * so booking buttons only appear when therapist sets up their schedule.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

vi.mock('@/lib/auth/clientSession', () => ({
  createClientSessionToken: vi.fn().mockResolvedValue('mock-token'),
  createClientSessionCookie: vi.fn().mockReturnValue('mock-cookie'),
}));

vi.mock('@/lib/availability', () => ({
  computeAvailability: vi.fn().mockResolvedValue(new Map()),
  getBerlinDayIndex: vi.fn().mockReturnValue(0),
}));

function makeSupabaseMock(ref: any, list: any[], therapists: any[], patient: any) {
  return {
    from(table: string) {
      if (table === 'matches') {
        return {
          select() {
            return {
              eq(col: string) {
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
      if (table === 'cal_bookings') {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return {
                      eq() {
                        return {
                          eq() {
                            return Promise.resolve({ data: [], error: null });
                          },
                        } as any;
                      },
                    } as any;
                  },
                } as any;
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

describe('Matches API Cal.com fields regression', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('includes cal_enabled and cal_username in therapist response', async () => {
    const uuid = 'test-uuid-123';
    const patientId = 'patient-1';
    const therapistId = 'therapist-peter';

    const ref = { id: 'ref-1', created_at: isoDaysAgo(1), patient_id: patientId };
    const list = [{ id: 'm1', therapist_id: therapistId, created_at: isoDaysAgo(1), metadata: {} }];

    // Therapist with Cal.com fields set
    const therapists = [
      {
        id: therapistId,
        first_name: 'Peter',
        last_name: 'Schindler',
        city: 'Berlin',
        accepting_new: true,
        modalities: ['narm'],
        schwerpunkte: ['trauma'],
        session_preferences: ['online'],
        // Cal.com fields - this is what we're testing
        cal_username: 'peter-schindler',
        cal_enabled: true,
      },
    ];

    const patient = { name: 'Max', email: 'max@test.com', metadata: { issue: 'Panik' } };

    const supabase = makeSupabaseMock(ref, list, therapists, patient);
    const mod = await import('@/lib/supabase-server');
    // @ts-expect-error override mock
    mod.supabaseServer = supabase;

    const req = new Request(`http://localhost:3000/api/public/matches/${uuid}`);
    const { GET } = await import('@/app/api/public/matches/[uuid]/route');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json?.data?.therapists).toHaveLength(1);

    const therapist = json.data.therapists[0];

    // These fields MUST be present for isCalBookingEnabled() to work in frontend
    expect(therapist).toHaveProperty('cal_username', 'peter-schindler');
    expect(therapist).toHaveProperty('cal_enabled', true);
  });
});
