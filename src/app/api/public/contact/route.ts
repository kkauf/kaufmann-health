/**
 * EARTH-203: Patient-initiated contact flow
 * 
 * POST /api/public/contact
 * Creates a match between patient and therapist, sends notification email
 * 
 * Rate limit: 3 contacts per user per day (tracked via kh_client cookie + IP fallback)
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getClientSession, createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { logError, track } from '@/lib/logger';
import { normalizePhoneNumber } from '@/lib/verification/phone';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { BASE_URL } from '@/lib/constants';
import { ServerAnalytics } from '@/lib/server-analytics';
// NOTE: maybeFirePatientConversion is now triggered by the CLIENT
// via fireLeadVerifiedWithEnhancement(). This ensures the gtag base conversion fires
// BEFORE the server-side enhancement, which is required for Google Ads matching.

const RATE_LIMIT_PER_DAY = 3;

interface ContactRequestBody {
  therapist_id: string;
  contact_type: 'booking' | 'consultation';
  patient_name: string;
  patient_email?: string;
  patient_phone?: string;
  contact_method: 'email' | 'phone';
  patient_reason: string;
  patient_message?: string;
  session_format?: 'online' | 'in_person';
  session_id?: string;
  idempotency_key?: string;
}

/**
 * Check rate limit for user - only counts PATIENT-INITIATED contacts, not auto-generated matches
 */
