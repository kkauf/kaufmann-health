import { supabaseServer } from '@/lib/supabase-server';

// Types
export type AvailabilitySlot = {
  date_iso: string;
  time_label: string;
  format: 'online' | 'in_person';
  address?: string;
};

export type SlotRow = {
  therapist_id: string;
  day_of_week: number;
  time_local: string;
  format: 'online' | 'in_person' | 'both' | string;
  address: string | null;
  duration_minutes?: number | null;
  active?: boolean | null;
  is_recurring?: boolean | null;
  specific_date?: string | null;
  end_date?: string | null;
};

export type ComputeAvailabilityOptions = {
  maxDays?: number;
  maxSlots?: number;
  /** Optional fallback address per therapist (e.g., from profile.practice_address) */
  fallbackAddresses?: Map<string, string>;
};

// Timezone helpers for Europe/Berlin
const TZ = 'Europe/Berlin';
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function getBerlinDayIndex(d: Date): number {
  const name = weekdayFmt.format(d);
  return weekdayIndex[name as keyof typeof weekdayIndex] ?? d.getUTCDay();
}

export function getBerlinYmd(d: Date): string {
  return ymdFmt.format(d);
}

/**
 * Fetch active slots for a list of therapists.
 * Returns a Map from therapist_id to their slot rows.
 */
export async function fetchSlotsByTherapist(
  therapistIds: string[]
): Promise<Map<string, SlotRow[]>> {
  const slotsByTherapist = new Map<string, SlotRow[]>();
  if (therapistIds.length === 0) return slotsByTherapist;

  try {
    // Try selecting with new columns first
    const initial = await supabaseServer
      .from('therapist_slots')
      .select('therapist_id, day_of_week, time_local, format, address, duration_minutes, active, is_recurring, specific_date, end_date')
      .in('therapist_id', therapistIds)
      .eq('active', true)
      .limit(1000);

    let slotsData = initial.data as SlotRow[] | null;
    const errorMsg = String(initial.error?.message || '');

    // Fallback to legacy schema if columns don't exist
    if (initial.error && /does not exist/i.test(errorMsg)) {
      const legacy = await supabaseServer
        .from('therapist_slots')
        .select('therapist_id, day_of_week, time_local, format, address, duration_minutes, active')
        .in('therapist_id', therapistIds)
        .eq('active', true)
        .limit(1000);
      slotsData = legacy.data as SlotRow[] | null;
    }

    if (Array.isArray(slotsData)) {
      for (const s of slotsData) {
        const arr = slotsByTherapist.get(s.therapist_id) || [];
        arr.push(s);
        slotsByTherapist.set(s.therapist_id, arr);
      }
    }
  } catch {
    // Return empty on failure; callers handle gracefully
  }

  return slotsByTherapist;
}

/**
 * Fetch booked slots for a list of therapists within a date range.
 * Returns a Set of keys in format "therapist_id|date_iso|time_label".
 */
export async function fetchBookedSlots(
  therapistIds: string[],
  startYmd: string,
  endYmd: string
): Promise<Set<string>> {
  const booked = new Set<string>();
  if (therapistIds.length === 0) return booked;

  try {
    const { data: bookingsData } = await supabaseServer
      .from('bookings')
      .select('therapist_id, date_iso, time_label')
      .in('therapist_id', therapistIds)
      .gte('date_iso', startYmd)
      .lte('date_iso', endYmd)
      .limit(5000);

    if (Array.isArray(bookingsData)) {
      for (const b of bookingsData as { therapist_id: string; date_iso: string; time_label: string }[]) {
        const key = `${b.therapist_id}|${String(b.date_iso)}|${String(b.time_label).slice(0, 5)}`;
        booked.add(key);
      }
    }
  } catch {
    // Return empty on failure
  }

  return booked;
}

/**
 * Expand slots into concrete availability dates for a single therapist.
 * Handles one-time slots (specific_date) and recurring slots (day_of_week).
 */
