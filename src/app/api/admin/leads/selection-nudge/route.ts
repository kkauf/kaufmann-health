import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 5-6 days after email verification
const MIN_DAYS = 5;
const MAX_DAYS = 6;

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
async function alreadySentSelectionNudge(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
    const { count, error } = await supabaseServer
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'email_sent')
      .eq('properties->>kind', 'selection_nudge_d5')
      .eq('properties->>patient_id', patientId)
      .gte('created_at', sinceIso);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// Check if rich therapist email was sent (prerequisite)
async function richTherapistEmailSent(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
    const { count, error } = await supabaseServer
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'email_sent')
      .eq('properties->>kind', 'rich_therapist_d1')
      .eq('properties->>patient_id', patientId)
      .gte('created_at', sinceIso);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

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

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.selection_nudge', props: { limit }, ip, ua });

    const fromIso = daysAgo(MAX_DAYS);
    const toIso = daysAgo(MIN_DAYS);

    // Find eligible patients
    const { data: patients, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .eq('type', 'patient')
      .in('status', ['new', 'matched'])
      .gte('metadata->>email_confirmed_at', fromIso)
      .lte('metadata->>email_confirmed_at', toIso)
      .limit(limit);

    if (pErr) {
      await logError('admin.api.leads.selection_nudge', pErr, { stage: 'fetch_patients' }, ip, ua);
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
    let skippedNoD1Email = 0;
    let skippedHasIntroBooking = 0;

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

      // Check if patient opted out of emails
      if (meta['email_opted_out'] === true || meta['email_opted_out'] === 'true') {
        skippedNoEmail++;
        continue;
      }

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
      const alreadySent = await alreadySentSelectionNudge(patient.id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Check if Day 1 email was sent (prerequisite)
      const d1Sent = await richTherapistEmailSent(patient.id);
      if (!d1Sent) {
        skippedNoD1Email++;
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

      // Skip if patient already selected or contacted a therapist
      const hasSelection = matches.some((m) => (m.status || '').toLowerCase() === 'patient_selected');
      const hasContacted = matches.some((m) => {
        const md = m.metadata;
        return md && typeof md === 'object' && (md as { patient_initiated?: boolean }).patient_initiated === true;
      });
      if (hasSelection || hasContacted) {
        skippedHasSelection++;
        continue;
      }

      // Check if patient has already booked an intro via Cal.com
      // If they've converted, no need to nudge
      const therapistIds = matches.map(m => m.therapist_id);
      let hasIntroBooking = false;
      try {
        const { data: bookings } = await supabaseServer
          .from('cal_bookings')
          .select('id')
          .eq('patient_id', patient.id)
          .in('therapist_id', therapistIds)
          .eq('booking_kind', 'intro')
          .neq('last_trigger_event', 'BOOKING_CANCELLED')
          .limit(1);
        hasIntroBooking = Array.isArray(bookings) && bookings.length > 0;
      } catch {
        // Table may not exist in test environment
      }
      if (hasIntroBooking) {
        skippedHasIntroBooking++;
        continue;
      }

      // Get secure_uuid for matches page
      const secureUuid = matches.find((m) => m.secure_uuid)?.secure_uuid;
      if (!secureUuid) {
        skippedNoMatches++;
        continue;
      }

      // Build and send email
      const matchesUrl = `${BASE_URL}/matches/${encodeURIComponent(secureUuid)}`;

      // Fetch best therapist data for enhanced email with direct booking
      type TherapistRow = {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        photo_url?: string | null;
        city?: string | null;
        modalities?: string[] | null;
        cal_username?: string | null;
        cal_enabled?: boolean | null;
        metadata?: { profile?: { qualification?: string; who_comes_to_me?: string } } | null;
      };
      const bestTherapistId = matches[0]?.therapist_id;
      let bestTherapist: TherapistRow | null = null;
      let nextIntroSlot: { date_iso: string; time_label: string; time_utc: string } | null = null;
      let calBookingUrl: string | null = null;

      if (bestTherapistId) {
        try {
          // Fetch therapist details
          const { data: tRow } = await supabaseServer
            .from('therapists')
            .select('id, first_name, last_name, photo_url, city, modalities, cal_username, cal_enabled, metadata')
            .eq('id', bestTherapistId)
            .maybeSingle();
          bestTherapist = tRow as TherapistRow | null;

          // Fetch slot cache for next intro
          if (bestTherapist?.cal_enabled && bestTherapist?.cal_username) {
            const { data: slotRow } = await supabaseServer
              .from('cal_slots_cache')
              .select('next_intro_date_iso, next_intro_time_label, next_intro_time_utc')
              .eq('therapist_id', bestTherapistId)
              .maybeSingle();
            const slot = slotRow as { next_intro_date_iso?: string | null; next_intro_time_label?: string | null; next_intro_time_utc?: string | null } | null;
            if (slot?.next_intro_time_utc) {
              nextIntroSlot = {
                date_iso: slot.next_intro_date_iso || '',
                time_label: slot.next_intro_time_label || '',
                time_utc: slot.next_intro_time_utc,
              };
              // Build Cal.com booking URL
              calBookingUrl = buildCalBookingUrl({
                calUsername: bestTherapist.cal_username,
                eventType: 'intro',
                metadata: {
                  kh_therapist_id: bestTherapistId,
                  kh_patient_id: patient.id,
                  kh_booking_kind: 'intro',
                  kh_source: 'email_confirm',
                },
                redirectBack: true,
              });
            }
          }
        } catch {
          // Continue without enhanced data
        }
      }

      try {
        const content = renderSelectionNudgeEmail({
          patientName: patient.name,
          matchesUrl,
          // Enhanced therapist data for direct booking
          therapist: bestTherapist ? {
            first_name: bestTherapist.first_name || '',
            last_name: bestTherapist.last_name || '',
            photo_url: bestTherapist.photo_url,
            city: bestTherapist.city,
            modalities: bestTherapist.modalities,
            qualification: bestTherapist.metadata?.profile?.qualification,
            who_comes_to_me: bestTherapist.metadata?.profile?.who_comes_to_me,
          } : undefined,
          nextIntroSlot,
          calBookingUrl,
        });

        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.leads.selection_nudge',
          ip,
          ua,
          props: { kind: 'selection_nudge_d5', patient_id: patient.id, subject: content.subject },
        });

        const emailResult = await sendEmail({
          to: email,
          subject: content.subject,
          html: content.html,
          context: {
            kind: 'selection_nudge_d5',
            patient_id: patient.id,
            template: 'selection_nudge',
          },
        });

        if (emailResult.sent) {
          sent++;
        } else if (emailResult.reason === 'failed') {
          await logError('admin.api.leads.selection_nudge', new Error('Email send returned false'), { stage: 'send_failed', patient_id: patient.id }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.leads.selection_nudge', e, { stage: 'send_email', patient_id: patient.id }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.leads.selection_nudge',
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
        skipped_no_d1_email: skippedNoD1Email,
        skipped_has_intro_booking: skippedHasIntroBooking,
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
        skipped_no_d1_email: skippedNoD1Email,
        skipped_has_intro_booking: skippedHasIntroBooking,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.leads.selection_nudge', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.selection_nudge', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
