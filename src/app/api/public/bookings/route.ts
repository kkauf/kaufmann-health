import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getClientSession } from '@/lib/auth/clientSession';
import { ServerAnalytics } from '@/lib/server-analytics';

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
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
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
      .select('day_of_week, time_local, format, active')
      .eq('therapist_id', therapist_id)
      .eq('active', true)
      .eq('day_of_week', dow);

    const hasValidSlot = Array.isArray(slots)
      && slots.some((s: any) => String(s.time_local || '').slice(0, 5) === time_label && (s.format === format));
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

    return NextResponse.json({ data: { booking_id: inserted.id }, error: null });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
