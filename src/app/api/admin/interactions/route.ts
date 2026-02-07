import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { parseQueryParams, success, fail } from '@/lib/api-utils';
import { AdminInteractionsQueryInput } from '@/contracts/admin';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(';')) {
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

/** Filter out null/undefined/string-null from ID arrays before passing to .in() */
function validIds(ids: Iterable<string>): string[] {
  return [...ids].filter((id): id is string => !!id && id !== 'null' && id !== 'undefined');
}

type MatchRow = { id: string; patient_id: string; therapist_id: string; status: string; created_at: string };
type BookingRow = { patient_id: string; therapist_id: string; booking_kind: string; start_time: string; status: string };
type MessageRow = { patient_id: string; therapist_id: string };
type EmailEventRow = { properties: Record<string, unknown>; created_at: string };

export async function GET(req: Request) {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = parseQueryParams(req, AdminInteractionsQueryInput);
    if (!parsed.success) return parsed.response;

    const { filter = 'all', search, created_after, created_before, limit = 100, offset = 0 } = parsed.data;

    // 1. Fetch matches (exclude null patient/therapist IDs at query level)
    const { data: matchRows, error: matchErr } = await supabaseServer
      .from('matches')
      .select('id, patient_id, therapist_id, status, created_at')
      .not('patient_id', 'is', null)
      .not('therapist_id', 'is', null);

    if (matchErr) {
      await logError('admin.api.interactions', matchErr, { stage: 'matches' });
      return fail('Failed to fetch matches', 500);
    }

    // Group matches by patient_id
    const matchesByPatient = new Map<string, MatchRow[]>();
    for (const m of (matchRows || []) as MatchRow[]) {
      const arr = matchesByPatient.get(m.patient_id) || [];
      arr.push(m);
      matchesByPatient.set(m.patient_id, arr);
    }

    const patientIdsWithMatches = validIds(matchesByPatient.keys());
    if (patientIdsWithMatches.length === 0) {
      return success({ rows: [], total: 0 });
    }

    // 2. Fetch patients
    let patientsQuery = supabaseServer
      .from('people')
      .select('id, name, email, phone_number, status, metadata, created_at')
      .eq('type', 'patient')
      .in('id', patientIdsWithMatches)
      .order('created_at', { ascending: false });

    if (search) {
      patientsQuery = patientsQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (created_after) patientsQuery = patientsQuery.gte('created_at', created_after);
    if (created_before) patientsQuery = patientsQuery.lte('created_at', created_before);

    const { data: patientRows, error: patientErr } = await patientsQuery;

    if (patientErr) {
      await logError('admin.api.interactions', patientErr, { stage: 'patients' });
      return fail('Failed to fetch patients', 500);
    }

    if (!patientRows || patientRows.length === 0) {
      return success({ rows: [], total: 0 });
    }

    const filteredPatientIds = patientRows.map((p) => p.id as string);
    const patientIdSet = new Set(filteredPatientIds);

    // 3–5: Parallel queries — bookings, messaging contacts, emails
    const [bookingsRes, messagesRes, emailsRes] = await Promise.all([
      // 3. Bookings (exclude null IDs at query level)
      supabaseServer
        .from('cal_bookings')
        .select('patient_id, therapist_id, booking_kind, start_time, status')
        .in('patient_id', filteredPatientIds)
        .not('therapist_id', 'is', null)
        .neq('last_trigger_event', 'BOOKING_CANCELLED')
        .not('status', 'in', '("CANCELLED","no_show","no_show_guest","no_show_host")'),

      // 4. Messaging contacts (contact_message_sent events — the actual signal)
      supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'contact_message_sent')
        .not('properties->>patient_id', 'is', null)
        .not('properties->>therapist_id', 'is', null),

      // 5. Email events
      supabaseServer
        .from('events')
        .select('properties, created_at')
        .in('type', ['email_sent', 'email_bounced'])
        .or('properties->>patient_id.not.is.null,properties->>lead_id.not.is.null'),
    ]);

    if (bookingsRes.error) {
      await logError('admin.api.interactions', bookingsRes.error, { stage: 'bookings' });
      return fail('Failed to fetch bookings', 500);
    }

    // Group bookings by patient_id
    const bookingsByPatient = new Map<string, BookingRow[]>();
    for (const b of (bookingsRes.data || []) as BookingRow[]) {
      const arr = bookingsByPatient.get(b.patient_id) || [];
      arr.push(b);
      bookingsByPatient.set(b.patient_id, arr);
    }

    // Group messaging contacts by patient_id
    const messagesByPatient = new Map<string, MessageRow[]>();
    for (const e of messagesRes.data || []) {
      const props = (e.properties || {}) as Record<string, unknown>;
      const pid = props.patient_id as string | undefined;
      const tid = props.therapist_id as string | undefined;
      if (pid && tid && patientIdSet.has(pid)) {
        const arr = messagesByPatient.get(pid) || [];
        arr.push({ patient_id: pid, therapist_id: tid });
        messagesByPatient.set(pid, arr);
      }
    }

    // Group email counts by patient_id
    const emailCountByPatient = new Map<string, number>();
    if (!emailsRes.error) {
      for (const e of (emailsRes.data || []) as EmailEventRow[]) {
        const pid = (e.properties?.patient_id as string) || (e.properties?.lead_id as string) || null;
        if (pid && patientIdSet.has(pid)) {
          emailCountByPatient.set(pid, (emailCountByPatient.get(pid) || 0) + 1);
        }
      }
    }

    // 6. Collect unique therapist IDs and fetch names
    const allTherapistIds = new Set<string>();
    for (const pid of filteredPatientIds) {
      for (const m of matchesByPatient.get(pid) || []) allTherapistIds.add(m.therapist_id);
      for (const b of bookingsByPatient.get(pid) || []) allTherapistIds.add(b.therapist_id);
      for (const msg of messagesByPatient.get(pid) || []) allTherapistIds.add(msg.therapist_id);
    }

    const therapistNames = new Map<string, string>();
    const cleanTherapistIds = validIds(allTherapistIds);
    if (cleanTherapistIds.length > 0) {
      const { data: therapistRows, error: therapistErr } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name')
        .in('id', cleanTherapistIds);

      if (therapistErr) {
        await logError('admin.api.interactions', therapistErr, { stage: 'therapists' });
      }
      for (const t of therapistRows || []) {
        therapistNames.set(t.id as string, [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Unbekannt');
      }
    }

    // 7. Compute rows
    const now = new Date();
    type InteractionRow = {
      patient_id: string;
      patient_name: string | null;
      patient_email: string | null;
      match_count: number;
      therapist_names: string[];
      intro_count: number;
      session_count: number;
      last_booking: string | null;
      next_booking: string | null;
      channel: 'calendar' | 'messaging' | 'mixed' | 'none';
      email_count: number;
      message_count: number;
      created_at: string;
    };

    let rows: InteractionRow[] = patientRows.map((p) => {
      const pid = p.id as string;
      const matches = matchesByPatient.get(pid) || [];
      const bookings = bookingsByPatient.get(pid) || [];
      const messages = messagesByPatient.get(pid) || [];

      // Channel = what action did the patient take?
      // - calendar: has bookings (strong signal — booked via Cal.com)
      // - messaging: sent messages to therapists (fallback when Cal.com unavailable — needs follow-up)
      // - mixed: has both bookings and messages
      // - none: only proposed matches, no patient action yet
      const hasBookings = bookings.length > 0;
      const hasMessages = messages.length > 0;
      let channel: InteractionRow['channel'] = 'none';
      if (hasBookings && hasMessages) channel = 'mixed';
      else if (hasBookings) channel = 'calendar';
      else if (hasMessages) channel = 'messaging';

      // Booking stats
      let introCount = 0;
      let sessionCount = 0;
      let lastBooking: string | null = null;
      let nextBooking: string | null = null;

      for (const b of bookings) {
        if (b.booking_kind === 'intro') introCount++;
        else sessionCount++;
        const t = b.start_time;
        if (new Date(t) < now) {
          if (!lastBooking || t > lastBooking) lastBooking = t;
        } else {
          if (!nextBooking || t < nextBooking) nextBooking = t;
        }
      }

      // Therapist names: from all sources (matches + bookings + messages), deduplicated
      const allTids = new Set<string>();
      for (const m of matches) allTids.add(m.therapist_id);
      for (const b of bookings) allTids.add(b.therapist_id);
      for (const msg of messages) allTids.add(msg.therapist_id);
      const names = validIds(allTids).map((tid) => therapistNames.get(tid) || 'Unbekannt');

      return {
        patient_id: pid,
        patient_name: p.name as string | null,
        patient_email: p.email as string | null,
        match_count: matches.length,
        therapist_names: names,
        intro_count: introCount,
        session_count: sessionCount,
        last_booking: lastBooking,
        next_booking: nextBooking,
        channel,
        email_count: emailCountByPatient.get(pid) || 0,
        message_count: messages.length,
        created_at: p.created_at as string,
      };
    });

    // 8. Apply post-computation filters
    if (filter === 'messaging_only') {
      rows = rows.filter((r) => r.channel === 'messaging' || r.channel === 'mixed');
    } else if (filter === 'booked_only') {
      rows = rows.filter((r) => r.channel === 'calendar' || r.channel === 'mixed');
    } else if (filter === 'has_upcoming') {
      rows = rows.filter((r) => r.next_booking !== null);
    }

    const total = rows.length;
    rows = rows.slice(offset, offset + limit);

    return success({ rows, total });
  } catch (e) {
    await logError('admin.api.interactions', e, { stage: 'exception' });
    return fail('Unexpected error', 500);
  }
}
