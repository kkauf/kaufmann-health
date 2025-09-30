/**
 * POST /api/public/verification/send-code
 * Send verification code via SMS or email based on VERIFICATION_MODE
 * EARTH-191: SMS verification for faster mobile onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendSmsCode } from '@/lib/verification/sms';
import { getVerificationMode } from '@/lib/verification/config';
import { isValidGermanMobile } from '@/lib/verification/phone';
import { ServerAnalytics } from '@/lib/server-analytics';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { sendEmail } from '@/lib/email/client';
import { randomBytes } from 'crypto';

interface SendCodeRequest {
  contact: string; // email or phone
  contact_type: 'email' | 'phone';
  lead_id?: string; // Optional: if associated with existing lead
  form_session_id?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    const body = (await req.json()) as SendCodeRequest;
    const { contact, contact_type, lead_id, form_session_id } = body;

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
      let confirmUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/public/leads/confirm?token=${token}`;
      if (form_session_id) {
        confirmUrl = `${confirmUrl}&fs=${encodeURIComponent(form_session_id)}`;
      }

      const emailContent = renderEmailConfirmation({ confirmUrl });
      
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

      return NextResponse.json({
        data: { sent: true, method: 'email', token }, // Return token for testing
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
