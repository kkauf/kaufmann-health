import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderFeedbackRequestEmail } from '@/lib/email/templates/feedbackRequest';
import { renderBehavioralFeedbackEmail } from '@/lib/email/templates/feedbackBehavioral';
import { batchClassifyBehavior, type PatientBehaviorSegment } from '@/lib/email/patientBehavior';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 10-11 days after email verification
const MIN_DAYS = 10;
const MAX_DAYS = 11;

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
  return isCronAuthorizedShared(req);
}

function sameOrigin(req: Request): boolean {
  return sameOriginShared(req);
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

// Check if we've already sent this email for this patient
async function alreadySentFeedbackRequest(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
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
      if (kind === 'feedback_request_d10' && pid === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Check if selection nudge email was sent (prerequisite)
async function selectionNudgeEmailSent(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
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
      if (kind === 'selection_nudge_d5' && pid === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

type PatientRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
type MatchRow = { id: string; therapist_id: string; status?: string | null; secure_uuid?: string | null; metadata?: Record<string, unknown> | null };
type TherapistRow = { id: string; first_name?: string | null; last_name?: string | null; city?: string | null; modalities?: string[] | null; approach_text?: string | null };

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

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.feedback_request', props: { limit }, ip, ua });

    const fromIso = daysAgo(MAX_DAYS);
    const toIso = daysAgo(MIN_DAYS);

    // Find eligible patients
    const { data: patients, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .eq('type', 'patient')
      .eq('status', 'new')
      .limit(limit);

    if (pErr) {
      await logError('admin.api.leads.feedback_request', pErr, { stage: 'fetch_patients' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch patients' }, { status: 500 });
    }

    const rows = (patients as PatientRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOutsideWindow = 0;
    let skippedAlreadySent = 0;
    let skippedHasBooking = 0;
    let skippedNoD5Email = 0;
    let skippedNoMatches = 0;
    let sentBehavioral = 0;
    let sentGeneric = 0;

    // ========================================================================
    // Pass 1: Collect eligible patients (all existing checks)
    // ========================================================================
    type EligiblePatient = {
      patient: PatientRow;
      email: string;
    };
    const eligible: EligiblePatient[] = [];

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
      const alreadySent = await alreadySentFeedbackRequest(patient.id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Check if Day 5 email was sent (prerequisite)
      const d5Sent = await selectionNudgeEmailSent(patient.id);
      if (!d5Sent) {
        skippedNoD5Email++;
        continue;
      }

      // Check if patient has booked successfully (skip if they have a non-cancelled booking)
      const { data: bookings } = await supabaseServer
        .from('matches')
        .select('id, status, metadata')
        .eq('patient_id', patient.id)
        .limit(100);

      const hasSuccessfulBooking = (bookings || []).some((b: { status?: string | null; metadata?: Record<string, unknown> | null }) => {
        const status = (b.status || '').toLowerCase();
        const md = b.metadata;
        const contacted = md && typeof md === 'object' && (md as { patient_initiated?: boolean }).patient_initiated === true;
        return status === 'patient_selected' || status === 'booked' || contacted;
      });

      // Also check cal_bookings for completed sessions
      const { data: calBookings } = await supabaseServer
        .from('cal_bookings')
        .select('id, status')
        .eq('patient_id', patient.id)
        .neq('status', 'CANCELLED')
        .limit(10);

      const hasCompletedCalBooking = (calBookings || []).length > 0;

      if (hasSuccessfulBooking || hasCompletedCalBooking) {
        skippedHasBooking++;
        continue;
      }

      eligible.push({ patient, email });
    }

    // ========================================================================
    // Pass 2: Batch-fetch matches, classify behavior, enrich, send
    // ========================================================================
    if (eligible.length > 0) {
      // Fetch matches for all eligible patients
      const eligibleIds = eligible.map(e => e.patient.id);
      const { data: allMatches } = await supabaseServer
        .from('matches')
        .select('id, patient_id, therapist_id, status, secure_uuid, metadata')
        .in('patient_id', eligibleIds)
        .limit(1000);

      const matchesByPatient = new Map<string, MatchRow[]>();
      for (const m of ((allMatches || []) as (MatchRow & { patient_id: string })[]) ) {
        const pid = m.patient_id;
        if (!matchesByPatient.has(pid)) matchesByPatient.set(pid, []);
        matchesByPatient.get(pid)!.push(m);
      }

      // Build secureUuid → patientId map for behavior classification
      const secureUuidToPatient = new Map<string, string>();
      for (const [pid, matches] of matchesByPatient) {
        const uuid = matches.find(m => m.secure_uuid)?.secure_uuid;
        if (uuid) secureUuidToPatient.set(uuid, pid);
      }

      // Batch-classify behavior (single events query)
      const sinceIso = daysAgo(MAX_DAYS + 1); // 12 days to ensure full coverage
      let behaviorMap = new Map<string, PatientBehaviorSegment>();
      try {
        behaviorMap = await batchClassifyBehavior(supabaseServer, secureUuidToPatient, sinceIso);
      } catch (e) {
        await logError('admin.api.leads.feedback_request', e, { stage: 'batch_classify_behavior' }, ip, ua);
        // Continue — will fall back to generic template
      }

      // Collect therapist IDs we need details for (for almost_booked and never_visited)
      const therapistIdsNeeded = new Set<string>();
      for (const ep of eligible) {
        const segment = behaviorMap.get(ep.patient.id);
        if (!segment) continue;
        const matches = matchesByPatient.get(ep.patient.id) || [];
        if (segment.segment === 'almost_booked') {
          therapistIdsNeeded.add(segment.therapist_id);
        } else if (segment.segment === 'never_visited') {
          // Use first matched therapist
          const firstTid = matches.find(m => m.therapist_id)?.therapist_id;
          if (firstTid) therapistIdsNeeded.add(firstTid);
        }
      }

      // Batch-fetch therapist details and Cal slots
      const therapistMap = new Map<string, TherapistRow>();
      const calSlotMap = new Map<string, { slots_count: number; next_intro_time_utc: string | null }>();

      if (therapistIdsNeeded.size > 0) {
        const tIds = [...therapistIdsNeeded];

        const [therapistResult, calSlotResult] = await Promise.all([
          supabaseServer
            .from('therapists')
            .select('id, first_name, last_name, city, modalities, approach_text')
            .in('id', tIds)
            .eq('status', 'verified'),
          supabaseServer
            .from('cal_slots_cache')
            .select('therapist_id, slots_count, next_intro_time_utc')
            .in('therapist_id', tIds)
            .gt('slots_count', 0),
        ]);

        for (const t of ((therapistResult.data || []) as TherapistRow[])) {
          therapistMap.set(t.id, t);
        }

        for (const s of ((calSlotResult.data || []) as Array<{ therapist_id: string; slots_count: number; next_intro_time_utc?: string | null }>)) {
          calSlotMap.set(s.therapist_id, { slots_count: s.slots_count, next_intro_time_utc: s.next_intro_time_utc || null });
        }
      }

      // ======================================================================
      // Send emails
      // ======================================================================
      for (const ep of eligible) {
        const { patient, email } = ep;
        const segment = behaviorMap.get(patient.id);
        const matches = matchesByPatient.get(patient.id) || [];
        const secureUuid = matches.find(m => m.secure_uuid)?.secure_uuid;

        // Skip contacted patients — they don't need a feedback email
        if (segment?.segment === 'contacted') {
          skippedHasBooking++; // Count as "has booking" equivalent
          continue;
        }

        try {
          let content: { subject: string; html?: string };
          let templateName: string;
          let variant: string | undefined;
          let rejectionReason: string | undefined;

          if (segment && secureUuid) {
            // Use behavioral template
            const matchesUrl = `${BASE_URL}/matches/${encodeURIComponent(secureUuid)}`;

            // Resolve therapist for segments that need it
            let therapistInfo: TherapistRow | null = null;
            let calSlotInfo: { slots_count: number; next_intro_time_utc: string | null } | null = null;

            if (segment.segment === 'almost_booked') {
              therapistInfo = therapistMap.get(segment.therapist_id) || null;
              calSlotInfo = calSlotMap.get(segment.therapist_id) || null;
            } else if (segment.segment === 'never_visited') {
              const firstTid = matches.find(m => m.therapist_id)?.therapist_id;
              if (firstTid) {
                therapistInfo = therapistMap.get(firstTid) || null;
                calSlotInfo = calSlotMap.get(firstTid) || null;
              }
            }

            // Format next slot date
            let nextSlotDate: string | null = null;
            if (calSlotInfo?.next_intro_time_utc) {
              try {
                const slotDate = new Date(calSlotInfo.next_intro_time_utc);
                const weekday = slotDate.toLocaleDateString('de-DE', { weekday: 'short' });
                const day = slotDate.getDate();
                const month = slotDate.toLocaleDateString('de-DE', { month: 'short' });
                nextSlotDate = `${weekday} ${day}. ${month}`;
              } catch {}
            }

            content = renderBehavioralFeedbackEmail({
              patientName: patient.name,
              patientId: patient.id,
              segment,
              matchesUrl,
              therapist: therapistInfo ? {
                id: therapistInfo.id,
                first_name: therapistInfo.first_name || '',
                last_name: therapistInfo.last_name || '',
                city: therapistInfo.city,
                modalities: therapistInfo.modalities,
                approach_text: therapistInfo.approach_text,
              } : null,
              availableSlots: calSlotInfo?.slots_count || null,
              nextSlotDate,
            });

            templateName = 'feedback_behavioral';
            variant = segment.segment;
            rejectionReason = segment.segment === 'rejected' ? segment.reasons[0]?.reason : undefined;
            sentBehavioral++;
          } else {
            // Fall back to generic template (no matches or classification failed)
            if (!secureUuid) skippedNoMatches++;

            content = renderFeedbackRequestEmail({
              patientName: patient.name,
              patientId: patient.id,
            });

            templateName = 'feedback_request';
            sentGeneric++;
          }

          void track({
            type: 'email_attempted',
            level: 'info',
            source: 'admin.api.leads.feedback_request',
            ip,
            ua,
            props: {
              kind: 'feedback_request_d10',
              patient_id: patient.id,
              subject: content.subject,
              template: templateName,
              variant,
              rejection_reason: rejectionReason,
            },
          });

          const emailResult = await sendEmail({
            to: email,
            subject: content.subject,
            html: content.html,
            context: {
              kind: 'feedback_request_d10',
              patient_id: patient.id,
              template: templateName,
              variant,
              rejection_reason: rejectionReason,
            },
          });

          if (emailResult.sent) {
            sent++;
          } else if (emailResult.reason === 'failed') {
            await logError('admin.api.leads.feedback_request', new Error('Email send returned false'), { stage: 'send_failed', patient_id: patient.id }, ip, ua);
          }
        } catch (e) {
          await logError('admin.api.leads.feedback_request', e, { stage: 'send_email', patient_id: patient.id }, ip, ua);
        }
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.leads.feedback_request',
      ip,
      ua,
      props: {
        processed,
        sent,
        sent_behavioral: sentBehavioral,
        sent_generic: sentGeneric,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_booking: skippedHasBooking,
        skipped_no_d5_email: skippedNoD5Email,
        skipped_no_matches: skippedNoMatches,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        sent_behavioral: sentBehavioral,
        sent_generic: sentGeneric,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_booking: skippedHasBooking,
        skipped_no_d5_email: skippedNoD5Email,
        skipped_no_matches: skippedNoMatches,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.leads.feedback_request', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.feedback_request', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
