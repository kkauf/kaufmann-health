/**
 * POST /api/public/verification/verify-code
 * Verify SMS code or email token
 * EARTH-191: SMS verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySmsCode } from '@/lib/verification/sms';
import { ServerAnalytics } from '@/lib/server-analytics';
import { supabaseServer } from '@/lib/supabase-server';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { logError } from '@/lib/logger';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';

interface VerifyCodeRequest {
  contact: string; // email or phone
  contact_type: 'email' | 'phone';
  code: string; // 6-digit SMS code or email token
}

export async function POST(req: NextRequest) {
  try {
    const limiter = getFixedWindowLimiter('verification-verify-code', 10, 60_000);
    const { allowed, retryAfterSec } = limiter.check(extractIpFromHeaders(req.headers));
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const body = (await req.json()) as VerifyCodeRequest;
    const { contact, contact_type, code } = body;

    if (!contact || !contact_type || !code) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (contact_type === 'phone') {
      // Verify SMS code via Twilio
      const result = await verifySmsCode(contact, code);

      if (!result.success) {
        const classification = result.classification || 'unexpected';
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'verification_code_failed',
          source: 'api.verification.verify-code',
          props: {
            contact_type: 'phone',
            reason: result.error,
            classification,
            twilio_status: result.twilio_status,
            twilio_code: result.twilio_code,
          },
        });

        // Auth/config errors should surface as 500 for observability
        if (classification === 'auth' || classification === 'config') {
          return NextResponse.json(
            { error: 'Verifizierungsdienst vorübergehend nicht verfügbar' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: result.error || 'Falscher Code' },
          { status: 400 }
        );
      }

      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'verification_code_verified',
        source: 'api.verification.verify-code',
        props: { contact_type: 'phone' },
      });

      // Persist phone_verified flag to person record and fire conversion (EARTH-204)
      let sessionCookie: string | null = null;
      let effectivePersonId: string | null = null;
      try {
        type PersonRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
        const { data: person, error: fetchErr } = await supabaseServer
          .from('people')
          .select('id,name,email,metadata')
          .eq('phone_number', contact)
          .eq('type', 'patient')
          .single<PersonRow>();

        if (!fetchErr && person) {
          effectivePersonId = person.id;
          // Extract draft_contact reference (do NOT remove yet; clear after success)
          const draftContact = person.metadata?.draft_contact as Record<string, unknown> | undefined;
          // Extract draft_booking reference (do NOT remove yet; clear after success)
          const draftBooking = person.metadata?.draft_booking as Record<string, unknown> | undefined;

          // Update metadata with phone_verified flag and mark actionable (keep draft until processed)
          const metadata: Record<string, unknown> = { ...(person.metadata || {}), phone_verified: true };

          await supabaseServer
            .from('people')
            // Mark as 'new' so phone users proceed without email confirmation
            .update({ metadata, status: 'new' })
            .eq('id', person.id);

          // Process draft contact if present
          if (draftContact) {
            try {
              const therapistId = typeof draftContact.therapist_id === 'string' ? draftContact.therapist_id : null;
              const contactType = (draftContact.contact_type === 'booking' || draftContact.contact_type === 'consultation') ? draftContact.contact_type : 'booking';
              const patientReason = typeof draftContact.patient_reason === 'string' ? draftContact.patient_reason : '';
              const patientMessage = typeof draftContact.patient_message === 'string' ? draftContact.patient_message : '';
              const sessionFormat = (draftContact.session_format === 'online' || draftContact.session_format === 'in_person') ? draftContact.session_format : undefined;

              if (therapistId && (patientReason || patientMessage)) {
                const origin = new URL(req.url).origin;
                const idempotencyKey = `${person.id}:${therapistId}:${contactType}`;
                const contactPayload = {
                  therapist_id: therapistId,
                  contact_type: contactType,
                  patient_name: person.name || '',
                  patient_phone: contact,
                  contact_method: 'phone' as const,
                  patient_reason: patientReason,
                  patient_message: patientMessage,
                  session_format: sessionFormat,
                  idempotency_key: idempotencyKey,
                };

                const contactRes = await fetch(`${origin}/api/public/contact`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-forwarded-for': req.headers.get('x-forwarded-for') || '',
                    'user-agent': req.headers.get('user-agent') || '',
                  },
                  body: JSON.stringify(contactPayload),
                });

                if (!contactRes.ok) {
                  await logError('api.verification.verify-code', new Error('Draft contact creation failed'), {
                    stage: 'draft_contact',
                    status: contactRes.status,
                    therapistId,
                  });
                  try {
                    await ServerAnalytics.trackEventFromRequest(req, {
                      type: 'draft_contact_failed',
                      source: 'api.verification.verify-code',
                      props: { therapist_id: therapistId, contact_type: contactType, status: contactRes.status },
                    });
                  } catch {}
                } else {
                  // Clear draft_contact only after success
                  try {
                    const clearedMeta: Record<string, unknown> = { ...(metadata || {}) };
                    delete clearedMeta['draft_contact'];
                    await supabaseServer
                      .from('people')
                      .update({ metadata: clearedMeta })
                      .eq('id', person.id);
                  } catch {}
                  try {
                    await ServerAnalytics.trackEventFromRequest(req, {
                      type: 'draft_contact_processed',
                      source: 'api.verification.verify-code',
                      props: { therapist_id: therapistId, contact_type: contactType },
                    });
                  } catch {}
                }

          // Process draft booking if present
          if (draftBooking) {
            try {
              const therapistId = typeof draftBooking.therapist_id === 'string' ? draftBooking.therapist_id : null;
              const dateIso = typeof draftBooking.date_iso === 'string' ? draftBooking.date_iso : '';
              const timeLabel = typeof draftBooking.time_label === 'string' ? draftBooking.time_label : '';
              const fmt = draftBooking.format === 'in_person' ? 'in_person' : (draftBooking.format === 'online' ? 'online' : null);

              if (therapistId && dateIso && timeLabel && fmt) {
                const { data: existing } = await supabaseServer
                  .from('bookings')
                  .select('id')
                  .eq('therapist_id', therapistId)
                  .eq('date_iso', dateIso)
                  .eq('time_label', timeLabel)
                  .maybeSingle();
                if (!existing) {
                  const { error: bookErr } = await supabaseServer
                    .from('bookings')
                    .insert({ therapist_id: therapistId, patient_id: person.id, date_iso: dateIso, time_label: timeLabel, format: fmt });
                  if (bookErr) {
                    await logError('api.verification.verify-code', bookErr, { stage: 'draft_booking_insert', therapistId, dateIso, timeLabel });
                  } else {
                    try {
                      await ServerAnalytics.trackEventFromRequest(req, {
                        type: 'booking_created',
                        source: 'api.verification.verify-code',
                        props: { therapist_id: therapistId, date_iso: dateIso, time_label: timeLabel, format: fmt },
                      });
                    } catch {}
                  }
                }
                // Clear draft_booking regardless (processed or duplicate)
                try {
                  const clearedMeta: Record<string, unknown> = { ...(person.metadata || {}) };
                  delete clearedMeta['draft_booking'];
                  await supabaseServer
                    .from('people')
                    .update({ metadata: clearedMeta })
                    .eq('id', person.id);
                } catch {}
              }
            } catch (err) {
              await logError('api.verification.verify-code', err, { stage: 'draft_booking_processing' });
            }
          }
              }
            } catch (err) {
              await logError('api.verification.verify-code', err, { stage: 'draft_contact_processing' });
            }
          }

          // Fire Google Ads conversion
          const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
          const ua = req.headers.get('user-agent') || undefined;
          await maybeFirePatientConversion({
            patient_id: person.id,
            email: person.email || undefined,
            phone_number: contact,
            verification_method: 'sms',
            ip,
            ua,
          });

          // Create session cookie (EARTH-204)
          try {
            const token = await createClientSessionToken({
              patient_id: person.id,
              contact_method: 'phone',
              contact_value: contact,
              name: person.name || undefined,
            });
            sessionCookie = createClientSessionCookie(token);
          } catch (cookieErr) {
            await logError('api.verification.verify-code', cookieErr, { stage: 'create_session_cookie' });
          }
        } else {
          const { data: inserted, error: insErr } = await supabaseServer
            .from('people')
            .insert({
              type: 'patient',
              phone_number: contact,
              status: 'new',
              metadata: { phone_verified: true, contact_method: 'phone' },
            })
            .select('id,name,email')
            .single<PersonRow>();

          if (!insErr && inserted) {
            effectivePersonId = inserted.id;
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
            const ua = req.headers.get('user-agent') || undefined;
            await maybeFirePatientConversion({
              patient_id: inserted.id,
              email: inserted.email || undefined,
              phone_number: contact,
              verification_method: 'sms',
              ip,
              ua,
            });
            try {
              const token = await createClientSessionToken({
                patient_id: inserted.id,
                contact_method: 'phone',
                contact_value: contact,
                name: inserted.name || undefined,
              });
              sessionCookie = createClientSessionCookie(token);
            } catch (cookieErr) {
              await logError('api.verification.verify-code', cookieErr, { stage: 'create_session_cookie' });
            }
          }
        }
      } catch (err) {
        // Log but don't fail the verification response
        await logError('api.verification.verify-code', err, { stage: 'persist_phone_verified' });
      }

      // Track verification completion for directory analytics parity
      try {
        await ServerAnalytics.trackEventFromRequest(req, {
          type: 'contact_verification_completed',
          source: 'api.verification.verify-code',
          props: { contact_method: 'phone' },
        });
      } catch {}

      const respData: Record<string, unknown> = { verified: true, method: 'sms' };
      if (process.env.NODE_ENV !== 'production' && effectivePersonId) {
        respData.person_id = effectivePersonId;
      }
      const response = NextResponse.json({
        data: respData,
        error: null,
      });
      
      if (sessionCookie) {
        response.headers.set('Set-Cookie', sessionCookie);
      }

      return response;
    } else {
      // Email token verification handled by /api/public/leads/confirm
      // This endpoint just validates the token format
      if (code.length < 32) {
        return NextResponse.json(
          { error: 'Ungültiger Token' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        data: { verified: true, method: 'email' },
        error: null,
      });
    }
  } catch (error) {
    console.error('[api.verification.verify-code] Error:', error);

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'verification_code_failed',
      source: 'api.verification.verify-code',
      props: { error: error instanceof Error ? error.message : 'unknown' },
    });

    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
