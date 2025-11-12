import { supabaseServer } from '../src/lib/supabase-server';
import { computeMismatches, type PatientMeta, type TherapistRowForMatch } from '../src/features/leads/lib/match';

async function main() {
  const patientMeta: PatientMeta = {
    city: undefined,
    session_preference: 'online',
    session_preferences: undefined,
    specializations: undefined,
    gender_preference: 'no_preference',
  };

  type TR = { id: string; gender?: string | null; city?: string | null; session_preferences?: unknown; modalities?: unknown; accepting_new?: boolean | null; metadata?: Record<string, unknown> | null };
  const { data: trows } = await supabaseServer
    .from('therapists')
    .select('id, gender, city, session_preferences, modalities, accepting_new, metadata')
    .eq('status', 'verified')
    .limit(1000);
  const therapists = Array.isArray(trows) ? (trows as TR[]) : [];

  // Filter accepting_new / hide_from_directory
  const filtered = therapists.filter((t) => {
    if (t.accepting_new === false) return false;
    const hide = ((t.metadata || {}) as any)['hide_from_directory'] === true;
    if (hide) return false;
    return true;
  });

  // Load slots for time-of-day check
  const tIds = filtered.map((t) => t.id);
  type SlotRow = { therapist_id: string; day_of_week: number; time_local: string; format: string; address: string | null; active: boolean | null };
  const slotsByTid = new Map<string, SlotRow[]>();
  if (tIds.length > 0) {
    const { data: srows } = await supabaseServer
      .from('therapist_slots')
      .select('therapist_id, day_of_week, time_local, format, address, active')
      .in('therapist_id', tIds)
      .eq('active', true)
      .limit(5000);
    if (Array.isArray(srows)) {
      for (const s of srows as SlotRow[]) {
        const arr = slotsByTid.get(s.therapist_id) || [];
        arr.push(s);
        slotsByTid.set(s.therapist_id, arr);
      }
    }
  }

  function slotMatchesPreferences(therapistId: string): boolean {
    const prefs = new Set(['Bin flexibel']);
    if (prefs.size === 0 || prefs.has('Bin flexibel')) return true;
    const wantMorning = Array.from(prefs).some((s) => s.toLowerCase().includes('morg'));
    const wantAfternoon = Array.from(prefs).some((s) => s.toLowerCase().includes('nachmitt'));
    const wantEvening = Array.from(prefs).some((s) => s.toLowerCase().includes('abend'));
    const wantWeekend = Array.from(prefs).some((s) => s.toLowerCase().includes('wochen'));
    const slots = slotsByTid.get(therapistId) || [];
    const now = new Date();
    for (let offset = 1; offset <= 21; offset++) {
      const d = new Date(now.getTime());
      d.setUTCDate(d.getUTCDate() + offset);
      const dow = d.getUTCDay();
      for (const s of slots) {
        if (Number(s.day_of_week) !== (dow === 0 ? 0 : dow)) continue;
        const h = parseInt(String(s.time_local || '').slice(0,2), 10);
        const isMorning = h >= 8 && h < 12;
        const isAfternoon = h >= 12 && h < 17;
        const isEvening = h >= 17 && h < 21;
        const isWeekend = dow === 0 || dow === 6;
        if ((wantMorning && isMorning) || (wantAfternoon && isAfternoon) || (wantEvening && isEvening) || (wantWeekend && isWeekend)) return true;
      }
    }
    return false;
  }

  const scored: { id: string; isPerfect: boolean; reasons: string[]; hasSlots: boolean }[] = [];
  for (const t of filtered) {
    const tRow: TherapistRowForMatch = { id: t.id, gender: t.gender || undefined, city: t.city || undefined, session_preferences: t.session_preferences, modalities: t.modalities };
    const mm = computeMismatches(patientMeta, tRow);
    const timeOk = slotMatchesPreferences(t.id);
    scored.push({ id: t.id, isPerfect: mm.isPerfect, reasons: mm.reasons, hasSlots: timeOk });
  }

  scored.sort((a, b) => {
    if (a.isPerfect !== b.isPerfect) return a.isPerfect ? -1 : 1;
    if (a.reasons.length !== b.reasons.length) return a.reasons.length - b.reasons.length;
    if (a.hasSlots !== b.hasSlots) return a.hasSlots ? -1 : 1;
    return 0;
  });

  console.log('Filtered therapists:', filtered.length);
  console.log('Top 5 scored:', scored.slice(0,5));
}

main().catch((e) => { console.error(e); process.exit(1); });
