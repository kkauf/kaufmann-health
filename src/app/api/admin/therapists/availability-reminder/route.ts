/**
 * Therapist Availability Reminder Cron
 * 
 * Weekly check for therapists with low availability (<3 slots in next 7 days).
 * Sends friendly "Stimmt deine Verfügbarkeit so?" email.
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendTherapistEmail } from '@/lib/email/client';
import { renderTherapistAvailabilityReminder } from '@/lib/email/templates/therapistAvailabilityReminder';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const SLOTS_THRESHOLD = 3; // Send reminder if < 3 slots
const DAYS_TO_CHECK = 7;

type TherapistRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  cal_username?: string | null;
  cal_enabled?: boolean | null;
  accepting_new?: boolean | null;
};

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

/**
 * Fetch slot count for a therapist from Cal.com via our slots API
 */
async function getSlotCount(
  therapistId: string,
  kind: 'intro' | 'full_session'
): Promise<number> {
  try {
    const today = new Date();
    const start = today.toISOString().split('T')[0];
    const end = new Date(today.getTime() + DAYS_TO_CHECK * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Call our internal slots API (server-side)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = new URL('/api/public/cal/slots', baseUrl);
    url.searchParams.set('therapist_id', therapistId);
    url.searchParams.set('kind', kind);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return -1; // Error fetching

    const json = await res.json();
    if (json.error || !json.data?.slots) return -1;

    return json.data.slots.length;
  } catch {
    return -1; // Error
  }
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret
    const isCron = isCronAuthorizedShared(req);
    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOriginShared(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limitQS = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(Number(limitQS || 100), 500));

    // Log cron start
    const isVercelCron = Boolean(req.headers.get('x-vercel-cron'));
    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.availability-reminder',
      props: {
        limit,
        triggered_by: isCron ? (isVercelCron ? 'vercel_cron' : 'secret') : 'manual',
      },
      ip,
      ua,
    });

    // Fetch verified therapists with Cal.com enabled and accepting new patients
    const { data: therapists, error: fetchError } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, cal_username, cal_enabled, accepting_new')
      .eq('status', 'verified')
      .eq('cal_enabled', true)
      .not('cal_username', 'is', null)
      .eq('accepting_new', true)
      .limit(limit);

    if (fetchError) {
      await logError('admin.api.therapists.availability-reminder', fetchError, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch therapists' }, { status: 500 });
    }

    const rows = (therapists as TherapistRow[] | null) || [];
    
    let processed = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedHighAvailability = 0;
    let skippedFetchError = 0;
    const examples: Array<{ id: string; name: string; introSlots: number; fullSlots: number }> = [];

    for (const t of rows) {
      processed++;

      if (!t.email || !t.cal_username) {
        skippedNoEmail++;
        continue;
      }

      // Fetch slot counts for both intro and full session
      const [introSlots, fullSlots] = await Promise.all([
        getSlotCount(t.id, 'intro'),
        getSlotCount(t.id, 'full_session'),
      ]);

      // Skip if we couldn't fetch slots
      if (introSlots < 0 || fullSlots < 0) {
        skippedFetchError++;
        continue;
      }

      // Skip if both have sufficient availability
      if (introSlots >= SLOTS_THRESHOLD && fullSlots >= SLOTS_THRESHOLD) {
        skippedHighAvailability++;
        continue;
      }

      const name = [t.first_name || '', t.last_name || ''].join(' ').trim() || 'Therapeut:in';
      const calUrl = `${CAL_ORIGIN}/${t.cal_username}`;

      const email = renderTherapistAvailabilityReminder({
        name,
        introSlots,
        fullSessionSlots: fullSlots,
        calUrl,
      });

      try {
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.therapists.availability-reminder',
          props: {
            stage: 'therapist_availability_reminder',
            therapist_id: t.id,
            intro_slots: introSlots,
            full_slots: fullSlots,
          },
        });

        const result = await sendTherapistEmail({
          to: t.email,
          subject: email.subject,
          html: email.html,
          context: { stage: 'therapist_availability_reminder', therapist_id: t.id },
        });

        if (result.sent) {
          sent++;
          if (examples.length < 5) {
            examples.push({ id: t.id, name, introSlots, fullSlots });
          }
        }
      } catch (e) {
        await logError('admin.api.therapists.availability-reminder', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    // Log completion
    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.therapists.availability-reminder',
      props: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_high_availability: skippedHighAvailability,
        skipped_fetch_error: skippedFetchError,
        duration_ms: Date.now() - startedAt,
      },
      ip,
      ua,
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_high_availability: skippedHighAvailability,
        skipped_fetch_error: skippedFetchError,
        examples,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.therapists.availability-reminder', e, { stage: 'exception' }, ip, ua);
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.availability-reminder',
      props: { duration_ms: Date.now() - startedAt },
      ip,
      ua,
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
