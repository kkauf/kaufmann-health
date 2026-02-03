import { describe, it, expect } from 'vitest';

/**
 * Tests for the client-side deprioritization logic in admin/leads/page.tsx.
 *
 * The logic lives inside `loadPatientMatchFlags` callback. We replicate the
 * algorithm here to verify the booking-aware deprioritization rules:
 *
 * 1. Patients with active bookings → deprioritized (strongest signal)
 * 2. Patients with active match statuses (non-stale) → deprioritized
 * 3. Patients with selection_email_sent_at → deprioritized
 * 4. Cancelled/no-show bookings → NOT deprioritized (filtered server-side)
 */

type LeadWithBooking = {
  id: string;
  has_active_booking?: boolean;
  metadata: {
    selection_email_sent_at?: string;
    returning_concierge_at?: string;
  };
};

type MatchRow = {
  patient?: { id: string };
  status: string;
  created_at: string;
};

/** Replicates the deprioritization logic from loadPatientMatchFlags */
function computeDeprioritized(
  leads: LeadWithBooking[],
  matches: MatchRow[],
): Set<string> {
  const active = new Set(['accepted', 'therapist_contacted', 'therapist_responded', 'session_booked', 'completed']);
  const leadIds = new Set(leads.map((p) => p.id));

  const returningAt = new Map<string, string>();
  for (const p of leads) {
    const rca = p.metadata?.returning_concierge_at;
    if (typeof rca === 'string') returningAt.set(p.id, rca);
  }

  const s = new Set<string>();

  // Step 1: Deprioritize patients with active bookings (strongest signal)
  for (const p of leads) {
    if (p.has_active_booking) s.add(p.id);
  }

  // Step 2: Deprioritize patients with active match statuses
  for (const m of matches) {
    const pid = m.patient?.id ?? '';
    const st = m.status ?? '';
    if (pid && leadIds.has(pid)) {
      const rca = returningAt.get(pid);
      const isStale = rca && typeof m.created_at === 'string' && m.created_at < rca;
      if (active.has(st) && !isStale) s.add(pid);
    }
  }

  // Step 3: Deprioritize patients who already received a selection email
  for (const p of leads) {
    if (typeof p.metadata?.selection_email_sent_at === 'string') {
      s.add(p.id);
    }
  }

  return s;
}

describe('Client-side lead deprioritization', () => {
  it('deprioritizes patients with active bookings', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: true, metadata: {} },
      { id: 'p2', has_active_booking: false, metadata: {} },
    ];
    const result = computeDeprioritized(leads, []);
    expect(result.has('p1')).toBe(true);
    expect(result.has('p2')).toBe(false);
  });

  it('does NOT deprioritize patients with cancelled bookings (has_active_booking=false)', () => {
    // Cancelled bookings are filtered server-side, so has_active_booking is false
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: false, metadata: {} },
    ];
    const result = computeDeprioritized(leads, []);
    expect(result.has('p1')).toBe(false);
  });

  it('booking signal takes priority over match status', () => {
    // Patient has a booking but all matches are "proposed" (no active status)
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: true, metadata: {} },
    ];
    const matches: MatchRow[] = [
      { patient: { id: 'p1' }, status: 'proposed', created_at: '2025-01-01' },
    ];
    const result = computeDeprioritized(leads, matches);
    expect(result.has('p1')).toBe(true);
  });

  it('deprioritizes via active match status', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: false, metadata: {} },
    ];
    const matches: MatchRow[] = [
      { patient: { id: 'p1' }, status: 'accepted', created_at: '2025-01-10' },
    ];
    const result = computeDeprioritized(leads, matches);
    expect(result.has('p1')).toBe(true);
  });

  it('does NOT deprioritize via proposed match status alone', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: false, metadata: {} },
    ];
    const matches: MatchRow[] = [
      { patient: { id: 'p1' }, status: 'proposed', created_at: '2025-01-10' },
    ];
    const result = computeDeprioritized(leads, matches);
    expect(result.has('p1')).toBe(false);
  });

  it('ignores stale matches for returning concierge users', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: false, metadata: { returning_concierge_at: '2025-02-01T00:00:00Z' } },
    ];
    const matches: MatchRow[] = [
      // Match created before re-submission → stale
      { patient: { id: 'p1' }, status: 'accepted', created_at: '2025-01-15T00:00:00Z' },
    ];
    const result = computeDeprioritized(leads, matches);
    expect(result.has('p1')).toBe(false);
  });

  it('returning concierge user WITH booking is still deprioritized', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: true, metadata: { returning_concierge_at: '2025-02-01T00:00:00Z' } },
    ];
    const matches: MatchRow[] = [
      // All matches are stale
      { patient: { id: 'p1' }, status: 'proposed', created_at: '2025-01-15T00:00:00Z' },
    ];
    const result = computeDeprioritized(leads, matches);
    // Booking signal trumps stale matches
    expect(result.has('p1')).toBe(true);
  });

  it('deprioritizes patients with selection email sent', () => {
    const leads: LeadWithBooking[] = [
      { id: 'p1', has_active_booking: false, metadata: { selection_email_sent_at: '2025-01-20T00:00:00Z' } },
    ];
    const result = computeDeprioritized(leads, []);
    expect(result.has('p1')).toBe(true);
  });

  it('all three signals combine correctly', () => {
    const leads: LeadWithBooking[] = [
      { id: 'booked', has_active_booking: true, metadata: {} },
      { id: 'matched', has_active_booking: false, metadata: {} },
      { id: 'emailed', has_active_booking: false, metadata: { selection_email_sent_at: '2025-01-20T00:00:00Z' } },
      { id: 'needs-action', has_active_booking: false, metadata: {} },
    ];
    const matches: MatchRow[] = [
      { patient: { id: 'matched' }, status: 'session_booked', created_at: '2025-01-10' },
      { patient: { id: 'needs-action' }, status: 'proposed', created_at: '2025-01-10' },
    ];
    const result = computeDeprioritized(leads, matches);
    expect(result.has('booked')).toBe(true);
    expect(result.has('matched')).toBe(true);
    expect(result.has('emailed')).toBe(true);
    expect(result.has('needs-action')).toBe(false);
  });
});
