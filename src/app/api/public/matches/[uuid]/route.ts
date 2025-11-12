import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics } from '@/lib/server-analytics';
import { logError } from '@/lib/logger';
import { computeMismatches, type PatientMeta, type TherapistRowForMatch } from '@/features/leads/lib/match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function extractMessage(err: unknown): string | null {
  if (typeof err === 'object' && err !== null) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : null;
  }
  return null;
}

export async function GET(req: Request) {
  const { pathname } = (() => {
    try {
      const u = new URL(req.url);
      return { pathname: u.pathname };
    } catch {
      return { pathname: '' } as const;
    }
  })();
  const parts = pathname.split('/').filter(Boolean);
  // Expecting /api/public/matches/{uuid}
  const matchesIdx = parts.indexOf('matches');
  const uuid = matchesIdx >= 0 && parts.length > matchesIdx + 1 ? decodeURIComponent(parts[matchesIdx + 1]) : '';
  if (!uuid) return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });

  try {
    // Resolve reference match to get patient_id and ensure link age
    let ref: unknown | null = null;
    let refErr: unknown | null = null;
    {
      const res = await supabaseServer
        .from('matches')
        .select('id, created_at, patient_id')
        .eq('secure_uuid', uuid)
        .single();
      ref = res.data as unknown;
      refErr = res.error as unknown;
    }
    const msg = extractMessage(refErr);
    const needsFallback = Boolean(refErr || !ref || (msg && /Cannot coerce the result to a single JSON object/i.test(msg)));
    if (needsFallback) {
      const fallback = await supabaseServer
        .from('matches')
        .select('id, created_at, patient_id')
        .eq('secure_uuid', uuid)
        .order('created_at', { ascending: false })
        .limit(1);
      if (Array.isArray(fallback.data) && fallback.data.length > 0) {
        ref = fallback.data[0] as unknown;
        refErr = null;
      }
    }
    if (refErr || !ref) {
      await logError('api.public.matches.get', refErr || 'not_found', { stage: 'load_ref', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    type RefRow = { id: string; created_at?: string | null; patient_id: string };
    const r = ref as unknown as RefRow;
    const age = hoursSince(r.created_at ?? undefined);
    if (age == null || age > 24 * 30) {
      return NextResponse.json({ data: null, error: 'Link expired' }, { status: 410 });
    }

    const patientId = r.patient_id;

    // Load patient context (for prefill)
    const { data: patient } = await supabaseServer
      .from('people')
      .select('name, status, metadata')
      .eq('id', patientId)
      .single();

    type PatientRow = { name?: string | null; status?: string | null; metadata?: { issue?: string; notes?: string; additional_info?: string; city?: string; session_preference?: 'online'|'in_person'; session_preferences?: ('online'|'in_person')[]; specializations?: string[]; gender_preference?: 'male'|'female'|'no_preference'; start_timing?: string; modality_matters?: boolean; time_slots?: string[] } | null };
    const p = (patient || null) as PatientRow | null;
    const patientName = (p?.name || '') || null;
    const patientStatus = (p?.status || '') || null;
    const issue = (p?.metadata?.notes || p?.metadata?.issue || p?.metadata?.additional_info || '') || null;
    const sessionPreference = p?.metadata?.session_preference ?? null;
    const startTiming = typeof p?.metadata?.start_timing === 'string' ? p!.metadata!.start_timing : undefined;
    const modalityMatters = typeof p?.metadata?.modality_matters === 'boolean' ? p!.metadata!.modality_matters : undefined;
    const timeSlots = Array.isArray(p?.metadata?.time_slots) ? (p!.metadata!.time_slots as string[]) : [];
    const patientMeta: PatientMeta = {
      city: p?.metadata?.city,
      session_preference: p?.metadata?.session_preference,
      session_preferences: p?.metadata?.session_preferences,
      issue: p?.metadata?.issue,
      specializations: p?.metadata?.specializations,
      gender_preference: p?.metadata?.gender_preference,
    };

    // Fetch all matches for this patient (recent window)
    const { data: matches } = await supabaseServer
      .from('matches')
      .select('id, therapist_id, status, created_at, metadata')
      .eq('patient_id', patientId)
      .gte('created_at', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    type MatchMeta = { patient_initiated?: boolean };
    type MatchRow = { id: string; therapist_id: string; status?: string | null; created_at?: string | null; metadata?: MatchMeta | null };
    const all = Array.isArray(matches) ? (matches as unknown as MatchRow[]) : [];

    // Unique therapists, prefer earlier proposals/selected, limit 3
    const seen = new Set<string>();
    const chosen: MatchRow[] = [];
    for (const m of all) {
      if (!seen.has(m.therapist_id)) {
        seen.add(m.therapist_id);
        chosen.push(m);
        if (chosen.length >= 3) break;
      }
    }
    const therapistIds = chosen.map(m => m.therapist_id);

    // Fetch therapist profiles (include fields needed for mismatch scoring + rich display)
    type TherapistRow = {
      id: string;
      first_name: string;
      last_name: string;
      gender?: string | null;
      photo_url?: string | null;
      city?: string | null;
      modalities?: string[] | null;
      session_preferences?: string[] | null;
      accepting_new?: boolean | null;
      approach_text?: string | null;
      metadata?: { session_preferences?: string[] | null; profile?: { approach_text?: string }; [k: string]: unknown } | null;
    };
    let therapists: TherapistRow[] = [];
    if (therapistIds.length > 0) {
      const { data: trows } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, gender, photo_url, city, modalities, session_preferences, accepting_new, approach_text, metadata')
        .in('id', therapistIds);
      if (Array.isArray(trows)) therapists = trows as TherapistRow[];
    }

    // Compute availability for selected therapists (next 3 weeks)
    type SlotRow = { therapist_id: string; day_of_week: number; time_local: string; format: 'online'|'in_person'|string; address: string | null; active: boolean | null };
    const TZ = 'Europe/Berlin';
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
    const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    function getBerlinDayIndex(d: Date): number { const name = weekdayFmt.format(d); return weekdayIndex[name as keyof typeof weekdayIndex] ?? d.getUTCDay(); }
    function getBerlinYmd(d: Date): string { return ymdFmt.format(d); }

    let slotsByTherapist = new Map<string, SlotRow[]>();
    try {
      if (therapistIds.length > 0) {
        const { data: slotsData } = await supabaseServer
          .from('therapist_slots')
          .select('therapist_id, day_of_week, time_local, format, address, active')
          .in('therapist_id', therapistIds)
          .eq('active', true)
          .limit(1000);
        if (Array.isArray(slotsData)) {
          for (const s of slotsData as SlotRow[]) {
            const arr = slotsByTherapist.get(s.therapist_id) || [];
            arr.push(s);
            slotsByTherapist.set(s.therapist_id, arr);
          }
        }
      }
    } catch { slotsByTherapist = new Map(); }

    const booked = new Set<string>();
    try {
      if (therapistIds.length > 0) {
        const now = new Date();
        const start = new Date(now.getTime()); start.setUTCDate(start.getUTCDate() + 1);
        const end = new Date(start.getTime()); end.setUTCDate(end.getUTCDate() + 21);
        const startYmd = getBerlinYmd(start); const endYmd = getBerlinYmd(end);
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

    // Compute contacted flags (patient-initiated)
    const contactedById = new Map<string, string>(); // therapist_id -> iso string
    for (const m of all) {
      const pi = m.metadata?.patient_initiated === true;
      if (pi && !contactedById.has(m.therapist_id)) {
        contactedById.set(m.therapist_id, m.created_at ?? '');
      }
    }

    // Rank therapists using admin mismatch logic
    const scored = therapists.map((t) => {
      const tRow: TherapistRowForMatch = {
        id: t.id,
        gender: t.gender || undefined,
        city: t.city || undefined,
        session_preferences: Array.isArray(t.session_preferences) ? t.session_preferences : (Array.isArray(t.metadata?.session_preferences) ? t.metadata?.session_preferences : []),
        modalities: Array.isArray(t.modalities) ? t.modalities : [],
      };
      const mm = computeMismatches(patientMeta, tRow);
      // Build availability list
      const slots = slotsByTherapist.get(t.id) || [];
      const availability: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[] = [];
      const prefs = new Set((timeSlots || []).map((s) => String(s)));
      const hasSpecificTimePrefs = prefs.size > 0 && !prefs.has('Bin flexibel');
      const wantMorning = Array.from(prefs).some((s) => s.toLowerCase().includes('morg'));
      const wantAfternoon = Array.from(prefs).some((s) => s.toLowerCase().includes('nachmitt'));
      const wantEvening = Array.from(prefs).some((s) => s.toLowerCase().includes('abend'));
      const wantWeekend = Array.from(prefs).some((s) => s.toLowerCase().includes('wochen'));
      if (slots.length > 0) {
        const maxDays = 21;
        const now = new Date();
        for (let offset = 1; offset <= maxDays; offset++) {
          if (availability.length >= 9) break;
          const d = new Date(now.getTime());
          d.setUTCDate(d.getUTCDate() + offset);
          const dow = getBerlinDayIndex(d);
          const ymd = getBerlinYmd(d);
          for (const s of slots) {
            if (availability.length >= 9) break;
            if (Number(s.day_of_week) !== dow) continue;
            const time = String(s.time_local || '').slice(0, 5);
            const bookedKey = `${t.id}|${ymd}|${time}`;
            if (booked.has(bookedKey)) continue;
            const fmt = (s.format === 'in_person' ? 'in_person' : 'online') as 'online' | 'in_person';
            const addr = fmt === 'in_person' ? String(s.address || '').trim() : '';
            if (hasSpecificTimePrefs) {
              const h = parseInt(time.slice(0,2), 10);
              const isMorning = h >= 8 && h < 12;
              const isAfternoon = h >= 12 && h < 17;
              const isEvening = h >= 17 && h < 21;
              const isWeekend = dow === 0 || dow === 6;
              const ok = (wantMorning && isMorning) || (wantAfternoon && isAfternoon) || (wantEvening && isEvening) || (wantWeekend && isWeekend);
              if (!ok) continue;
            }
            availability.push({ date_iso: ymd, time_label: time, format: fmt, ...(addr ? { address: addr } : {}) });
          }
        }
        availability.sort((a, b) => (a.date_iso === b.date_iso ? a.time_label.localeCompare(b.time_label) : a.date_iso.localeCompare(b.date_iso)));
      }
      // Determine time-of-day exactness
      function slotMatchesPreferences(): boolean {
        const prefs = new Set((timeSlots || []).map((s) => String(s)));
        if (prefs.size === 0 || prefs.has('Bin flexibel')) return true;
        const wantMorning = Array.from(prefs).some((s) => s.toLowerCase().includes('morg'));
        const wantAfternoon = Array.from(prefs).some((s) => s.toLowerCase().includes('nachmitt'));
        const wantEvening = Array.from(prefs).some((s) => s.toLowerCase().includes('abend'));
        const wantWeekend = Array.from(prefs).some((s) => s.toLowerCase().includes('wochen'));
        for (const a of availability) {
          const h = parseInt(a.time_label.slice(0,2), 10);
          const d = new Date(a.date_iso + 'T00:00:00');
          const dow = getBerlinDayIndex(d);
          const isMorning = h >= 8 && h < 12;
          const isAfternoon = h >= 12 && h < 17;
          const isEvening = h >= 17 && h < 21;
          const isWeekend = dow === 0 || dow === 6;
          if ((wantMorning && isMorning) || (wantAfternoon && isAfternoon) || (wantEvening && isEvening) || (wantWeekend && isWeekend)) {
            return true;
          }
        }
        return false;
      }
      const timeOk = slotMatchesPreferences();
      const isPerfect = mm.isPerfect && timeOk;
      return { t, mm, availability, isPerfect } as const;
    });

    // Sort: perfect matches first, then by fewest mismatch reasons
    scored.sort((a, b) => {
      if (a.isPerfect !== b.isPerfect) return a.isPerfect ? -1 : 1;
      return a.mm.reasons.length - b.mm.reasons.length;
    });

    // Build response list and include per-therapist is_perfect
    const list = scored.map(({ t, availability, isPerfect }) => ({
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      photo_url: t.photo_url || undefined,
      city: (t.city || '') || undefined,
      // Default to true when accepting_new is null/undefined to avoid disabling booking unnecessarily
      accepting_new: (t.accepting_new === false ? false : true),
      contacted_at: contactedById.get(t.id) || null,
      modalities: Array.isArray(t.modalities) ? t.modalities : [],
      session_preferences: Array.isArray(t.session_preferences) ? t.session_preferences : (Array.isArray(t.metadata?.session_preferences) ? t.metadata?.session_preferences : []),
      approach_text: t.approach_text || t.metadata?.profile?.approach_text || '',
      gender: t.gender || undefined,
      availability,
      is_perfect: Boolean(isPerfect),
    }));

    // Compute overall match_type for banner logic
    let matchType: 'exact' | 'partial' | 'none' = 'none';
    if (scored.length > 0) {
      matchType = scored.some(s => s.isPerfect) ? 'exact' : 'partial';
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'match_link_view',
      source: 'api.public.matches',
      props: { patient_id: patientId, therapists: list.map(x => x.id) },
    });

    return NextResponse.json({
      data: {
        patient: {
          name: patientName,
          issue,
          session_preference: sessionPreference,
          city: patientMeta.city,
          session_preferences: patientMeta.session_preferences,
          specializations: patientMeta.specializations,
          gender_preference: patientMeta.gender_preference,
          start_timing: startTiming,
          modality_matters: modalityMatters,
          status: patientStatus,
          time_slots: timeSlots,
        },
        therapists: list.slice(0, 3),
        metadata: { match_type: matchType },
      },
      error: null,
    });
  } catch (e) {
    await logError('api.public.matches.get', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
