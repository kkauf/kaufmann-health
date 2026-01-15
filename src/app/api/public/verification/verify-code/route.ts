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
  // In development, show the actual Zod error for debugging
  if (process.env.NODE_ENV !== 'production') {
    return message;
  }
  // In production, show user-friendly message
  if (message.includes('code')) {
    return 'Code fehlt oder ungültig';
  }
  if (message.includes('contact')) {
    return 'Kontaktinformationen fehlen';
  }
  return 'Ungültige Anfrage';
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
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<PersonRow>();

        if (!fetchErr && person) {
          console.log('[verify-code] Found person:', { id: person.id, has_draft: !!person.metadata?.draft_contact }); // DEBUG
          effectivePersonId = person.id;
          // Extract draft_contact reference (do NOT remove yet; clear after success)
          const draftContact = person.metadata?.draft_contact as Record<string, unknown> | undefined;

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

          // Create instant matches for phone-verified users
          // Pass the merged metadata directly to avoid race condition with DB write
          const variant = person.campaign_variant || undefined;
          try {
            const matchResult = await createInstantMatchesForPatient(person.id, variant, metadata);
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

              console.log('[verify-code] Processing draft contact:', { therapistId, has_reason: !!patientReason }); // DEBUG

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
                  } catch { }
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
                  } catch { }
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
      } catch { }

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
      // Email verification: verify 6-digit code against stored code in DB
      // Normalize code (remove whitespace)
      const normalizedCode = code.trim();
      
      // Staging/test bypass: accept 000000 in non-production
      const isTestBypass = process.env.NODE_ENV !== 'production' && normalizedCode === '000000';
      
      // Find person by email
      type PersonRow = { id: string; name?: string | null; email?: string | null; phone_number?: string | null; campaign_variant?: string | null; metadata?: Record<string, unknown> | null };
      const { data: person, error: fetchErr } = await supabaseServer
        .from('people')
        .select('id,name,email,phone_number,campaign_variant,metadata')
        .eq('email', contact)
        .eq('type', 'patient')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<PersonRow>();
      
      if (fetchErr || !person) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'verification_code_failed',
          source: 'api.verification.verify-code',
          props: { contact_type: 'email', reason: 'person_not_found' },
        });
        return NextResponse.json(
          { error: 'Kein Konto mit dieser E-Mail gefunden' },
          { status: 400 }
        );
      }
      
      const meta = (person.metadata || {}) as Record<string, unknown>;
      const storedCode = meta['email_code'] as string | undefined;
      const expiresAt = meta['email_code_expires_at'] as string | undefined;
      
      // Verify code matches (or test bypass)
      if (!isTestBypass) {
        if (!storedCode || storedCode !== normalizedCode) {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'verification_code_failed',
            source: 'api.verification.verify-code',
            props: { contact_type: 'email', reason: 'code_mismatch' },
          });
          return NextResponse.json(
            { error: 'Falscher Code' },
            { status: 400 }
          );
        }
        
        // Check expiry
        if (expiresAt && new Date(expiresAt) < new Date()) {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'verification_code_failed',
            source: 'api.verification.verify-code',
            props: { contact_type: 'email', reason: 'code_expired' },
          });
          return NextResponse.json(
            { error: 'Code abgelaufen. Bitte fordere einen neuen an.' },
            { status: 400 }
          );
        }
      }
      
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'verification_code_verified',
        source: 'api.verification.verify-code',
        props: { contact_type: 'email', is_test_bypass: isTestBypass },
      });
      
      // Mark email as verified and clear the code
      const updatedMeta: Record<string, unknown> = { ...meta, email_verified: true };
      delete updatedMeta['email_code'];
      delete updatedMeta['email_code_sent_at'];
      delete updatedMeta['email_code_expires_at'];
      
      // Extract draft_contact reference for processing
      const draftContact = meta.draft_contact as Record<string, unknown> | undefined;
      
      // Merge form session data if available
      const fsid = typeof meta['form_session_id'] === 'string' ? (meta['form_session_id'] as string) : undefined;
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
            const cityVal = maybeString('city');
            if (cityVal) updatedMeta.city = cityVal;
            const sessionPref = maybeString('session_preference');
            if (sessionPref) {
              const s = sessionPref.toLowerCase();
              if (s === 'online' || s.startsWith('online')) updatedMeta.session_preference = 'online';
              else if (s === 'in_person' || s.includes('vor ort')) updatedMeta.session_preference = 'in_person';
              else if (s.startsWith('beides') || s.includes('beides ist okay')) {
                updatedMeta.session_preferences = ['online', 'in_person'];
                delete updatedMeta['session_preference'];
              }
            }
            const spArray = maybeArray('session_preferences');
            if (Array.isArray(spArray)) updatedMeta.session_preferences = spArray;
            const gender = maybeString('gender');
            if (gender) {
              const g = gender.toLowerCase();
              if (g.includes('mann')) updatedMeta.gender_preference = 'male';
              else if (g.includes('frau')) updatedMeta.gender_preference = 'female';
              else if (g.includes('keine')) updatedMeta.gender_preference = 'no_preference';
            }
            const methods = maybeArray('methods');
            if (methods) updatedMeta.specializations = methods;
            const schwerpunkte = maybeArray('schwerpunkte');
            if (schwerpunkte) updatedMeta.schwerpunkte = schwerpunkte;
            const time_slots = maybeArray('time_slots');
            if (time_slots) updatedMeta.time_slots = time_slots;
          }
        } catch { /* non-blocking */ }
      }
      
      await supabaseServer
        .from('people')
        .update({ metadata: updatedMeta, status: 'new' })
        .eq('id', person.id);
      
      // Create instant matches
      const variant = person.campaign_variant || undefined;
      try {
        const matchResult = await createInstantMatchesForPatient(person.id, variant, updatedMeta);
        if (matchResult) {
          const metaWithMatches = { ...updatedMeta, last_confirm_redirect_path: matchResult.matchesUrl };
          await supabaseServer
            .from('people')
            .update({ metadata: metaWithMatches })
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
              patientEmail: contact,
              contactMethod: 'email',
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
              void ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_contact_processed',
                source: 'api.verification.verify-code',
                props: { therapist_id: therapistId, contact_type: contactType, match_id: result.matchId },
              });
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
        email: contact,
        phone_number: person.phone_number || undefined,
        verification_method: 'email',
        ip,
        ua,
      });
      
      // Create session cookie
      let sessionCookie: string | null = null;
      try {
        const token = await createClientSessionToken({
          patient_id: person.id,
          contact_method: 'email',
          contact_value: contact,
          name: person.name || undefined,
        });
        sessionCookie = createClientSessionCookie(token);
      } catch (cookieErr) {
        await logError('api.verification.verify-code', cookieErr, { stage: 'create_session_cookie' });
      }
      
      // Track completion
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'contact_verification_completed',
        source: 'api.verification.verify-code',
        props: { contact_method: 'email' },
      });
      
      const respData: Record<string, unknown> = { verified: true, method: 'email' };
      if (process.env.NODE_ENV !== 'production') {
        respData.person_id = person.id;
      }
      // Include matches_url for redirect
      try {
        const { data: personMeta } = await supabaseServer
          .from('people')
          .select('metadata')
          .eq('id', person.id)
          .single();
        const finalMeta = (personMeta?.metadata as Record<string, unknown>) || {};
        const matchesUrl = finalMeta['last_confirm_redirect_path'] as string | undefined;
        if (matchesUrl) {
          respData.matches_url = matchesUrl;
        }
      } catch { /* ignore */ }
      
      const response = NextResponse.json({
        data: respData,
        error: null,
      });
      
      if (sessionCookie) {
        response.headers.set('Set-Cookie', sessionCookie);
      }
      
      return response;
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
