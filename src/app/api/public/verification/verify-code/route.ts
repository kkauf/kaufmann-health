/**
 * POST /api/public/verification/verify-code
 * Verify SMS code or email token
 * EARTH-191: SMS verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySmsCode } from '@/lib/verification/sms';
import { ServerAnalytics } from '@/lib/server-analytics';

interface VerifyCodeRequest {
  contact: string; // email or phone
  contact_type: 'email' | 'phone';
  code: string; // 6-digit SMS code or email token
}

export async function POST(req: NextRequest) {
  try {
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

      return NextResponse.json({
        data: { verified: true, method: 'sms' },
        error: null,
      });
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
