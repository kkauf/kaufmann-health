import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getClientSession } from '@/lib/auth/clientSession';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { renderBookingTherapistNotification } from '@/lib/email/templates/bookingTherapistNotification';
import { renderBookingClientConfirmation } from '@/lib/email/templates/bookingClientConfirmation';

export const dynamic = 'force-dynamic';

type BookRequest = {
  therapist_id: string;
  date_iso: string;
  time_label: string; // HH:MM
  format: 'online' | 'in_person';
  session_id?: string;
};

function isValidDateIso(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function isValidTimeLabel(s: string): boolean {
  return /^[0-2][0-9]:[0-5][0-9]$/.test(s);
}

function getBerlinDayIndex(d: Date): number {
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' });
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const name = weekdayFmt.format(d);
  return weekdayIndex[name as keyof typeof weekdayIndex] ?? d.getUTCDay();
}

export async function POST(req: NextRequest) {
  const _ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  // Test sink: when kh_test=1 cookie is set, reroute emails to LEADS_NOTIFY_EMAIL
  const isKhTest = (() => {
    try {
      const cookie = req.headers.get('cookie') || '';
      return cookie.split(';').some((p) => {
        const [k, v] = p.trim().split('=');
        return k === 'kh_test' && v === '1';
      });
    } catch {
      return false;
    }
  })();
  const sinkEmail = (process.env.LEADS_NOTIFY_EMAIL || '').trim();
  try {
    const body = (await req.json()) as BookRequest;
    const { therapist_id, date_iso, time_label, format, session_id } = body;

    if (!therapist_id || !date_iso || !time_label || !format) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!isValidDateIso(String(date_iso))) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    if (!isValidTimeLabel(String(time_label))) {
      return NextResponse.json({ error: 'Invalid time' }, { status: 400 });
    }
    if (format !== 'online' && format !== 'in_person') {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    const session = await getClientSession(req);
    if (!session?.patient_id) {
      return NextResponse.json({ error: 'NOT_VERIFIED' }, { status: 401 });
    }

    // Upgrade anonymous patients to 'new' status when they complete their first booking
    try {
      const { data: patient } = await supabaseServer
        .from('people')
        .select('id, status')
        .eq('id', session.patient_id)
        .single<{ id: string; status: string }>();
      
      if (patient?.status === 'anonymous') {
        await supabaseServer
          .from('people')
          .update({ status: 'new' })
          .eq('id', patient.id);
        
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'anonymous_patient_upgraded',
          source: 'api.public.bookings',
          props: { patient_id: patient.id },
        });
      }
    } catch (err) {
      console.error('Failed to upgrade anonymous patient:', err);
      // Don't block booking if status upgrade fails
    }

    const { data: therapist } = await supabaseServer
      .from('therapists')
      .select('id')
      .eq('id', therapist_id)
      .eq('status', 'verified')
      .maybeSingle();
    if (!therapist) {
      return NextResponse.json({ error: 'Therapist not found' }, { status: 404 });
    }

    const d = new Date(`${date_iso}T00:00:00Z`);
    const dow = getBerlinDayIndex(d);

    const { data: slots } = await supabaseServer
      .from('therapist_slots')
      .select('day_of_week, time_local, format, active, address, is_recurring, specific_date, end_date')
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .or(`day_of_week.eq.${dow},is_recurring.eq.false`);

    const hasValidSlot = Array.isArray(slots) && (slots as {
      time_local: string | null;
      format: 'online' | 'in_person' | 'both' | string;
      day_of_week: number | null;
      is_recurring?: boolean | null;
      specific_date?: string | null;
      end_date?: string | null;
    }[]).some((s) => {
      const timeOk = String(s.time_local || '').slice(0, 5) === time_label;
      const fmtOk = s.format === format || s.format === 'both';
      if (!timeOk || !fmtOk) return false;
      const recurring = s.is_recurring !== false; // treat undefined as recurring
      if (!recurring) {
        // one-time slot must match exact date
        const sd = String(s.specific_date || '').trim();
        return sd === date_iso;
      }
      // recurring: must match day_of_week and not exceed optional end_date
      const dowOk = Number(s.day_of_week) === dow;
      if (!dowOk) return false;
      const end = String(s.end_date || '').trim();
      if (end && date_iso > end) return false;
      return true;
    });
    if (!hasValidSlot) {
      return NextResponse.json({ error: 'Slot not available' }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from('bookings')
      .select('id')
      .eq('therapist_id', therapist_id)
      .eq('date_iso', date_iso)
      .eq('time_label', time_label)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'SLOT_TAKEN' }, { status: 409 });
    }

    // kh_test dry-run: validate but do not consume the slot; route emails to sink only
    if (isKhTest) {
      try {
        await ServerAnalytics.trackEventFromRequest(req, {
          type: 'booking_dry_run',
          source: 'api.public.bookings',
          session_id: session_id,
          props: { therapist_id, date_iso, time_label, format },
        });
      } catch {}

      try {
        // Resolve therapist recipient
        const { data: t } = await supabaseServer
          .from('therapists')
          .select('email, first_name, last_name')
          .eq('id', therapist_id)
          .maybeSingle();
        // Resolve patient info
        const { data: p } = await supabaseServer
          .from('people')
          .select('name, email')
          .eq('id', session.patient_id)
          .maybeSingle();
        type PatientEmailRow = { name?: string | null; email?: string | null } | null;
        const pRow = (p as unknown) as PatientEmailRow;
        // Determine address (if in_person) from matching slot
        const addr = (() => {
          if (format !== 'in_person' || !Array.isArray(slots)) return '';
          const match = (slots as { time_local: string | null; format: string; address?: string | null }[])
            .find((s) => String(s.time_local || '').slice(0, 5) === time_label && s.format === 'in_person');
          return (match?.address || '').trim();
        })();

        // Only send emails if sink is configured to avoid accidental real sends in dry-run
        if (sinkEmail) {
          type TherapistEmailRow = { email?: string | null; first_name?: string | null; last_name?: string | null } | null;
          const tRow = (t as unknown) as TherapistEmailRow;
          const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].filter(Boolean).join(' ');
          const content = renderBookingTherapistNotification({
            therapistName,
            patientName: pRow?.name || null,
            patientEmail: pRow?.email || null,
            dateIso: date_iso,
            timeLabel: time_label,
            format,
            address: addr || null,
          });
          void sendEmail({
            to: sinkEmail,
            subject: content.subject,
            html: content.html,
            context: { kind: 'booking_therapist_notification', therapist_id, patient_id: session.patient_id, dry_run: true },
          }).catch(() => {});

          const clientEmail = (pRow?.email || undefined) as string | undefined;
          if (clientEmail) {
            const content2 = renderBookingClientConfirmation({
              therapistName,
              dateIso: date_iso,
              timeLabel: time_label,
              format,
              address: addr || null,
            });
            void sendEmail({
              to: sinkEmail,
              subject: content2.subject,
              html: content2.html,
              context: { kind: 'booking_client_confirmation', therapist_id, patient_id: session.patient_id, dry_run: true },
            }).catch(() => {});
          }
        }
      } catch {}

      return NextResponse.json({ data: { dry_run: true }, error: null });
    }

    const { data: inserted, error: insErr } = await supabaseServer
      .from('bookings')
      .insert({
        therapist_id,
        patient_id: session.patient_id,
        date_iso,
        time_label,
        format,
      })
      .select('id')
      .single();

    if (insErr || !inserted?.id) {
      return NextResponse.json({ error: 'Failed to book' }, { status: 500 });
    }

    try {
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'booking_created',
        source: 'api.public.bookings',
        session_id: session_id,
        props: { therapist_id, date_iso, time_label, format },
      });
    } catch {}

    // Fire-and-forget emails (therapist notification + client confirmation)
    try {
      // Resolve therapist recipient
      const { data: t } = await supabaseServer
        .from('therapists')
        .select('email, first_name, last_name, metadata')
        .eq('id', therapist_id)
        .maybeSingle();
      // Resolve patient info
      const { data: p } = await supabaseServer
        .from('people')
        .select('name, email, phone_number')
        .eq('id', session.patient_id)
        .maybeSingle();
      type PatientEmailRow = { name?: string | null; email?: string | null; phone_number?: string | null } | null;
      const pRow = (p as unknown) as PatientEmailRow;
      // Determine address (if in_person) from matching slot
      const addr = (() => {
        if (format !== 'in_person' || !Array.isArray(slots)) return '';
        const match = (slots as { time_local: string | null; format: string; address?: string | null }[])
          .find((s) => String(s.time_local || '').slice(0, 5) === time_label && (s.format === 'in_person' || s.format === 'both'));
        return (match?.address || '').trim();
      })();

      // Therapist email
      type TherapistEmailRow = { email?: string | null; first_name?: string | null; last_name?: string | null; metadata?: unknown } | null;
      const tRow = (t as unknown) as TherapistEmailRow;
      const therapistEmail = (tRow?.email || undefined) as string | undefined;
      const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].filter(Boolean).join(' ');
      let secureUuid: string | null = null;
      try {
        const { data: br } = await supabaseServer
          .from('bookings')
          .select('secure_uuid')
          .eq('id', inserted.id)
          .maybeSingle();
        secureUuid = ((br as unknown) as { secure_uuid?: string | null } | null)?.secure_uuid || null;
      } catch {}

      // Fire Google Ads Enhanced Conversion on booking completion (idempotent)
      try {
        const ipAddr = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
        const ua = req.headers.get('user-agent') || undefined;
        const method = (session.contact_method === 'phone' ? 'sms' : 'email') as 'email' | 'sms';
        await maybeFirePatientConversion({
          patient_id: session.patient_id,
          email: pRow?.email || undefined,
          phone_number: pRow?.phone_number || (session.contact_method === 'phone' ? session.contact_value : undefined),
          verification_method: method,
          ip: ipAddr,
          ua,
        });
      } catch {}
      const base = process.env.NEXT_PUBLIC_BASE_URL || '';
      const magicUrl = secureUuid ? `${base}${base.startsWith('http') ? '' : ''}/booking/${secureUuid}` : undefined;
      const practiceAddr = (() => {
        try {
          const md = (tRow as unknown as { metadata?: Record<string, unknown> })?.metadata || {};
          const prof = md['profile'] as Record<string, unknown> | undefined;
          const pa = typeof prof?.['practice_address'] === 'string' ? (prof['practice_address'] as string) : '';
          return pa.trim();
        } catch {
          return '';
        }
      })();
      if ((isKhTest && sinkEmail) || (!isKhTest && therapistEmail)) {
        const toAddr = (isKhTest ? sinkEmail : therapistEmail) as string;
        const content = renderBookingTherapistNotification({
          therapistName,
          dateIso: date_iso,
          timeLabel: time_label,
          format,
          address: (addr || practiceAddr) || null,
          magicUrl: magicUrl || null,
        });
        void sendEmail({
          to: toAddr,
          subject: content.subject,
          html: content.html,
          context: { kind: 'booking_therapist_notification', therapist_id, patient_id: session.patient_id },
        }).catch(() => {});
      }

      // Client email (only if we have an email)
      const clientEmail = (pRow?.email || undefined) as string | undefined;
      if ((isKhTest && sinkEmail) || (!isKhTest && clientEmail)) {
        const toAddr = (isKhTest ? sinkEmail : clientEmail) as string;
        const content2 = renderBookingClientConfirmation({
          therapistName,
          dateIso: date_iso,
          timeLabel: time_label,
          format,
          address: (addr || practiceAddr) || null,
        });
        void sendEmail({
          to: toAddr,
          subject: content2.subject,
          html: content2.html,
          context: { kind: 'booking_client_confirmation', therapist_id, patient_id: session.patient_id },
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({ data: { booking_id: inserted.id }, error: null });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
