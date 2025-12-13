/**
 * POST /api/public/verification/send-code
 * Send verification code via SMS or email based on VERIFICATION_MODE
 * EARTH-191: SMS verification for faster mobile onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendSmsCode } from '@/lib/verification/sms';
import { getVerificationMode } from '@/lib/verification/config';
import { isValidGermanMobile, normalizePhoneNumber } from '@/lib/verification/phone';
import { ServerAnalytics } from '@/lib/server-analytics';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { sendEmail } from '@/lib/email/client';
import { randomBytes } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { track } from '@/lib/logger';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';
import { parseRequestBody } from '@/lib/api-utils';
import { SendCodeInput } from '@/contracts/verification';

interface SendCodeRequest {
  contact: string; // email or phone
  contact_type: 'email' | 'phone';
  lead_id?: string; // Optional: if associated with existing lead
  form_session_id?: string;
  // Optional redirect path for magic link confirmations.
  // Must be a safe, relative path (validated before use).
  redirect?: string;
  // Optional patient name for therapist directory contact flow (used for both email and SMS)
  name?: string;
  // Optional draft contact data to store before verification (therapist directory flow)
  draft_contact?: {
    therapist_id: string;
    contact_type: 'booking' | 'consultation';
    patient_reason: string;
    patient_message: string;
    session_format?: 'online' | 'in_person';
  };
  // Optional draft booking data to store before verification (therapist directory flow)
  draft_booking?: {
    therapist_id: string;
    date_iso: string; // YYYY-MM-DD
    time_label: string; // HH:MM
    format: 'online' | 'in_person';
  };
}

function mapSendCodeContractError(message: string): string {
  if (message.startsWith('contact') || message.startsWith('contact_type')) {
    return 'Missing contact or contact_type';
  }
  return 'Missing contact or contact_type';
}

export async function POST(req: NextRequest) {

  try {
    const limiter = getFixedWindowLimiter('verification-send-code', 5, 60_000);
    const { allowed, retryAfterSec } = limiter.check(extractIpFromHeaders(req.headers));
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const parsed = await parseRequestBody(req, SendCodeInput);
    if (!parsed.success) {
      const json = await parsed.response
        .json()
        .catch(() => ({} as Record<string, unknown>));
      const msg = typeof json?.error === 'string' ? json.error : 'Missing contact or contact_type';

      // Preserve legacy behavior: invalid JSON hit catch-all and returned 500
      if (msg === 'Ungültiger Request Body') {
        return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
      }

      return NextResponse.json({ error: mapSendCodeContractError(msg) }, { status: 400 });
    }

    const body = parsed.data as unknown as SendCodeRequest;
    let isTestCookie = false;
    try {
      const cookieHeader = req.headers.get('cookie') || '';
      if (cookieHeader) {
        const parts = cookieHeader.split(';');
        for (const p of parts) {
          const [k, v] = p.trim().split('=');
          if (k === 'kh_test' && v === '1') { isTestCookie = true; break; }
        }
      }
    } catch {}
    const { contact, contact_type, lead_id, form_session_id, redirect, name, draft_contact, draft_booking } = body;

    if (!contact || !contact_type) {
      return NextResponse.json(
        { error: 'Missing contact or contact_type' },
        { status: 400 }
      );
    }

    const mode = getVerificationMode();

    // Validate contact method is allowed by mode
    if (mode === 'sms' && contact_type === 'email') {
      return NextResponse.json(
        { error: 'Email verification not enabled' },
        { status: 400 }
      );
    }
    if (mode === 'email' && contact_type === 'phone') {
      return NextResponse.json(
        { error: 'SMS verification not enabled' },
        { status: 400 }
      );
    }

    // Send verification based on type
    if (contact_type === 'phone') {
      // Validate phone number (international E.164 format)
      if (!isValidGermanMobile(contact)) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'verification_code_failed',
          source: 'api.verification.send-code',
          props: { reason: 'invalid_phone', contact_type },
        });
        return NextResponse.json(
          { error: 'Bitte gib eine gültige Handynummer ein' },
          { status: 400 }
        );
      }

      // Handle SMS fallback: update existing email lead with phone number
      // This enables email users who can't receive email to switch to SMS verification
      if (lead_id) {
        try {
          const normalized = normalizePhoneNumber(contact) || contact;
          const { data: existingLead, error: leadErr } = await supabaseServer
            .from('people')
            .select('id, name, metadata, status')
            .eq('id', lead_id)
            .eq('type', 'patient')
            .single();

          if (!leadErr && existingLead && existingLead.status === 'pre_confirmation') {
            // Update the lead with phone number for SMS fallback
            const meta = (existingLead.metadata as Record<string, unknown>) || {};
            meta['sms_fallback'] = true;
            meta['sms_fallback_at'] = new Date().toISOString();
            if (isTestCookie) meta['is_test'] = true;
            
            await supabaseServer
              .from('people')
              .update({
                phone_number: normalized,
                metadata: meta,
              })
              .eq('id', lead_id);

            void ServerAnalytics.trackEventFromRequest(req, {
              type: 'sms_fallback_phone_added',
              source: 'api.verification.send-code',
              props: { lead_id },
            });
          }
        } catch (err) {
          void track({
            type: 'sms_fallback_update_failed',
            source: 'api.verification.send-code',
            props: { lead_id, error: err instanceof Error ? err.message : 'unknown' },
          });
        }
      }

      // Create or update person record with name (if provided) before sending SMS
      // This ensures the name is available when the user verifies and creates a session
      if (name && !lead_id) {
        try {
          const normalized = normalizePhoneNumber(contact) || contact;
          // Check if person already exists for this phone number
          const { data: existing } = await supabaseServer
            .from('people')
            .select('id, name, metadata')
            .eq('phone_number', normalized)
            .eq('type', 'patient')
            .single();

          if (existing) {
            // Update name and persist draft_contact/form_session_id if provided
            const updateData: Record<string, unknown> = {};
            const meta = (existing.metadata as Record<string, unknown>) || {};
            if (!existing.name || existing.name !== name) {
              updateData.name = name;
            }
            // Store form_session_id so verify-code can merge preferences
            if (form_session_id) {
              meta['form_session_id'] = form_session_id;
              updateData.metadata = meta;
            }
            if (draft_contact) {
              meta['draft_contact'] = draft_contact;
              updateData.metadata = meta;
              try {
                await ServerAnalytics.trackEventFromRequest(req, {
                  type: 'draft_contact_stored',
                  source: 'api.verification.send-code',
                  props: { via: 'phone', therapist_id: draft_contact.therapist_id, contact_type: draft_contact.contact_type },
                });
              } catch {}
            }
            if (draft_booking) {
              meta['draft_booking'] = draft_booking;
              if (isTestCookie) meta['is_test'] = true;
              updateData.metadata = meta;
              try {
                await ServerAnalytics.trackEventFromRequest(req, {
                  type: 'draft_booking_stored',
                  source: 'api.verification.send-code',
                  props: { via: 'phone', therapist_id: draft_booking.therapist_id },
                });
              } catch {}
            }
            if (isTestCookie) {
              meta['is_test'] = true;
              updateData.metadata = meta;
            }
            if (Object.keys(updateData).length > 0) {
              await supabaseServer
                .from('people')
                .update(updateData)
                .eq('id', existing.id);
            }
          } else {
            // Create new person record with phone and name
            const metadata: Record<string, unknown> = {
              contact_method: 'phone',
              source: 'directory_contact',
              ...(form_session_id ? { form_session_id } : {}),
              ...(isTestCookie ? { is_test: true } : {}),
            };
            // Store draft contact data if provided (therapist directory flow)
            if (draft_contact) {
              metadata.draft_contact = draft_contact;
              try {
                await ServerAnalytics.trackEventFromRequest(req, {
                  type: 'draft_contact_stored',
                  source: 'api.verification.send-code',
                  props: { via: 'phone', therapist_id: draft_contact.therapist_id, contact_type: draft_contact.contact_type },
                });
              } catch {}
            }
            if (draft_booking) {
              (metadata as Record<string, unknown>)['draft_booking'] = draft_booking;
              try {
                await ServerAnalytics.trackEventFromRequest(req, {
                  type: 'draft_booking_stored',
                  source: 'api.verification.send-code',
                  props: { via: 'phone', therapist_id: draft_booking.therapist_id },
                });
              } catch {}
            }
            await supabaseServer
              .from('people')
              .insert({
                type: 'patient',
                phone_number: normalized,
                name,
                status: 'new',
                metadata,
              });
          }
        } catch (err) {
          // Log but don't fail - SMS can still be sent
          void track({
            type: 'verification_person_upsert_failed',
            source: 'api.verification.send-code',
            props: { contact, error: err instanceof Error ? err.message : 'unknown' },
          });
        }
      }

      // Send SMS via Twilio
      const result = await sendSmsCode(contact);

      if (!result.success) {
        const classification = result.classification || 'unexpected';
        // Always log details for observability
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'verification_code_failed',
          source: 'api.verification.send-code',
          props: {
            contact_type,
            error: result.error,
            classification,
            twilio_status: result.twilio_status,
            twilio_code: result.twilio_code,
          },
        });

        // Credentials / config issues should surface as 500 to trigger alarms
        if (classification === 'auth' || classification === 'config') {
          return NextResponse.json(
            { error: 'SMS-Dienst vorübergehend nicht verfügbar' },
            { status: 500 }
          );
        }

        // Provider/temporary issues: in choice mode, gracefully fall back to email
        if (mode === 'choice') {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'verification_fallback_email',
            source: 'api.verification.send-code',
            props: { reason: result.error, classification },
          });
          return NextResponse.json({
            data: { fallback: 'email', reason: result.error },
            error: null,
          });
        }

        // SMS-only mode: treat as server error
        return NextResponse.json(
          { error: 'SMS konnte nicht gesendet werden. Bitte versuche es erneut.' },
          { status: 500 }
        );
      }

      // Success: track event
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'verification_code_sent',
        source: 'api.verification.send-code',
        props: { contact_type: 'phone', sid: result.sid },
      });

      return NextResponse.json({
        data: { sent: true, method: 'sms' },
        error: null,
      });
    } else {
      // Email verification: generate token and send email
      const token = randomBytes(32).toString('hex');

      // Determine base URL from request host for local development (localhost or LAN IP)
      // Falls back to NEXT_PUBLIC_BASE_URL in production
      let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      if (!baseUrl || baseUrl.includes('localhost')) {
        const host = req.headers.get('host');
        if (host) {
          const protocol = host.includes('localhost') || host.startsWith('192.168.') || host.startsWith('10.') ? 'http' : 'https';
          baseUrl = `${protocol}://${host}`;
        } else {
          baseUrl = 'http://localhost:3000';
        }
      }

      let confirmUrl = `${baseUrl}/api/public/leads/confirm?token=${token}`;
      if (form_session_id) {
        confirmUrl = `${confirmUrl}&fs=${encodeURIComponent(form_session_id)}`;
      }
      // If a safe redirect path is provided, include it so the confirm endpoint
      // can return the user to the correct UI context (e.g. ContactModal on /therapeuten).
      if (redirect && typeof redirect === 'string') {
        const isSafe = redirect.startsWith('/') && !redirect.startsWith('/api') && !redirect.startsWith('//');
        if (isSafe) {
          confirmUrl = `${confirmUrl}&redirect=${encodeURIComponent(redirect)}`;
        }
      }

      // Ensure a person exists for this email so confirmation can succeed.
      // Store the token & timestamp in metadata and include the id in the confirm URL.
      let personId = lead_id || '';
      
      if (!personId) {
        const { data: existing, error: selErr } = await supabaseServer
          .from('people')
          .select('id, metadata')
          .eq('email', contact)
          .limit(1);
        if (!selErr && existing && existing.length > 0) {
          personId = existing[0].id as string;
          const meta = (existing[0].metadata as Record<string, unknown>) || {};
          meta['confirm_token'] = token;
          meta['confirm_sent_at'] = new Date().toISOString();
          if (isTestCookie) meta['is_test'] = true;
          // Persist safe redirect path for idempotent confirm redirects back to directory
          if (redirect && typeof redirect === 'string') {
            const isSafe = redirect.startsWith('/') && !redirect.startsWith('/api') && !redirect.startsWith('//');
            if (isSafe) meta['last_confirm_redirect_path'] = redirect;
          }
          if (draft_contact) {
            meta['draft_contact'] = draft_contact;
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_contact_stored',
                source: 'api.verification.send-code',
                props: { via: 'email', therapist_id: draft_contact.therapist_id, contact_type: draft_contact.contact_type },
              });
            } catch {}
          }
          if (draft_booking) {
            meta['draft_booking'] = draft_booking;
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_booking_stored',
                source: 'api.verification.send-code',
                props: { via: 'email', therapist_id: draft_booking.therapist_id },
              });
            } catch {}
          }

          // Prepare update data: always update metadata and status
          const updateData: Record<string, unknown> = {
            metadata: meta,
            status: 'email_confirmation_sent',
          };

          // Include name if provided (from therapist directory contact flow)
          if (name) {
            updateData.name = name;
          }

          const { error: updateErr } = await supabaseServer
            .from('people')
            .update(updateData)
            .eq('id', personId);
          if (updateErr) {
            void track({
              type: 'verification_person_update_failed',
              source: 'api.verification.send-code',
              props: { contact, error: updateErr.message },
            });
            return NextResponse.json(
              { success: false, error: 'Failed to prepare verification' },
              { status: 500 }
            );
          }
        } else {
          // Create a minimal patient lead row
          const metadata: Record<string, unknown> = {
            confirm_token: token,
            confirm_sent_at: new Date().toISOString(),
            ...(isTestCookie ? { is_test: true } : {}),
          };
          // Store draft contact data if provided (therapist directory flow)
          if (draft_contact) {
            metadata.draft_contact = draft_contact;
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_contact_stored',
                source: 'api.verification.send-code',
                props: { via: 'email', therapist_id: draft_contact.therapist_id, contact_type: draft_contact.contact_type },
              });
            } catch {}
          }
          if (draft_booking) {
            metadata.draft_booking = draft_booking;
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_booking_stored',
                source: 'api.verification.send-code',
                props: { via: 'email', therapist_id: draft_booking.therapist_id },
              });
            } catch {}
          }
          // Persist safe redirect path for idempotent confirm redirects back to directory
          if (redirect && typeof redirect === 'string') {
            const isSafe = redirect.startsWith('/') && !redirect.startsWith('/api') && !redirect.startsWith('//');
            if (isSafe) metadata['last_confirm_redirect_path'] = redirect;
          }
          const insertData: Record<string, unknown> = {
            email: contact,
            type: 'patient',
            status: 'email_confirmation_sent',
            metadata,
          };
          // Include name if provided (from therapist directory contact flow)
          if (name) {
            insertData.name = name;
          }
          const { data: inserted, error: insErr } = await supabaseServer
            .from('people')
            .insert(insertData)
            .select('id')
            .single();
          if (insErr || !inserted?.id) {
            void track({
              type: 'verification_person_insert_failed',
              source: 'api.verification.send-code',
              props: { contact, error: insErr?.message || 'no_id' },
            });
            return NextResponse.json(
              { success: false, error: 'Failed to prepare verification' },
              { status: 500 }
            );
          }
          personId = inserted.id as string;
        }
      } else {
        // Update provided lead_id metadata
        const { data: existing } = await supabaseServer
          .from('people')
          .select('metadata')
          .eq('id', personId)
          .single();
        const meta = (existing?.metadata as Record<string, unknown>) || {};
        meta['confirm_token'] = token;
        meta['confirm_sent_at'] = new Date().toISOString();
        if (isTestCookie) meta['is_test'] = true;
        // Persist safe redirect path for idempotent confirm redirects back to directory
        if (redirect && typeof redirect === 'string') {
          const isSafe = redirect.startsWith('/') && !redirect.startsWith('/api') && !redirect.startsWith('//');
          if (isSafe) meta['last_confirm_redirect_path'] = redirect;
        }
        // Store draft contact/booking data if provided (therapist directory flow)
        if (draft_contact) {
          meta['draft_contact'] = draft_contact;
          try {
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'draft_contact_stored',
              source: 'api.verification.send-code',
              props: { via: 'email', therapist_id: draft_contact.therapist_id, contact_type: draft_contact.contact_type },
            });
          } catch {}
        }
        if (draft_booking) {
          meta['draft_booking'] = draft_booking;
          try {
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'draft_booking_stored',
              source: 'api.verification.send-code',
              props: { via: 'email', therapist_id: draft_booking.therapist_id },
            });
          } catch {}
        }

        // Prepare update data: always update metadata and status
        const updateData: Record<string, unknown> = {
          metadata: meta,
          status: 'email_confirmation_sent',
        };

        // Include name if provided (from therapist directory contact flow)
        if (name) {
          updateData.name = name;
        }

        const { error: updateErr } = await supabaseServer
          .from('people')
          .update(updateData)
          .eq('id', personId);
        if (updateErr) {
          void track({
            type: 'verification_person_update_failed',
            source: 'api.verification.send-code',
            props: { contact, lead_id, error: updateErr.message },
          });
          return NextResponse.json(
            { success: false, error: 'Failed to prepare verification' },
            { status: 500 }
          );
        }
      }

      // Must have personId before sending email
      if (!personId) {
        void track({
          type: 'verification_missing_person_id',
          source: 'api.verification.send-code',
          props: { contact, lead_id: lead_id || null },
        });
        return NextResponse.json(
          { success: false, error: 'Failed to prepare verification' },
          { status: 500 }
        );
      }

      confirmUrl = `${confirmUrl}&id=${encodeURIComponent(personId)}`;

      // Check if this is a booking flow (draft_booking present)
      const isBooking = !!draft_booking;
      const emailContent = renderEmailConfirmation({ confirmUrl, isBooking });
      
      let emailResult: { success: boolean; error?: string } = { success: true };
      try {
        await sendEmail({
          to: contact,
          subject: emailContent.subject,
          html: emailContent.html,
          replyTo: 'kontakt@kaufmann-health.de',
          context: {
            stage: 'email_confirmation',
            lead_id: lead_id || 'pending',
            lead_type: 'patient',
            template: 'email_confirmation',
            email_token: token,
          },
        });
      } catch (err) {
        emailResult = { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }

      if (!emailResult.success) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'verification_code_failed',
          source: 'api.verification.send-code',
          props: { contact_type: 'email', error: emailResult.error },
        });

        return NextResponse.json(
          { error: 'Email konnte nicht gesendet werden' },
          { status: 500 }
        );
      }

      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'verification_code_sent',
        source: 'api.verification.send-code',
        props: { contact_type: 'email' },
      });

      const respData: Record<string, unknown> = { sent: true, method: 'email', token };
      if (process.env.NODE_ENV !== 'production') {
        respData.person_id = personId;
      }
      return NextResponse.json({
        data: respData,
        error: null,
      });
    }
  } catch (error) {
    console.error('[api.verification.send-code] Error:', error);

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'verification_code_failed',
      source: 'api.verification.send-code',
      props: { error: error instanceof Error ? error.message : 'unknown' },
    });

    return NextResponse.json(
      { error: 'Interner Fehler' },
      { status: 500 }
    );
  }
}
