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
    const { data: ref, error: refErr } = await supabaseServer
      .from('matches')
      .select('id, created_at, patient_id')
      .eq('secure_uuid', uuid)
      .single();
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
      .select('name, metadata')
      .eq('id', patientId)
      .single();

    type PatientRow = { name?: string | null; metadata?: { issue?: string; notes?: string; city?: string; session_preference?: 'online'|'in_person'; session_preferences?: ('online'|'in_person')[]; specializations?: string[]; gender_preference?: 'male'|'female'|'no_preference' } | null };
    const p = (patient || null) as PatientRow | null;
    const patientName = (p?.name || '') || null;
    const issue = (p?.metadata?.notes || p?.metadata?.issue || '') || null;
    const sessionPreference = p?.metadata?.session_preference ?? null;
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
      .order('created_at', { ascending: true });

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

    // Fetch therapist profiles (include fields needed for mismatch scoring)
    type TherapistRow = {
      id: string;
      first_name: string;
      last_name: string;
      gender?: string | null;
      photo_url?: string | null;
      city?: string | null;
      modalities?: string[] | null;
      accepting_new?: boolean | null;
      metadata?: { session_preferences?: string[] | null; [k: string]: unknown } | null;
    };
    let therapists: TherapistRow[] = [];
    if (therapistIds.length > 0) {
      const { data: trows } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, gender, photo_url, city, modalities, accepting_new, metadata')
        .in('id', therapistIds);
      if (Array.isArray(trows)) therapists = trows as TherapistRow[];
    }

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
        session_preferences: Array.isArray(t.metadata?.session_preferences) ? t.metadata?.session_preferences : [],
        modalities: Array.isArray(t.modalities) ? t.modalities : [],
      };
      const mm = computeMismatches(patientMeta, tRow);
      return { t, mm } as const;
    });
    scored.sort((a, b) => {
      if (a.mm.isPerfect !== b.mm.isPerfect) return a.mm.isPerfect ? -1 : 1;
      return a.mm.reasons.length - b.mm.reasons.length;
    });

    const list = scored.map(({ t }) => ({
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      photo_url: t.photo_url || undefined,
      city: (t.city || '') || undefined,
      accepting_new: Boolean(t.accepting_new),
      contacted_at: contactedById.get(t.id) || null,
    }));

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'match_link_view',
      source: 'api.public.matches',
      props: { patient_id: patientId, therapists: list.map(x => x.id) },
    });

    return NextResponse.json({
      data: {
        patient: { name: patientName, issue, session_preference: sessionPreference },
        therapists: list,
      },
      error: null,
    });
  } catch (e) {
    await logError('api.public.matches.get', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