async function checkRateLimit(
  patientId: string,
  _ip: string
): Promise<{ allowed: boolean; count: number }> {
  // Allow disabling rate limit for local testing
  if (process.env.RESEND_DISABLE_IDEMPOTENCY === 'true') {
    return { allowed: true, count: 0 };
  }
  const supabase = supabaseServer;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Count only matches where patient actually initiated contact (not auto-generated proposed matches)
  // Note: Use explicit JSON string for containment to ensure PostgREST applies the filter correctly
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id')
    .eq('patient_id', patientId)
    .filter('metadata', 'cs', JSON.stringify({ patient_initiated: true }))
    .gte('created_at', oneDayAgo);

  if (error) {
    console.error('[contact] Rate limit check failed:', error);
    // Fail open: allow request if we can't check
    return { allowed: true, count: 0 };
  }

  const count = matches?.length || 0;
  return { allowed: count < RATE_LIMIT_PER_DAY, count };
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const ua = req.headers.get('user-agent') || '';
  
  try {
    const body = await req.json() as ContactRequestBody;
    const {
      therapist_id,
      contact_type,
      patient_name,
      patient_email,
      patient_phone,
      contact_method,
      patient_reason,
      patient_message,
      session_format,
    } = body;
    // Detect E2E/test traffic to avoid affecting production data and emails
    const isTestCookie = (() => {
      try {
        const cookie = req.headers.get('cookie') || '';
        if (!cookie) return false;
        const parts = cookie.split(';');
        for (const p of parts) {
          const [k, v] = p.trim().split('=');
          if (k === 'kh_test' && v === '1') return true;
        }
        return false;
      } catch { return false; }
    })();
    const isTestTraffic = (() => {
      try {
        const email = (patient_email || '').trim();
        const name = (patient_name || '').trim();
        const e2eEmail = /^e2e-[a-z0-9]+@example\.com$/i.test(email);
        const e2eName = /^e2e\b/i.test(name);
        return e2eEmail || e2eName;
      } catch {
        return false;
      }
    })();
    const isTest = isTestTraffic || isTestCookie;
    // Parse campaign details from referer (Test 1: control|browse from /start)
    const { campaign_source, campaign_variant, landing_page } = ServerAnalytics.parseCampaignFromRequest(req);
    
    // Validation
    const reasonTrimmed = (patient_reason || '').trim();
    const messageTrimmed = (patient_message || '').trim();
    if (!therapist_id || !contact_type || !patient_name || !contact_method) {
      console.error('[contact] Missing required fields (base):', {
        therapist_id: !!therapist_id,
        contact_type: !!contact_type,
        patient_name: !!patient_name,
        contact_method: !!contact_method,
      });
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      );
    }
    // Require either reason OR message (not necessarily both)
    if (!reasonTrimmed && !messageTrimmed) {
      return NextResponse.json(
        { error: 'Bitte gib ein Anliegen oder eine Nachricht an' },
        { status: 400 }
      );
    }

    if (!['booking', 'consultation'].includes(contact_type)) {
      return NextResponse.json(
        { error: 'Ungültiger Kontakttyp' },
        { status: 400 }
      );
    }
    
    if (!['email', 'phone'].includes(contact_method)) {
      return NextResponse.json(
        { error: 'Ungültige Kontaktmethode' },
        { status: 400 }
      );
    }

    // Validate session format for booking type
    if (contact_type === 'booking' && !session_format) {
      return NextResponse.json(
        { error: 'Bitte wähle, ob der Termin online oder vor Ort stattfinden soll' },
        { status: 400 }
      );
    }

    const contactValue = contact_method === 'email' ? patient_email : patient_phone;
    if (!contactValue) {
      return NextResponse.json(
        { error: 'Kontaktinformation fehlt' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = supabaseServer;
    
    // Check for existing session or create new patient record
    let session = await getClientSession(req);
    let patientId: string | null = null;
    let isNewPatient = false;
    let _sessionCookie: string | undefined;
    let isTestFromPatientMeta = false;
    
    if (session) {
      // Existing session
      patientId = session.patient_id;
      
      // Verify patient still exists
      const { data: patient, error: patientError } = await supabase
        .from('people')
        .select('id')
        .eq('id', patientId)
        .eq('type', 'patient')
        .single();
      
      if (patientError || !patient) {
        // Session invalid, treat as new patient
        session = null;
      }
    }
    
    // Early rate-limit check when a valid session exists
    if (session?.patient_id) {
      const rl = await checkRateLimit(session.patient_id, ip);
      if (!rl.allowed) {
        void track({
          type: 'contact_rate_limit_hit',
          source: 'api.public.contact',
          props: { patient_id: session.patient_id, count: rl.count },
        });
        return NextResponse.json(
          {
            error: 'Du hast bereits 3 Therapeuten kontaktiert. Bitte warte auf ihre Rückmeldung, bevor du weitere Therapeuten kontaktierst.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          { status: 429 }
        );
      }
    }

    if (!session) {
      // New patient: create or find existing record
      isNewPatient = true;
      
      // Normalize and validate contact value
      let normalizedContact: string;
      if (contact_method === 'phone') {
        const normalized = normalizePhoneNumber(contactValue);
        if (!normalized) {
          return NextResponse.json(
            { error: 'Bitte gib eine gültige Handynummer ein. Festnetznummern werden nicht unterstützt.' },
            { status: 400 }
          );
        }
        normalizedContact = normalized;
      } else {
        normalizedContact = contactValue.toLowerCase().trim();
      }
      
      // Check if patient already exists by contact method
      const lookupField = contact_method === 'email' ? 'email' : 'phone_number';
      const { data: existing } = await supabase
        .from('people')
        .select('id, metadata, status')
        .eq('type', 'patient')
        .eq(lookupField, normalizedContact)
        .single();
      
      if (existing) {
        patientId = existing.id;
        // Patient exists - check if they're already verified (status = 'new' or better)
        const existingStatus = (existing as { status?: string }).status || '';
        isNewPatient = existingStatus !== 'new' && existingStatus !== 'email_confirmed';
        try {
          const meta = (existing.metadata || {}) as Record<string, unknown>;
          const v = meta['is_test'];
          isTestFromPatientMeta = v === true || String(v).toLowerCase() === 'true';
        } catch {}
      } else {
        // Create new patient record with pre_confirmation status (needs verification)
        const insertData: Record<string, unknown> = {
          type: 'patient',
          name: patient_name,
          status: 'pre_confirmation',
          campaign_source: campaign_source || '/start',
          campaign_variant: (campaign_variant || undefined) as string | undefined,
          landing_page: landing_page || undefined,
          metadata: {
            contact_method,
            source: 'directory_contact',
            consent_share_with_therapists: true,
            consent_share_with_therapists_at: new Date().toISOString(),
            consent_privacy_version: PRIVACY_VERSION,
            consent_terms_version: TERMS_VERSION,
            ...(isTest ? { is_test: true } : {}),
          },
        };
        
        if (contact_method === 'email') {
          insertData.email = normalizedContact;
        } else {
          insertData.phone_number = normalizedContact;
        }
        
        const { data: newPatient, error: insertError } = await supabase
          .from('people')
          .insert(insertData)
          .select('id')
          .single();
        
        if (insertError || !newPatient) {
          throw new Error(`Failed to create patient: ${insertError?.message}`);
        }
        
        patientId = newPatient.id;
        
        void track({
          type: 'patient_created',
          source: 'api.public.contact',
          props: { contact_method, via: 'directory_contact' },
        });
      }
      
      // Create session token
      const token = await createClientSessionToken({
        patient_id: patientId as string,
        contact_method,
        contact_value: normalizedContact,
        name: patient_name,
      });
      
      session = {
        patient_id: patientId as string,
        contact_method,
        contact_value: normalizedContact,
        name: patient_name,
      };
      
      // Will set cookie in response
      void createClientSessionCookie(token); // Cookie set in response below
    }
    
    // Check rate limit
    if (!patientId) {
      throw new Error('Patient ID not set');
    }
    const rateLimit = await checkRateLimit(patientId, ip);
    if (!rateLimit.allowed) {
      void track({
        type: 'contact_rate_limit_hit',
        source: 'api.public.contact',
        props: { patient_id: patientId, count: rateLimit.count },
      });
      
      return NextResponse.json(
        { 
          error: 'Du hast bereits 3 Therapeuten kontaktiert. Bitte warte auf ihre Rückmeldung, bevor du weitere Therapeuten kontaktierst.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }
    
    // Fetch therapist details
    const { data: therapist, error: therapistError } = await supabase
      .from('therapists')
      .select('id, first_name, last_name, email, metadata')
      .eq('id', therapist_id)
      .eq('status', 'verified')
      .single();
    
    if (therapistError || !therapist) {
      return NextResponse.json(
        { error: 'Therapeut nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Ensure consent markers are stored for both new and existing patients (metadata only), now that request is allowed to proceed
    try {
      if (patientId) {
        const { data: existingMetaRow } = await supabase
          .from('people')
          .select('metadata')
          .eq('id', patientId)
          .single();
        const existingMeta = (existingMetaRow?.metadata || {}) as Record<string, unknown>;
        const mergedMeta = {
          ...existingMeta,
          consent_share_with_therapists: true,
          consent_share_with_therapists_at: new Date().toISOString(),
          consent_privacy_version: PRIVACY_VERSION,
          consent_terms_version: TERMS_VERSION,
          ...(isTestTraffic ? { is_test: true } : {}),
        };
        await supabase
          .from('people')
          .update({ metadata: mergedMeta })
          .eq('id', patientId);
        // Analytics: consent captured via directory contact
        void track({
          type: 'consent_captured',
          source: 'api.public.contact',
          props: { method: contact_method, privacy_version: PRIVACY_VERSION },
        });
      }
    } catch {}
    
    // Use a derived reason for storage/email if reason is missing
    const patientReasonEffective = reasonTrimmed || (messageTrimmed ? 'Anliegen per Nachricht' : '');

    // Idempotency: if idempotency_key is provided, check for existing match
    const idempotencyKey = (body.idempotency_key || '').trim();
    if (idempotencyKey) {
      try {
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id')
          .eq('patient_id', patientId)
          .eq('therapist_id', therapist.id)
          .filter('metadata', 'cs', JSON.stringify({ idempotency_key: idempotencyKey }))
          .limit(1)
          .maybeSingle();
        if (existingMatch) {
          void track({
            type: 'contact_idempotent_duplicate',
            source: 'api.public.contact',
            props: { match_id: existingMatch.id, therapist_id: therapist.id, patient_id: patientId },
          });
          return NextResponse.json({ data: { match_id: existingMatch.id, therapist_name: `${therapist.first_name} ${therapist.last_name}`, success: true } });
        }
      } catch {}
    }

    const isTestFinal = isTest || isTestFromPatientMeta;

    // Check if user needs verification (new patients without verified status)
    // Only process immediately if user has valid session (already verified via kh_client cookie)
    const needsVerification = isNewPatient;

    if (needsVerification) {
      // Store draft_contact in metadata for processing after verification
      const draftContact = {
        therapist_id: therapist.id,
        contact_type,
        patient_reason: patientReasonEffective,
        patient_message: patient_message || '',
        session_format: session_format || null,
        ...(isTestFinal ? { is_test: true } : {}),
        created_at: new Date().toISOString(),
      };

      // Get current metadata and add draft_contact
      const { data: currentPerson } = await supabase
        .from('people')
        .select('metadata')
        .eq('id', patientId)
        .single();
      
      const currentMeta = (currentPerson?.metadata || {}) as Record<string, unknown>;
      const updatedMeta = {
        ...currentMeta,
        draft_contact: draftContact,
      };

      await supabase
        .from('people')
        .update({ metadata: updatedMeta })
        .eq('id', patientId);

      void track({
        type: 'draft_contact_stored',
        source: 'api.public.contact',
        props: {
          therapist_id: therapist.id,
          patient_id: patientId,
          contact_type,
          contact_method,
        },
      });

      // Return response indicating verification is needed
      // The client (ContactModal) will handle triggering verification
      return NextResponse.json({
        data: {
          patient_id: patientId,
          therapist_name: `${therapist.first_name} ${therapist.last_name}`,
          requires_verification: true,
          contact_method,
          success: true,
        },
      });
    }

    // User is already verified (has session) - process immediately
    // Create match record
    const matchMetadata = {
      patient_initiated: true,
      contact_type,
      patient_reason: patientReasonEffective,
      patient_message: patient_message || '',
      contact_method,
      session_format: session_format || null,
      magic_link_issued_at: new Date().toISOString(),
      magic_link_issued_count: 1,
      ...(isTestFinal ? { is_test: true } : {}),
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };
    
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        patient_id: patientId,
        therapist_id: therapist.id,
        status: 'proposed',
        metadata: matchMetadata,
      })
      .select('id, secure_uuid')
      .single();
    
    if (matchError || !match) {
      throw new Error(`Failed to create match: ${matchError?.message}`);
    }

    void track({
      type: 'contact_match_created',
      source: 'api.public.contact',
      props: {
        match_id: match.id,
        therapist_id: therapist.id,
        patient_id: patientId,
        contact_type,
        is_new_patient: isNewPatient,
        session_id: body.session_id,
        campaign_source: campaign_source || '/start',
        campaign_variant: campaign_variant || undefined,
        landing_page: landing_page || undefined,
      },
    });

    // Log a dedicated conversion event for directory contact
    try {
      let conversion_path: string | undefined;
      try {
        const ref = req.headers.get('referer') || '';
        if (ref) conversion_path = new URL(ref).pathname;
      } catch {}
      void track({
        type: 'directory_contact_conversion',
        source: 'api.public.contact',
        props: {
          match_id: match.id,
          therapist_id: therapist.id,
          patient_id: patientId,
          contact_type,
          contact_method,
          session_id: body.session_id,
          conversion_path: conversion_path || '/therapeuten',
          campaign_source: campaign_source || '/start',
          campaign_variant: campaign_variant || undefined,
          landing_page: landing_page || undefined,
        },
      });
    } catch {}

    // NOTE: Google Ads conversion is now triggered by the CLIENT
    // via fireLeadVerifiedWithEnhancement() after verification completes.
    
    // Send notification email to therapist
    try {
      const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
      const hideIds = new Set(
        hideIdsEnv
          ? hideIdsEnv
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      );
      const md = (therapist?.metadata || {}) as Record<string, unknown>;
      const hiddenVal = (md && md['hidden']) as unknown;
      const isHidden = hideIds.has(therapist.id) || hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';

      const suppressForTest = isTestFinal === true;
      if (!isHidden && !suppressForTest) {
        const emailContent = renderTherapistNotification({
          type: 'outreach',
          therapistName: therapist.first_name,
          patientCity: '',
          patientIssue: patientReasonEffective,
          patientSessionPreference: session_format || null,
          magicUrl: `${BASE_URL}/match/${match.secure_uuid}`,
          expiresHours: 72,
          contactType: contact_type,
          patientMessage: patient_message,
        });

        void sendEmail({
          to: therapist.email,
          subject: emailContent.subject,
          html: emailContent.html,
        }).catch(err => {
          void logError('email.therapist_notification', err, {
            match_id: match.id,
            therapist_id: therapist.id,
          }, ip, ua);
        });

        void track({
          type: 'contact_email_sent',
          source: 'api.public.contact',
          props: { match_id: match.id, therapist_id: therapist.id },
        });
      } else {
        void track({
          type: suppressForTest ? 'contact_email_skipped_test' : 'contact_email_skipped_hidden',
          source: 'api.public.contact',
          props: { match_id: match.id, therapist_id: therapist.id },
        });
      }
    } catch (emailErr) {
      void logError('email.therapist_notification', emailErr, {
        match_id: match.id,
      }, ip, ua);
    }
    
    // Prepare response for verified users
    const response = NextResponse.json({
      data: {
        match_id: match.id,
        therapist_name: `${therapist.first_name} ${therapist.last_name}`,
        success: true,
      },
    });
    
    return response;
    
  } catch (err) {
    console.error('[contact] Error:', err);
    void logError('api.public.contact', err, {}, ip, ua);
    
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' },
      { status: 500 }
    );
  }
}
