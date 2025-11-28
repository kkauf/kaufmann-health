import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderRichTherapistEmail } from '@/lib/email/templates/richTherapistEmail';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { computeMismatches, type PatientMeta } from '@/features/leads/lib/match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 20-28 hours after email verification (catches users verified yesterday)
const MIN_HOURS = 20;
const MAX_HOURS = 28;

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const header = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  const authHeader = req.headers.get('authorization') || '';
  const isAuthBearer = Boolean(authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
  if (header && header === cronSecret) return true;
  if (isAuthBearer) return true;
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (token && token === cronSecret) return true;
  } catch {}
  return false;
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return false;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// Check if we've already sent the rich therapist email for this patient
async function alreadySentRichEmail(patientId: string): Promise<boolean> {
  try {
    const sinceIso = hoursAgo(24 * 30); // lookback 30 days
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return false;
    const arr = (data as Array<{ properties?: Record<string, unknown> | null }> | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object' ? e.properties : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'rich_therapist_d1' && pid === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

type TherapistRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
  photo_url?: string | null;
  gender?: string | null;
  modalities?: string[] | null;
  metadata?: Record<string, unknown> | null;
  session_preferences?: unknown;
};

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    const isAdmin = await assertAdmin(req);
    const isCron = isCronAuthorized(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOrigin(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 500));

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.rich_therapist_email', props: { limit }, ip, ua });

    // Window: verified 20-28 hours ago
    const fromIso = hoursAgo(MAX_HOURS);
    const toIso = hoursAgo(MIN_HOURS);

    // Find patients who:
    // 1. type = 'patient'
    // 2. status = 'new' (verified and form completed)
    // 3. email_confirmed_at is within the window
    // 4. have matches
    const { data: patients, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .eq('type', 'patient')
      .eq('status', 'new')
      .limit(limit);

    if (pErr) {
      await logError('admin.api.leads.rich_therapist_email', pErr, { stage: 'fetch_patients' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch patients' }, { status: 500 });
    }

    type PatientRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
    const rows = (patients as PatientRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOutsideWindow = 0;
    let skippedAlreadySent = 0;
    let skippedNoMatches = 0;
    let skippedHasSelection = 0;

    for (const patient of rows) {
      if (processed >= limit) break;
      processed++;

      const email = (patient.email || '').trim().toLowerCase();
      const isTempEmail = email.startsWith('temp_') && email.endsWith('@kaufmann.health');
      if (!email || isTempEmail) {
        skippedNoEmail++;
        continue;
      }

      const meta = (patient.metadata || {}) as Record<string, unknown>;
      
      // Check email_confirmed_at is within window
      const confirmedAt = typeof meta['email_confirmed_at'] === 'string' ? meta['email_confirmed_at'] : null;
      if (!confirmedAt) {
        skippedOutsideWindow++;
        continue;
      }
      const confirmedTime = new Date(confirmedAt).getTime();
      const fromTime = new Date(fromIso).getTime();
      const toTime = new Date(toIso).getTime();
      if (confirmedTime < fromTime || confirmedTime > toTime) {
        skippedOutsideWindow++;
        continue;
      }

      // Check if already sent
      const alreadySent = await alreadySentRichEmail(patient.id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Check patient has matches and hasn't selected one yet
      const { data: matchRows } = await supabaseServer
        .from('matches')
        .select('id, therapist_id, status, secure_uuid, metadata')
        .eq('patient_id', patient.id)
        .limit(100);

      const matches = (matchRows as Array<{ id: string; therapist_id: string; status?: string | null; secure_uuid?: string | null; metadata?: Record<string, unknown> | null }> | null) || [];
      
      if (matches.length === 0) {
        skippedNoMatches++;
        continue;
      }

      // Skip if patient already selected a therapist
      const hasSelection = matches.some((m) => (m.status || '').toLowerCase() === 'patient_selected');
      if (hasSelection) {
        skippedHasSelection++;
        continue;
      }

      // Skip if patient already contacted a therapist
      const hasContacted = matches.some((m) => {
        const md = m.metadata;
        return md && typeof md === 'object' && (md as { patient_initiated?: boolean }).patient_initiated === true;
      });
      if (hasContacted) {
        skippedHasSelection++;
        continue;
      }

      // Get secure_uuid for matches page
      const secureUuid = matches.find((m) => m.secure_uuid)?.secure_uuid;
      if (!secureUuid) {
        skippedNoMatches++;
        continue;
      }

      // Get therapist IDs from matches
      const therapistIds = [...new Set(matches.map((m) => m.therapist_id).filter(Boolean))];
      if (therapistIds.length === 0) {
        skippedNoMatches++;
        continue;
      }

      // Fetch therapist details
      const { data: therapistRows } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, city, photo_url, gender, modalities, metadata, session_preferences')
        .in('id', therapistIds)
        .eq('status', 'verified');

      const therapists = (therapistRows || []) as TherapistRow[];
      if (therapists.length === 0) {
        skippedNoMatches++;
        continue;
      }

      // Score therapists to find best match
      const patientMeta: PatientMeta = {
        city: typeof meta['city'] === 'string' ? meta['city'] : undefined,
        session_preference: typeof meta['session_preference'] === 'string' ? meta['session_preference'] as 'online' | 'in_person' : undefined,
        session_preferences: Array.isArray(meta['session_preferences']) ? meta['session_preferences'] as ('online' | 'in_person')[] : undefined,
        specializations: Array.isArray(meta['specializations']) ? meta['specializations'] as string[] : undefined,
        gender_preference: typeof meta['gender_preference'] === 'string' ? meta['gender_preference'] as 'male' | 'female' | 'no_preference' : undefined,
      };

      const scored = therapists.map((t) => {
        const tMeta = (t.metadata || {}) as Record<string, unknown>;
        const sessionPrefs = Array.isArray(t.session_preferences) ? t.session_preferences as string[] : [];
        const modalities = Array.isArray(t.modalities) ? t.modalities : [];
        
        const mm = computeMismatches(patientMeta, {
          id: t.id,
          gender: t.gender || null,
          city: t.city || null,
          session_preferences: sessionPrefs,
          modalities,
        });

        const approachText = typeof (tMeta['profile'] as Record<string, unknown> | undefined)?.['approach_text'] === 'string'
          ? (tMeta['profile'] as Record<string, unknown>)['approach_text'] as string
          : '';

        return { therapist: t, mm, approachText };
      });

      // Sort: perfect matches first, then by fewest mismatches
      scored.sort((a, b) => {
        if (a.mm.isPerfect !== b.mm.isPerfect) return a.mm.isPerfect ? -1 : 1;
        return a.mm.reasons.length - b.mm.reasons.length;
      });

      const bestMatch = scored[0];
      if (!bestMatch) {
        skippedNoMatches++;
        continue;
      }

      // Build email
      const matchesUrl = `${BASE_URL}/matches/${encodeURIComponent(secureUuid)}`;
      
      try {
        const content = renderRichTherapistEmail({
          patientName: patient.name,
          patientId: patient.id,
          therapist: {
            id: bestMatch.therapist.id,
            first_name: bestMatch.therapist.first_name || '',
            last_name: bestMatch.therapist.last_name || '',
            photo_url: bestMatch.therapist.photo_url,
            city: bestMatch.therapist.city,
            modalities: bestMatch.therapist.modalities,
            approach_text: bestMatch.approachText,
          },
          matchesUrl,
        });

        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.leads.rich_therapist_email',
          ip,
          ua,
          props: { kind: 'rich_therapist_d1', patient_id: patient.id, therapist_id: bestMatch.therapist.id, subject: content.subject },
        });

        const emailSent = await sendEmail({
          to: email,
          subject: content.subject,
          html: content.html,
          context: {
            kind: 'rich_therapist_d1',
            patient_id: patient.id,
            therapist_id: bestMatch.therapist.id,
            template: 'rich_therapist_email',
          },
        });

        if (emailSent) {
          sent++;
        } else {
          await logError('admin.api.leads.rich_therapist_email', new Error('Email send returned false'), { stage: 'send_failed', patient_id: patient.id }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.leads.rich_therapist_email', e, { stage: 'send_email', patient_id: patient.id }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.leads.rich_therapist_email',
      ip,
      ua,
      props: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_no_matches: skippedNoMatches,
        skipped_has_selection: skippedHasSelection,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_no_matches: skippedNoMatches,
        skipped_has_selection: skippedHasSelection,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.leads.rich_therapist_email', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.rich_therapist_email', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
