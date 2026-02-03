import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state for mocks
let peopleRows: any[] = [];
let bookingRows: any[] = [];

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn(async () => true),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

vi.mock('@/lib/test-mode', () => ({
  isLocalhostRequest: () => true,
  isStagingRequest: () => false,
}));

vi.mock('@/lib/supabase-server', () => {
  // Build a chainable query mock that resolves on any terminal call
  function chainable(data: any[], error: any = null) {
    const obj: any = {};
    const terminal = () => Promise.resolve({ data, error });
    // Every Supabase method returns the chain; the chain is also thenable
    for (const method of ['select', 'eq', 'neq', 'not', 'or', 'in', 'ilike', 'order', 'limit']) {
      obj[method] = (..._args: any[]) => obj;
    }
    obj.then = (resolve: any, reject: any) => terminal().then(resolve, reject);
    return obj;
  }

  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') return chainable(peopleRows);
      if (table === 'cal_bookings') return chainable(bookingRows);
      return chainable([]);
    },
  };
  return { supabaseServer };
});

function makeReq(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/admin/leads');
  url.searchParams.set('status', 'all');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), {
    method: 'GET',
    headers: { cookie: 'kh_admin=token' },
  });
}

beforeEach(() => {
  peopleRows = [];
  bookingRows = [];
  vi.resetModules();
});

describe('GET /api/admin/leads — booking-aware deprioritization', () => {
  it('returns booking flags for leads with active bookings', async () => {
    peopleRows = [
      { id: 'p1', name: 'Patient A', email: 'a@example.com', type: 'patient', status: 'new', metadata: {}, created_at: '2025-01-01' },
    ];
    bookingRows = [
      { patient_id: 'p1', booking_kind: 'intro', start_time: '2025-02-01T10:00:00Z', status: 'ACCEPTED' },
    ];

    const { GET } = await import('@/app/api/admin/leads/route');
    const res = await GET(makeReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].has_active_booking).toBe(true);
    expect(json.data[0].active_booking_kind).toBe('intro');
    expect(json.data[0].active_booking_start).toBe('2025-02-01T10:00:00Z');
  });

  it('returns false for leads with no bookings', async () => {
    peopleRows = [
      { id: 'p2', name: 'Patient B', email: 'b@example.com', type: 'patient', status: 'new', metadata: {}, created_at: '2025-01-01' },
    ];
    bookingRows = []; // No bookings

    const { GET } = await import('@/app/api/admin/leads/route');
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json.data[0].has_active_booking).toBe(false);
    expect(json.data[0].active_booking_kind).toBeNull();
    expect(json.data[0].active_booking_start).toBeNull();
  });

  it('selects the most recent booking when multiple exist', async () => {
    peopleRows = [
      { id: 'p3', name: 'Patient C', email: 'c@example.com', type: 'patient', status: 'new', metadata: {}, created_at: '2025-01-01' },
    ];
    bookingRows = [
      { patient_id: 'p3', booking_kind: 'intro', start_time: '2025-01-15T10:00:00Z', status: 'ACCEPTED' },
      { patient_id: 'p3', booking_kind: 'full_session', start_time: '2025-02-10T14:00:00Z', status: 'ACCEPTED' },
    ];

    const { GET } = await import('@/app/api/admin/leads/route');
    const res = await GET(makeReq());
    const json = await res.json();

    expect(json.data[0].has_active_booking).toBe(true);
    expect(json.data[0].active_booking_kind).toBe('full_session');
    expect(json.data[0].active_booking_start).toBe('2025-02-10T14:00:00Z');
  });

  it('correctly maps booking flags across multiple leads', async () => {
    peopleRows = [
      { id: 'p4', name: 'With Booking', email: 'd@example.com', type: 'patient', status: 'new', metadata: {}, created_at: '2025-01-01' },
      { id: 'p5', name: 'Without Booking', email: 'e@example.com', type: 'patient', status: 'new', metadata: {}, created_at: '2025-01-01' },
    ];
    bookingRows = [
      { patient_id: 'p4', booking_kind: 'intro', start_time: '2025-02-01T10:00:00Z', status: 'ACCEPTED' },
    ];

    const { GET } = await import('@/app/api/admin/leads/route');
    const res = await GET(makeReq());
    const json = await res.json();

    const withBooking = json.data.find((d: any) => d.id === 'p4');
    const withoutBooking = json.data.find((d: any) => d.id === 'p5');

    expect(withBooking.has_active_booking).toBe(true);
    expect(withoutBooking.has_active_booking).toBe(false);
  });

  it('handles empty leads list without querying cal_bookings', async () => {
    peopleRows = [];
    bookingRows = [];

    const { GET } = await import('@/app/api/admin/leads/route');
    const res = await GET(makeReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(0);
  });
});
