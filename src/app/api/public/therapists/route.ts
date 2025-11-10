import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

type TherapistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  modalities: unknown;
  session_preferences: unknown;
  accepting_new: boolean | null;
  photo_url: string | null;
  status: string | null;
  metadata: unknown;
};

export async function GET() {
  try {
    const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
    const hideIds = new Set(
      hideIdsEnv
        ? hideIdsEnv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    );

    const { data, error } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, city, modalities, session_preferences, accepting_new, photo_url, status, metadata')
      .eq('status', 'verified')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api.public.therapists] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapists' },
        { status: 500 }
      );
    }

    const rows = (data as TherapistRow[] | null) || [];

    // Build list of therapist ids for availability lookup
    const therapistIds = rows.map((r) => r.id);

    type SlotRow = {
      therapist_id: string;
      day_of_week: number; // 0..6 (Sun..Sat)
      time_local: string;  // HH:MM[:SS]
      format: 'online' | 'in_person' | string;
      address: string | null;
      duration_minutes: number | null;
      active: boolean | null;
    };

    // Fetch active recurring slots for these therapists (best-effort)
    let slotsByTherapist = new Map<string, SlotRow[]>();
    try {
      if (therapistIds.length > 0) {
        const { data: slotsData, error: slotsErr } = await supabaseServer
          .from('therapist_slots')
          .select('therapist_id, day_of_week, time_local, format, address, duration_minutes, active')
          .in('therapist_id', therapistIds)
          .eq('active', true)
          .limit(1000);
        if (!slotsErr && Array.isArray(slotsData)) {
          for (const s of slotsData as SlotRow[]) {
            const arr = slotsByTherapist.get(s.therapist_id) || [];
            arr.push(s);
            slotsByTherapist.set(s.therapist_id, arr);
          }
        }
      }
    } catch {
      // Ignore availability on failure; API should remain stable
      slotsByTherapist = new Map();
    }

    // Helpers for Europe/Berlin date computation
    const TZ = 'Europe/Berlin';
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
    const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }); // en-CA yields YYYY-MM-DD
    const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    function getBerlinDayIndex(d: Date): number {
      const name = weekdayFmt.format(d);
      return weekdayIndex[name as keyof typeof weekdayIndex] ?? d.getUTCDay();
    }
    function getBerlinYmd(d: Date): string {
      // en-CA with the TZ gives YYYY-MM-DD
      return ymdFmt.format(d);
    }

    // Precompute booking blackout set for next 3 weeks
    const booked = new Set<string>();
    try {
      if (therapistIds.length > 0) {
        const now = new Date();
        const start = new Date(now.getTime());
        start.setUTCDate(start.getUTCDate() + 1);
        const end = new Date(start.getTime());
        end.setUTCDate(end.getUTCDate() + 21);
        const startYmd = getBerlinYmd(start);
        const endYmd = getBerlinYmd(end);

        const { data: bookingsData } = await supabaseServer
          .from('bookings')
          .select('therapist_id, date_iso, time_label')
          .in('therapist_id', therapistIds)
          .gte('date_iso', startYmd)
          .lte('date_iso', endYmd)
          .limit(5000);
        if (Array.isArray(bookingsData)) {
          for (const b of bookingsData as { therapist_id: string; date_iso: string; time_label: string }[]) {
            const key = `${b.therapist_id}|${String(b.date_iso)}|${String(b.time_label).slice(0,5)}`;
            booked.add(key);
          }
        }
      }
    } catch {}

    const therapists = rows
      .filter((row) => {
        if (hideIds.has(row.id)) return false;
        try {
          const md = (row.metadata || {}) as Record<string, unknown>;
          const hiddenVal: unknown = md ? (md as Record<string, unknown>)['hidden'] : undefined;
          const hidden = hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';
          return !hidden;
        } catch {
          return true;
        }
      })
      .map((row) => {
      const mdObj: Record<string, unknown> =
        row?.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};

      const profileUnknown = mdObj['profile'];
      const profile: Record<string, unknown> =
        profileUnknown && typeof profileUnknown === 'object'
          ? (profileUnknown as Record<string, unknown>)
          : {};

      const approach_text =
        typeof profile['approach_text'] === 'string'
          ? (profile['approach_text'] as string)
          : '';

      const languages = Array.isArray(profile['languages'])
        ? (profile['languages'] as string[])
        : [];
      const years_experience =
        typeof profile['years_experience'] === 'number'
          ? (profile['years_experience'] as number)
          : undefined;
      const practice_address =
        typeof profile['practice_address'] === 'string'
          ? (profile['practice_address'] as string)
          : '';

      // Compute availability from slots (next 3 weeks, cap 9), skipping booked
      const slots = slotsByTherapist.get(row.id) || [];
      const availability: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[] = [];
      if (slots.length > 0) {
        const maxDays = 21; // ~3 weeks starting tomorrow
        const now = new Date();
        for (let offset = 1; offset <= maxDays; offset++) {
          if (availability.length >= 9) break;
          const d = new Date(now.getTime());
          d.setUTCDate(d.getUTCDate() + offset);
          const dow = getBerlinDayIndex(d);
          const ymd = getBerlinYmd(d); // YYYY-MM-DD in Berlin TZ
          for (const s of slots) {
            if (availability.length >= 9) break;
            const sDow = Number(s.day_of_week);
            if (sDow !== dow) continue;
            const time = String(s.time_local || '').slice(0, 5);
            const bookedKey = `${row.id}|${ymd}|${time}`;
            if (booked.has(bookedKey)) continue;
            const fmt = (s.format === 'in_person' ? 'in_person' : 'online') as 'online' | 'in_person';
            const addrSlot = fmt === 'in_person' ? String(s.address || '').trim() : '';
            const addr = addrSlot || String(practice_address || '').trim();
            availability.push({ date_iso: ymd, time_label: time, format: fmt, ...(addr ? { address: addr } : {}) });
          }
        }
        // Ensure chronological order just in case
        availability.sort((a, b) => (a.date_iso === b.date_iso ? a.time_label.localeCompare(b.time_label) : a.date_iso.localeCompare(b.date_iso)));
      }

      return {
        id: row.id,
        first_name: String(row.first_name || ''),
        last_name: String(row.last_name || ''),
        city: String(row.city || ''),
        modalities: Array.isArray(row.modalities) ? (row.modalities as string[]) : [],
        session_preferences: Array.isArray(row.session_preferences) ? (row.session_preferences as string[]) : [],
        accepting_new: Boolean(row.accepting_new),
        photo_url: row.photo_url || undefined,
        approach_text,
        metadata: {
          profile: {
            ...(languages.length > 0 ? { languages } : {}),
            ...(typeof years_experience === 'number' ? { years_experience } : {}),
          },
        },
        availability,
      };
    });

    return NextResponse.json(
      { therapists },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[api.public.therapists] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
