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
      try {
        type PersonRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
        const { data: person, error: fetchErr } = await supabaseServer
          .from('people')
          .select('id,name,email,metadata')
          .eq('phone_number', contact)
          .eq('type', 'patient')
          .single<PersonRow>();

        if (!fetchErr && person) {
          // Update metadata with phone_verified flag and mark actionable
          const metadata = { ...(person.metadata || {}), phone_verified: true };
          await supabaseServer
            .from('people')
            // Mark as 'new' so phone users proceed without email confirmation
            .update({ metadata, status: 'new' })
            .eq('id', person.id);

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

      const response = NextResponse.json({
        data: { verified: true, method: 'sms' },
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