export function expandSlotsToAvailability(
  therapistId: string,
  slots: SlotRow[],
  booked: Set<string>,
  options?: {
    maxDays?: number;
    maxSlots?: number;
    fallbackAddress?: string;
  }
): AvailabilitySlot[] {
  const maxDays = options?.maxDays ?? 21;
  const maxSlots = options?.maxSlots ?? 50;
  const fallbackAddress = options?.fallbackAddress ?? '';

  if (slots.length === 0) return [];

  const now = new Date();
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + maxDays);
  const startYmd = getBerlinYmd(start);
  const endYmd = getBerlinYmd(end);

  const candidates: AvailabilitySlot[] = [];
  const seen = new Set<string>();

  const pushCandidate = (ymd: string, time: string, fmt: 'online' | 'in_person', addr?: string) => {
    const key = `${ymd}|${time}|${fmt}|${addr || ''}`;
    if (seen.has(key)) return;
    const bookedKey = `${therapistId}|${ymd}|${time}`;
    if (booked.has(bookedKey)) return;
    seen.add(key);
    candidates.push({
      date_iso: ymd,
      time_label: time,
      format: fmt,
      ...(fmt === 'in_person' && addr ? { address: addr } : {}),
    });
  };

  // One-time slots: include only on their specific_date within the window
  for (const s of slots) {
    // Treat as one-time if explicitly false OR if specific_date is present (and not explicitly true)
    const isOneTime = s.is_recurring === false || (!!s.specific_date && s.is_recurring !== true);
    
    if (isOneTime) {
      const specific = String(s.specific_date || '').trim();
      if (!specific) continue;
      if (specific < startYmd || specific > endYmd) continue;
      const time = String(s.time_local || '').slice(0, 5);
      const fmtRaw = String(s.format || '').trim();
      if (fmtRaw === 'both') {
        const addr = String(s.address || '').trim() || fallbackAddress;
        pushCandidate(specific, time, 'online');
        pushCandidate(specific, time, 'in_person', addr || undefined);
      } else {
        const fmt = (fmtRaw === 'in_person' ? 'in_person' : 'online') as 'online' | 'in_person';
        const addr = fmt === 'in_person' ? (String(s.address || '').trim() || fallbackAddress) : undefined;
        pushCandidate(specific, time, fmt, addr);
      }
    }
  }

  // Recurring slots: expand across the window by matching day_of_week
  for (let offset = 1; offset <= maxDays; offset++) {
    if (candidates.length >= maxSlots) break;
    const d = new Date(now.getTime());
    d.setUTCDate(d.getUTCDate() + offset);
    const dow = getBerlinDayIndex(d);
    const ymd = getBerlinYmd(d);

    for (const s of slots) {
      if (candidates.length >= maxSlots) break;
      // Skip one-time slots (handled above); treat missing is_recurring as recurring ONLY if specific_date is missing
      const isOneTime = s.is_recurring === false || (!!s.specific_date && s.is_recurring !== true);
      if (isOneTime) continue;
      
      if (Number(s.day_of_week) !== dow) continue;
      // Respect optional end_date on recurring series
      const slotEndDate = String(s.end_date || '').trim();
      if (slotEndDate && ymd > slotEndDate) continue;
      const time = String(s.time_local || '').slice(0, 5);
      const fmtRaw = String(s.format || '').trim();
      if (fmtRaw === 'both') {
        const addr = String(s.address || '').trim() || fallbackAddress;
        pushCandidate(ymd, time, 'online');
        pushCandidate(ymd, time, 'in_person', addr || undefined);
      } else {
        const fmt = (fmtRaw === 'in_person' ? 'in_person' : 'online') as 'online' | 'in_person';
        const addr = fmt === 'in_person' ? (String(s.address || '').trim() || fallbackAddress) : undefined;
        pushCandidate(ymd, time, fmt, addr);
      }
    }
  }

  // Sort chronologically
  candidates.sort((a, b) =>
    a.date_iso === b.date_iso
      ? a.time_label.localeCompare(b.time_label)
      : a.date_iso.localeCompare(b.date_iso)
  );

  return candidates.slice(0, maxSlots);
}

/**
 * Compute availability for multiple therapists in one call.
 * This is the main entry point - fetches slots, bookings, and expands.
 */
export async function computeAvailability(
  therapistIds: string[],
  options?: ComputeAvailabilityOptions
): Promise<Map<string, AvailabilitySlot[]>> {
  const maxDays = options?.maxDays ?? 21;
  const maxSlots = options?.maxSlots ?? 50;
  const fallbackAddresses = options?.fallbackAddresses ?? new Map<string, string>();

  const result = new Map<string, AvailabilitySlot[]>();
  if (therapistIds.length === 0) return result;

  // Fetch slots and bookings in parallel
  const now = new Date();
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + maxDays);
  const startYmd = getBerlinYmd(start);
  const endYmd = getBerlinYmd(end);

  const [slotsByTherapist, booked] = await Promise.all([
    fetchSlotsByTherapist(therapistIds),
    fetchBookedSlots(therapistIds, startYmd, endYmd),
  ]);

  // Expand slots for each therapist
  for (const therapistId of therapistIds) {
    const slots = slotsByTherapist.get(therapistId) || [];
    const fallbackAddress = fallbackAddresses.get(therapistId) || '';
    const availability = expandSlotsToAvailability(therapistId, slots, booked, {
      maxDays,
      maxSlots,
      fallbackAddress,
    });
    result.set(therapistId, availability);
  }

  return result;
}
