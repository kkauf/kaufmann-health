import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { success, fail } from '@/lib/api-utils';
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  if (!(await assertAdmin(req))) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { patientId } = await params;

    // Parallel: matches with therapist info, bookings, email events
    const [matchesRes, bookingsRes, emailsRes] = await Promise.all([
      supabaseServer
        .from('matches')
        .select(`
          id, therapist_id, status, created_at,
          therapists!inner(id, first_name, last_name, email, phone, city)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),

      supabaseServer
        .from('cal_bookings')
        .select('id, therapist_id, booking_kind, start_time, end_time, status, last_trigger_event')
        .eq('patient_id', patientId)
        .neq('last_trigger_event', 'BOOKING_CANCELLED')
        .not('status', 'in', '("CANCELLED","no_show","no_show_guest","no_show_host")')
        .order('start_time', { ascending: false }),

      // Emails use either patient_id or lead_id in properties
      supabaseServer
        .from('events')
        .select('type, properties, created_at')
        .in('type', ['email_sent', 'email_bounced'])
        .or(`properties->>patient_id.eq.${patientId},properties->>lead_id.eq.${patientId}`)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (matchesRes.error) {
      await logError('admin.api.interactions.detail', matchesRes.error, { patientId });
      return fail('Failed to fetch matches', 500);
    }

    // Group bookings per therapist
    const bookingsByTherapist = new Map<string, typeof bookingsRes.data>();
    for (const b of bookingsRes.data || []) {
      const tid = b.therapist_id as string;
      const arr = bookingsByTherapist.get(tid) || [];
      arr.push(b);
      bookingsByTherapist.set(tid, arr);
    }

    // Build per-therapist data
    type TherapistInfo = {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      city: string | null;
    };

    type TherapistGroup = {
      therapist: TherapistInfo;
      match_status: string;
      match_created_at: string;
      has_bookings: boolean;
      bookings: {
        id: string;
        kind: string;
        start_time: string;
        end_time: string | null;
        status: string;
      }[];
    };

    const therapists: TherapistGroup[] = (matchesRes.data || []).map((m) => {
      const t = m.therapists as unknown as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        phone: string | null;
        city: string | null;
      };
      const tid = m.therapist_id as string;
      const tBookings = (bookingsByTherapist.get(tid) || []).map((b) => ({
        id: b.id as string,
        kind: b.booking_kind as string,
        start_time: b.start_time as string,
        end_time: b.end_time as string | null,
        status: b.status as string,
      }));

      return {
        therapist: {
          id: tid,
          name: [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Unbekannt',
          email: t.email,
          phone: t.phone,
          city: t.city,
        },
        match_status: m.status as string,
        match_created_at: m.created_at as string,
        has_bookings: tBookings.length > 0,
        bookings: tBookings,
      };
    });

    // Email timeline
    type EmailEvent = {
      type: string;
      kind: string | null;
      subject: string | null;
      created_at: string;
    };

    const emails: EmailEvent[] = (emailsRes.data || []).map((e) => {
      const props = (e.properties || {}) as Record<string, unknown>;
      return {
        type: e.type as string,
        kind: (props.email_kind as string) || (props.kind as string) || (props.template as string) || null,
        subject: (props.subject as string) || null,
        created_at: e.created_at as string,
      };
    });

    // Get patient email for Resend link
    const { data: patientData } = await supabaseServer
      .from('people')
      .select('email')
      .eq('id', patientId)
      .single();

    const resendLink = patientData?.email
      ? `https://resend.com/emails?search=${encodeURIComponent(patientData.email as string)}`
      : null;

    return success({ therapists, emails, resend_link: resendLink });
  } catch (e) {
    await logError('admin.api.interactions.detail', e, { stage: 'exception' });
    return fail('Unexpected error', 500);
  }
}
