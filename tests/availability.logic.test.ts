import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { expandSlotsToAvailability, SlotRow } from '../src/lib/availability';

// Mock the dependencies
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {}
}));

describe('Availability Logic Bug Repro', () => {
  beforeEach(() => {
    // Set "now" to Monday, Jan 1, 2024
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('incorrectly treats a one-time slot as recurring if is_recurring is null/undefined', () => {
    const therapistId = 't1';
    
    // Create a slot for Tuesday Jan 2, 2024.
    // Day of week for Jan 2, 2024 is Tuesday (2).
    const oneTimeSlot: SlotRow = {
      therapist_id: therapistId,
      day_of_week: 2, // Tuesday
      time_local: '14:00',
      format: 'online',
      address: null,
      active: true,
      // CRITICAL: mimic the DB state where this might be null
      is_recurring: null, 
      specific_date: '2024-01-02', 
      end_date: null
    };

    const booked = new Set<string>();
    
    // We request availability for 14 days.
    // If it's correctly handled as one-time, it should appear ONLY on Jan 2.
    // If it's buggy and treated as recurring (because is_recurring is null), it will appear on Jan 2 AND Jan 9.
    const result = expandSlotsToAvailability(therapistId, [oneTimeSlot], booked, { maxDays: 14 });

    // Expectation: purely based on bug description, we expect duplicates
    const dates = result.map(r => r.date_iso);
    
    // Jan 2 is the intended date
    expect(dates).toContain('2024-01-02');
    
    // Jan 9 would be the recurring recurrence. 
    // The bug is fixed, so this should NOT be present.
    expect(dates).not.toContain('2024-01-09'); 
  });
});
