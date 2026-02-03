/**
 * POST /api/public/patient/update-contact
 *
 * Adds missing contact info for a verified patient:
 * - Phone-only users can add their email (triggers booking confirmation re-send)
 * - Email users can add their phone number (for SMS reminders)
 *
 * Requires verified kh_client session cookie.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import { getClientSession } from '@/lib/auth/clientSession';
import { sendEmail } from '@/lib/email/client';
import { renderCalBookingClientConfirmation } from '@/lib/email/templates/calBookingClientConfirmation';
import { logError, track } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/verification/phone';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestBody = z.object({
  email: z.string().email().optional(),
  phone_number: z.string().min(5).optional(),
  /** If adding email after a booking, pass the booking UID to re-send confirmation */
  booking_uid: z.string().optional(),
}).refine(data => data.email || data.phone_number, {
  message: 'Either email or phone_number is required',
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    const session = await getClientSession(req);
    if (!session?.patient_id) {
      return NextResponse.json({ data: null, error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RequestBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message || 'Ungültige Daten' }, { status: 400 });
    }

    const { email, phone_number, booking_uid } = parsed.data;
    const patientId = session.patient_id;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (email) updates.email = email.toLowerCase().trim();
    if (phone_number) {
      const normalized = normalizePhoneNumber(phone_number);
      if (!normalized) {
        return NextResponse.json({ data: null, error: 'Ungültige Telefonnummer' }, { status: 400 });
      }
      updates.phone_number = normalized;
    }

    // Update people record
    const { error: updateError } = await supabaseServer
      .from('people')
      .update(updates)
      .eq('id', patientId);

    if (updateError) {
      // Unique constraint violation — phone or email already taken
      if (updateError.code === '23505') {
        const field = updateError.message?.includes('phone') ? 'Telefonnummer' : 'E-Mail-Adresse';
        return NextResponse.json({ data: null, error: `Diese ${field} ist bereits registriert` }, { status: 409 });
      }
      await logError('public.api.patient.update-contact', updateError, { stage: 'update', patientId }, ip, ua);
      return NextResponse.json({ data: null, error: 'Aktualisierung fehlgeschlagen' }, { status: 500 });
    }

    // If email was added and there's a recent booking, send the confirmation email
    let confirmationSent = false;
    if (email && booking_uid) {
      try {
        const { data: booking } = await supabaseServer
          .from('cal_bookings')
          .select('id, patient_id, therapist_id, start_time, status, booking_kind, metadata')
          .eq('patient_id', patientId)
          .eq('cal_uid', booking_uid)
          .single();

        if (booking && booking.status !== 'CANCELLED') {
          // Get therapist info for the confirmation email
          const { data: therapist } = await supabaseServer
            .from('therapists')
            .select('first_name, last_name, email, typical_rate, metadata')
            .eq('id', booking.therapist_id)
            .single();

          if (therapist) {
            const startDate = new Date(booking.start_time);
            // Format in Europe/Berlin timezone (matches webhook pattern)
            const dateIso = startDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
            const timeLabel = startDate.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
            const isIntro = booking.booking_kind === 'intro';
            const bookingMeta = (booking.metadata || {}) as Record<string, unknown>;
            const videoUrl = (bookingMeta.videoCallUrl as string) || undefined;

            const { data: patient } = await supabaseServer
              .from('people')
              .select('name')
              .eq('id', patientId)
              .single();

            const content = renderCalBookingClientConfirmation({
              patientName: patient?.name,
              patientEmail: email,
              therapistName: `${therapist.first_name} ${therapist.last_name}`,
              therapistEmail: therapist.email,
              dateIso,
              timeLabel,
              isIntro,
              sessionPrice: therapist.typical_rate,
              bookingUid: booking_uid,
              videoUrl,
              locationType: 'video', // Nearly all bookings are video; in-person not stored in metadata
            });

            const result = await sendEmail({
              to: email,
              subject: content.subject,
              html: content.html,
              context: {
                kind: 'booking_confirmation_resend',
                patient_id: patientId,
                booking_uid,
              },
            });

            confirmationSent = result.sent;
          }
        }
      } catch (e) {
        // Non-fatal: contact info was saved, confirmation email is best-effort
        await logError('public.api.patient.update-contact', e, { stage: 'send_confirmation', patientId, booking_uid }, ip, ua);
      }
    }

    void track({
      type: 'patient_contact_updated',
      level: 'info',
      source: 'public.api.patient.update-contact',
      ip,
      props: {
        patient_id: patientId,
        added_email: !!email,
        added_phone: !!phone_number,
        confirmation_sent: confirmationSent,
      },
    });

    return NextResponse.json({
      data: { updated: true, confirmation_sent: confirmationSent },
      error: null,
    });
  } catch (e) {
    await logError('public.api.patient.update-contact', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Interner Fehler' }, { status: 500 });
  }
}
