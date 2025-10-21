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
}

/**
 * Check rate limit for user (by session or IP)
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

  // Count matches created by this patient in last 24h
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id')
    .eq('patient_id', patientId)
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
    
    // Validation
    if (!therapist_id || !contact_type || !patient_name || !contact_method || !patient_reason) {
      console.error('[contact] Missing required fields:', {
        therapist_id: !!therapist_id,
        contact_type: !!contact_type,
        patient_name: !!patient_name,
        contact_method: !!contact_method,
        patient_reason: !!patient_reason,
        body,
      });
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder' },
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
    let sessionCookie: string | undefined;
    
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
    
    if (!session) {
      // New patient: create or find existing record
      isNewPatient = true;
      
      // Normalize contact value
      const normalizedContact: string = contact_method === 'phone' 
        ? normalizePhoneNumber(contactValue) || contactValue
        : contactValue.toLowerCase().trim();
      
      // Check if patient already exists by contact method
      const lookupField = contact_method === 'email' ? 'email' : 'phone_number';
      const { data: existing } = await supabase
        .from('people')
        .select('id')
        .eq('type', 'patient')
        .eq(lookupField, normalizedContact)
        .single();
      
      if (existing) {
        patientId = existing.id;
      } else {
        // Create new patient record
        const insertData: Record<string, unknown> = {
          type: 'patient',
          name: patient_name,
          status: 'new',
          metadata: {
            contact_method,
            source: 'directory_contact',
            consent_share_with_therapists: true,
            consent_share_with_therapists_at: new Date().toISOString(),
            consent_privacy_version: PRIVACY_VERSION,
            consent_terms_version: TERMS_VERSION,
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
      sessionCookie = createClientSessionCookie(token);
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
      .select('id, first_name, last_name, email')
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
    
    // Create match record
    const matchMetadata = {
      patient_initiated: true,
      contact_type,
      patient_reason,
      patient_message: patient_message || '',
      contact_method,
      session_format: session_format || null,
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
      },
    });

    // Log a dedicated conversion event for directory contact, including session attribution
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
        },
      });
    } catch {}
    
    // Send notification email to therapist (EARTH-205: include message and contact type)
    try {
      const emailContent = renderTherapistNotification({
        type: 'outreach',
        therapistName: therapist.first_name,
        patientCity: '', // Not collected in this flow
        patientIssue: patient_reason,
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
    } catch (emailErr) {
      // Log but don't fail the request
      void logError('email.therapist_notification', emailErr, {
        match_id: match.id,
      }, ip, ua);
    }
    
    // Prepare response
    const response = NextResponse.json({
      data: {
        match_id: match.id,
        therapist_name: `${therapist.first_name} ${therapist.last_name}`,
        success: true,
      },
    });
    
    // Set session cookie for new patients
    if (isNewPatient && sessionCookie) {
      response.headers.set('Set-Cookie', sessionCookie);
    }
    
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
