/**
 * GET /api/portal/bookings
 *
 * Returns upcoming bookings, past bookings, and client summaries
 * for the authenticated therapist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';
import { verifyTherapistSessionToken, getTherapistSessionCookieName } from '@/lib/auth/therapistSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BookingSummary {
  id: string;
  cal_uid: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  booking_kind: string | null;
  start_time: string;
  end_time: string | null;
  source: string | null;
  video_url: string | null;
  location_type: string | null;
  status: string | null;
}

interface ClientSummary {
  patient_id: string;
  name: string | null;
  email: string;
  total_intros: number;
  total_sessions: number;
  has_completed_intro: boolean;
  last_session_date: string | null;
  next_session_date: string | null;
  status: 'active' | 'idle' | 'new';
}

/** Clean up email-prefix display names like "natalie.Heyligenstaed" */
function formatDisplayName(name: string | null, email: string): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  // If name looks like an email prefix (contains dots but no spaces, matches email local part)
  const emailLocal = email.split('@')[0] || '';
  if (trimmed === emailLocal && trimmed.includes('.') && !trimmed.includes(' ')) {
    // Capitalize parts: "natalie.Heyligenstaed" → "Natalie Heyligenstaed"
    return trimmed
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return trimmed;
}

export async function GET(_req: NextRequest) {
  try {
    // Verify therapist session
    const cookieStore = await cookies();
    const cookieName = getTherapistSessionCookieName();
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (!cookieValue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyTherapistSessionToken(cookieValue);
    if (!payload?.therapist_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const therapistId = payload.therapist_id;
    const now = new Date().toISOString();

    // Fetch bookings with patient info
    const { data: bookings, error } = await supabaseServer
      .from('cal_bookings')
      .select(`
        id, cal_uid, patient_id, booking_kind, start_time, end_time,
        source, status, last_trigger_event, metadata,
        people!left(id, name, email)
      `)
      .eq('therapist_id', therapistId)
      .eq('is_test', false)
      .neq('last_trigger_event', 'BOOKING_CANCELLED')
      .order('start_time', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[api.portal.bookings] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    const rows = bookings || [];

    // Map bookings to response shape and split into upcoming/past
    const upcoming: BookingSummary[] = [];
    const past: BookingSummary[] = [];

    // Track client data for summaries
    const clientMap = new Map<string, {
      name: string | null;
      email: string;
      intros: number;
      sessions: number;
      lastSessionDate: string | null;
      nextSessionDate: string | null;
    }>();

    for (const row of rows) {
      // Normalize Supabase join (can be array or object)
      const peopleData = row.people as unknown;
      const people = (Array.isArray(peopleData) ? peopleData[0] : peopleData) as
        { id: string; name: string | null; email: string } | null;

      const metadata = row.metadata as Record<string, unknown> | null;
      const videoUrl = (metadata?.videoCallUrl as string) || null;
      // Detect location type: check metadata.locationType first, then infer from videoUrl presence
      const metaLocationType = metadata?.locationType as string | undefined;
      const locationType = metaLocationType === 'in_person' ? 'in_person' : 'video';

      const booking: BookingSummary = {
        id: row.id,
        cal_uid: row.cal_uid,
        patient_id: row.patient_id,
        patient_name: people ? formatDisplayName(people.name, people.email) : null,
        patient_email: people?.email ?? null,
        booking_kind: row.booking_kind,
        start_time: row.start_time,
        end_time: row.end_time,
        source: row.source,
        video_url: videoUrl,
        location_type: locationType,
        status: row.status,
      };

      const isUpcoming = row.start_time > now;

      if (isUpcoming) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }

      // Aggregate client data
      if (row.patient_id && people?.email) {
        const existing = clientMap.get(row.patient_id);
        const isIntro = row.booking_kind === 'intro';
        const isSession = row.booking_kind === 'full_session';

        if (existing) {
          if (isIntro) existing.intros++;
          if (isSession) existing.sessions++;
          // Track last (past) session date
          if (!isUpcoming && (!existing.lastSessionDate || row.start_time > existing.lastSessionDate)) {
            existing.lastSessionDate = row.start_time;
          }
          // Track next (upcoming) session date
          if (isUpcoming && (!existing.nextSessionDate || row.start_time < existing.nextSessionDate)) {
            existing.nextSessionDate = row.start_time;
          }
        } else {
          clientMap.set(row.patient_id, {
            name: people.name,
            email: people.email,
            intros: isIntro ? 1 : 0,
            sessions: isSession ? 1 : 0,
            lastSessionDate: !isUpcoming ? row.start_time : null,
            nextSessionDate: isUpcoming ? row.start_time : null,
          });
        }
      }
    }

    // Sort upcoming ASC (soonest first), past is already DESC from the query
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Limit past to 50
    const pastLimited = past.slice(0, 50);

    // Build client summaries
    const clients: ClientSummary[] = Array.from(clientMap.entries()).map(
      ([patientId, data]) => {
        let status: ClientSummary['status'];
        if (data.nextSessionDate) {
          status = 'active';
        } else if (data.sessions === 0) {
          status = 'new';
        } else {
          status = 'idle';
        }

        return {
          patient_id: patientId,
          name: formatDisplayName(data.name, data.email),
          email: data.email,
          total_intros: data.intros,
          total_sessions: data.sessions,
          has_completed_intro: data.intros > 0,
          last_session_date: data.lastSessionDate,
          next_session_date: data.nextSessionDate,
          status,
        };
      }
    );

    // Sort clients by most recent interaction (last session or next session date) DESC
    clients.sort((a, b) => {
      const dateA = a.next_session_date || a.last_session_date || '';
      const dateB = b.next_session_date || b.last_session_date || '';
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json({ upcoming, past: pastLimited, clients });
  } catch (err) {
    console.error('[api.portal.bookings] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
