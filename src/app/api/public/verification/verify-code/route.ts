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
import { sendEmail } from '@/lib/email/client';
import { renderBookingTherapistNotification } from '@/lib/email/templates/bookingTherapistNotification';
import { renderBookingClientConfirmation } from '@/lib/email/templates/bookingClientConfirmation';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';
import { createInstantMatchesForPatient } from '@/features/leads/lib/match';
import { processDraftContact, clearDraftContact } from '@/features/leads/lib/processDraftContact';
import { parseRequestBody } from '@/lib/api-utils';
import { VerifyCodeInput } from '@/contracts/verification';

interface VerifyCodeRequest {
  contact: string; // email or phone
  contact_type: 'email' | 'phone';
  code: string; // 6-digit SMS code or email token
}

function mapVerifyCodeContractError(message: string): string {
  if (message.startsWith('contact') || message.startsWith('contact_type') || message.startsWith('code')) {
    return 'Missing required fields';
  }
  return 'Missing required fields';
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

    const parsed = await parseRequestBody(req, VerifyCodeInput);
    if (!parsed.success) {
      const json = await parsed.response
        .json()
        .catch(() => ({} as Record<string, unknown>));
      const msg = typeof json?.error === 'string' ? json.error : 'Missing required fields';

      // Preserve legacy behavior: invalid JSON hit catch-all and returned 500
      if (msg === 'Ungültiger Request Body') {
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
      }

      return NextResponse.json({ error: mapVerifyCodeContractError(msg) }, { status: 400 });
    }

    const body = parsed.data as unknown as VerifyCodeRequest;
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
        type PersonRow = { id: string; name?: string | null; email?: string | null; campaign_variant?: string | null; metadata?: Record<string, unknown> | null };
        const { data: person, error: fetchErr } = await supabaseServer
          .from('people')
          .select('id,name,email,campaign_variant,metadata')
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

          // Merge form session data if available (returning users with new preferences)
          const fsid = typeof metadata['form_session_id'] === 'string' ? (metadata['form_session_id'] as string) : undefined;
          if (fsid) {
            try {
              const { data: fs } = await supabaseServer
                .from('form_sessions')
                .select('data')
                .eq('id', fsid)
                .single<{ data: Record<string, unknown> }>();
              if (fs?.data) {
                const d = fs.data;
                const maybeString = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : undefined);
                const maybeArray = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]) : undefined);
                // Merge preferences from form session
                const cityVal = maybeString('city');
                if (cityVal) metadata.city = cityVal;
                const sessionPref = maybeString('session_preference');
                if (sessionPref) {
                  const s = sessionPref.toLowerCase();
                  if (s === 'online' || s.startsWith('online')) metadata.session_preference = 'online';
                  else if (s === 'in_person' || s.includes('vor ort')) metadata.session_preference = 'in_person';
                  else if (s.startsWith('beides') || s.includes('beides ist okay')) {
                    metadata.session_preferences = ['online', 'in_person'];
                    delete metadata['session_preference'];
                  }
                }
                const spArray = maybeArray('session_preferences');
                if (Array.isArray(spArray)) metadata.session_preferences = spArray;
                const gender = maybeString('gender');
                if (gender) {
                  const g = gender.toLowerCase();
                  if (g.includes('mann')) metadata.gender_preference = 'male';
                  else if (g.includes('frau')) metadata.gender_preference = 'female';
                  else if (g.includes('keine')) metadata.gender_preference = 'no_preference';
                }
                const methods = maybeArray('methods');
                if (methods) metadata.specializations = methods;
                const schwerpunkte = maybeArray('schwerpunkte');
                if (schwerpunkte) metadata.schwerpunkte = schwerpunkte;
                const time_slots = maybeArray('time_slots');
                if (time_slots) metadata.time_slots = time_slots;
                void ServerAnalytics.trackEventFromRequest(req, {
                  type: 'form_session_merged',
                  source: 'api.verification.verify-code',
                  props: { form_session_id: fsid, patient_id: person.id },
                });
              }
            } catch { /* non-blocking */ }
          }

          await supabaseServer
            .from('people')
            // Mark as 'new' so phone users proceed without email confirmation
            .update({ metadata, status: 'new' })
            .eq('id', person.id);

          // Create instant matches for phone-verified users (uses merged metadata)
          const variant = person.campaign_variant || undefined;
          try {
            const matchResult = await createInstantMatchesForPatient(person.id, variant);
            if (matchResult) {
              // Store matchesUrl in metadata for redirect after verification
              const updatedMeta = { ...metadata, last_confirm_redirect_path: matchResult.matchesUrl };
              await supabaseServer
                .from('people')
                .update({ metadata: updatedMeta })
                .eq('id', person.id);
              void ServerAnalytics.trackEventFromRequest(req, {
                type: 'instant_match_created',
                source: 'api.verification.verify-code',
                props: { match_quality: matchResult.matchQuality, patient_id: person.id },
              });
            }
          } catch { /* non-blocking */ }

          // Process draft contact if present
          if (draftContact) {
            try {
              const therapistId = typeof draftContact.therapist_id === 'string' ? draftContact.therapist_id : null;
              const contactType = (draftContact.contact_type === 'booking' || draftContact.contact_type === 'consultation') ? draftContact.contact_type : 'consultation';
              const patientReason = typeof draftContact.patient_reason === 'string' ? draftContact.patient_reason : '';
              const patientMessage = typeof draftContact.patient_message === 'string' ? draftContact.patient_message : '';
              const sessionFormat = (draftContact.session_format === 'online' || draftContact.session_format === 'in_person') ? draftContact.session_format : undefined;
              const isTestDraft = draftContact.is_test === true;

              if (therapistId && (patientReason || patientMessage)) {
                const result = await processDraftContact({
                  patientId: person.id,
                  patientName: person.name || '',
                  patientPhone: contact,
                  contactMethod: 'phone',
                  draftContact: {
                    therapist_id: therapistId,
                    contact_type: contactType,
                    patient_reason: patientReason,
                    patient_message: patientMessage,
                    session_format: sessionFormat,
                  },
                  isTest: isTestDraft,
                });

                if (result.success) {
                  await clearDraftContact(person.id);
                  try {
                    await ServerAnalytics.trackEventFromRequest(req, {
                      type: 'draft_contact_processed',
                      source: 'api.verification.verify-code',
                      props: { therapist_id: therapistId, contact_type: contactType, match_id: result.matchId },
                    });
                  } catch {}
                } else {
                  await logError('api.verification.verify-code', new Error(result.error || 'Draft contact processing failed'), {
                    stage: 'draft_contact',
                    therapistId,
                  });
                  try {
                    await ServerAnalytics.trackEventFromRequest(req, {
                      type: 'draft_contact_failed',
                      source: 'api.verification.verify-code',
                      props: { therapist_id: therapistId, contact_type: contactType, error: result.error },
                    });
                  } catch {}
                }
              }
            } catch (err) {
              await logError('api.verification.verify-code', err, { stage: 'draft_contact_processing' });
            }
          }

          // Process draft booking if present
          if (draftBooking) {
            try {
              const therapistId = typeof draftBooking.therapist_id === 'string' ? draftBooking.therapist_id : null;
              const dateIso = typeof draftBooking.date_iso === 'string' ? draftBooking.date_iso : '';
              const timeLabel = typeof draftBooking.time_label === 'string' ? draftBooking.time_label : '';
              const fmt = draftBooking.format === 'in_person' ? 'in_person' : (draftBooking.format === 'online' ? 'online' : null);

              if (therapistId && dateIso && timeLabel && fmt) {
                // Determine kh_test and sink email once for draft_booking
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
                // Validate therapist is verified and weekly slot is designated for the given weekday/time/format (Berlin TZ)
                // Therapist verified
                const { data: therapist } = await supabaseServer
                  .from('therapists')
                  .select('id')
                  .eq('id', therapistId)
                  .eq('status', 'verified')
                  .maybeSingle();
                // Weekly slot check
                let hasValidSlot = false;
                if (therapist) {
                  try {
                    const d = new Date(`${dateIso}T00:00:00Z`);
                    const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' });
                    const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
                    const dow = weekdayIndex[weekdayFmt.format(d) as keyof typeof weekdayIndex] ?? d.getUTCDay();
                    const { data: slots } = await supabaseServer
                      .from('therapist_slots')
                      .select('day_of_week, time_local, format, active')
                      .eq('therapist_id', therapistId)
                      .eq('active', true)
                      .eq('day_of_week', dow);
                    hasValidSlot = Array.isArray(slots)
                      && (slots as { time_local: string | null; format: 'online' | 'in_person' | string }[])
                        .some((s) => String(s.time_local || '').slice(0, 5) === timeLabel && (s.format === fmt));
                  } catch {}
                }

                if (!therapist || !hasValidSlot) {
                  try {
                    await ServerAnalytics.trackEventFromRequest(req, {
                      type: 'booking_slot_invalid',
                      source: 'api.verification.verify-code',
                      props: { therapist_id: therapistId, date_iso: dateIso, time_label: timeLabel, format: fmt, therapist_verified: Boolean(therapist) },
                    });
                  } catch {}
                } else {
                  const { data: existing } = await supabaseServer
                    .from('bookings')
                    .select('id')
                    .eq('therapist_id', therapistId)
                    .eq('date_iso', dateIso)
                    .eq('time_label', timeLabel)
                    .maybeSingle();
                  if (!existing) {
                  if (isKhTest) {
                    // Dry-run: track, send sink-only emails, do not insert, do not clear draft_booking
                    try {
                      await ServerAnalytics.trackEventFromRequest(req, {
                        type: 'booking_dry_run',
                        source: 'api.verification.verify-code',
                        props: { therapist_id: therapistId, date_iso: dateIso, time_label: timeLabel, format: fmt },
                      });
                    } catch {}
                    try {
                      // Therapist recipient
                      const { data: t } = await supabaseServer
                        .from('therapists')
                        .select('email, first_name, last_name, metadata')
                        .eq('id', therapistId)
                        .maybeSingle();
                      let addr = '';
                      if (fmt === 'in_person') {
                        const { data: slots } = await supabaseServer
                          .from('therapist_slots')
                          .select('time_local, format, address, active')
                          .eq('therapist_id', therapistId)
                          .eq('active', true);
                        if (Array.isArray(slots)) {
                          const m = (slots as { time_local: string | null; format: string; address?: string | null }[])
                            .find((s) => String(s.time_local || '').slice(0, 5) === timeLabel && s.format === 'in_person');
                          addr = (m?.address || '').trim();
                        }
                      }
                      type TherapistEmailRow = { email?: string | null; first_name?: string | null; last_name?: string | null; metadata?: unknown } | null;
                      const tRow = (t as unknown) as TherapistEmailRow;
                      const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].filter(Boolean).join(' ');
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
                      if (sinkEmail) {
                        const content = renderBookingTherapistNotification({
                          therapistName,
                          patientName: (person.name || '') || null,
                          patientEmail: (person.email || '') || null,
                          dateIso: dateIso,
                          timeLabel: timeLabel,
                          format: fmt,
                          address: (addr || practiceAddr) || null,
                        });
                        void sendEmail({
                          to: sinkEmail,
                          subject: content.subject,
                          html: content.html,
                          context: { kind: 'booking_therapist_notification', therapist_id: therapistId, patient_id: person.id, dry_run: true },
                        }).catch(() => {});
                        if (person.email) {
                          const content2 = renderBookingClientConfirmation({
                            therapistName,
                            dateIso: dateIso,
                            timeLabel: timeLabel,
                            format: fmt,
                            address: (addr || practiceAddr) || null,
                          });
                          void sendEmail({
                            to: sinkEmail,
                            subject: content2.subject,
                            html: content2.html,
                            context: { kind: 'booking_client_confirmation', therapist_id: therapistId, patient_id: person.id, dry_run: true },
                          }).catch(() => {});
                        }
                      }
                    } catch {}
                  } else {
                    const { data: insertedBooking, error: bookErr } = await supabaseServer
                      .from('bookings')
                      .insert({ therapist_id: therapistId, patient_id: person.id, date_iso: dateIso, time_label: timeLabel, format: fmt })
                      .select('id')
                      .single();
                    if (bookErr || !insertedBooking?.id) {
                      await logError('api.verification.verify-code', bookErr, { stage: 'draft_booking_insert', therapistId, dateIso, timeLabel });
                    } else {
                      try {
                        await ServerAnalytics.trackEventFromRequest(req, {
                          type: 'booking_created',
                          source: 'api.verification.verify-code',
                          props: { therapist_id: therapistId, date_iso: dateIso, time_label: timeLabel, format: fmt },
                        });
                      } catch {}
                      // Fire-and-forget emails
                      try {
                        // Therapist recipient
                        const { data: t } = await supabaseServer
                          .from('therapists')
                          .select('email, first_name, last_name')
                          .eq('id', therapistId)
                          .maybeSingle();
                        let addr = '';
                        if (fmt === 'in_person') {
                          const { data: slots } = await supabaseServer
                            .from('therapist_slots')
                            .select('time_local, format, address, active')
                            .eq('therapist_id', therapistId)
                            .eq('active', true);
                          if (Array.isArray(slots)) {
                            const m = (slots as { time_local: string | null; format: string; address?: string | null }[])
                              .find((s) => String(s.time_local || '').slice(0, 5) === timeLabel && s.format === 'in_person');
                            addr = (m?.address || '').trim();
                          }
                        }
                        type TherapistEmailRow = { email?: string | null; first_name?: string | null; last_name?: string | null } | null;
                        const tRow = (t as unknown) as TherapistEmailRow;
                        const therapistEmail = (tRow?.email || undefined) as string | undefined;
                        const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].filter(Boolean).join(' ');
                        // Build magic link if secure_uuid exists
                        let secureUuid: string | null = null;
                        try {
                          const { data: br } = await supabaseServer
                            .from('bookings')
                            .select('secure_uuid')
                            .eq('id', insertedBooking.id)
                            .maybeSingle();
                          secureUuid = ((br as unknown) as { secure_uuid?: string | null } | null)?.secure_uuid || null;
                        } catch {}
                        const base = process.env.NEXT_PUBLIC_BASE_URL || '';
                        const magicUrl = secureUuid ? `${base}${base.startsWith('http') ? '' : ''}/booking/${secureUuid}` : undefined;

                        if (therapistEmail) {
                          const content = renderBookingTherapistNotification({
                            therapistName,
                            dateIso: dateIso,
                            timeLabel: timeLabel,
                            format: fmt,
                            address: addr || null,
                            magicUrl: magicUrl || null,
                          });
                          void sendEmail({
                            to: therapistEmail,
                            subject: content.subject,
                            html: content.html,
                            context: { kind: 'booking_therapist_notification', therapist_id: therapistId, patient_id: person.id },
                          }).catch(() => {});
                        }
                        if (person.email) {
                          const content2 = renderBookingClientConfirmation({
                            therapistName,
                            dateIso: dateIso,
                            timeLabel: timeLabel,
                            format: fmt,
                            address: addr || null,
                          });
                          void sendEmail({
                            to: person.email,
                            subject: content2.subject,
                            html: content2.html,
                            context: { kind: 'booking_client_confirmation', therapist_id: therapistId, patient_id: person.id },
                          }).catch(() => {});
                        }
                      } catch {}
                    }
                  }
                }
                }
                // Only clear draft_booking when not in dry-run
                if (!isKhTest) {
                  try {
                    const clearedMeta: Record<string, unknown> = { ...(person.metadata || {}) };
                    delete clearedMeta['draft_booking'];
                    await supabaseServer
                      .from('people')
                      .update({ metadata: clearedMeta })
                      .eq('id', person.id);
                  } catch {}
                }
              }
            } catch (err) {
              await logError('api.verification.verify-code', err, { stage: 'draft_booking_processing' });
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
      // Include matches_url for SMS fallback users (read from metadata)
      if (effectivePersonId) {
        try {
          const { data: personMeta } = await supabaseServer
            .from('people')
            .select('metadata')
            .eq('id', effectivePersonId)
            .single();
          const meta = (personMeta?.metadata as Record<string, unknown>) || {};
          const matchesUrl = meta['last_confirm_redirect_path'] as string | undefined;
          if (matchesUrl) {
            respData.matches_url = matchesUrl;
          }
        } catch { /* ignore */ }
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
