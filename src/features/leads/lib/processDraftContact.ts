/**
 * Shared helper for processing draft_contact after user verification
 * Creates match, fires conversion, emails therapist
 */

import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { logError, track } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';

interface DraftContact {
  therapist_id: string;
  contact_type: 'booking' | 'consultation';
  patient_reason: string;
  patient_message?: string;
  session_format?: 'online' | 'in_person';
}

interface ProcessDraftContactParams {
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  contactMethod: 'email' | 'phone';
  draftContact: DraftContact;
  isTest?: boolean;
}

interface ProcessDraftContactResult {
  success: boolean;
  matchId?: string;
  error?: string;
}

/**
 * Process a draft_contact after verification:
 * 1. Create match record
 * 2. Send therapist notification email
 * 3. Track analytics
 */
export async function processDraftContact(
  params: ProcessDraftContactParams
): Promise<ProcessDraftContactResult> {
  const {
    patientId,
    patientName: _patientName, // Reserved for future use (patient name in therapist email)
    patientEmail: _patientEmail, // Reserved for future use
    patientPhone: _patientPhone, // Reserved for future use
    contactMethod,
    draftContact,
    isTest = false,
  } = params;

  const {
    therapist_id,
    contact_type,
    patient_reason,
    patient_message,
    session_format,
  } = draftContact;

  try {
    // Validate therapist exists and is verified
    const { data: therapist, error: therapistError } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, metadata')
      .eq('id', therapist_id)
      .eq('status', 'verified')
      .single();

    if (therapistError || !therapist) {
      return { success: false, error: 'Therapeut nicht gefunden' };
    }

    // Create match record
    const matchMetadata = {
      patient_initiated: true,
      contact_type,
      patient_reason,
      patient_message: patient_message || '',
      contact_method: contactMethod,
      session_format: session_format || null,
      source: 'directory_contact_verified',
      ...(isTest ? { is_test: true } : {}),
    };

    const { data: match, error: matchError } = await supabaseServer
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
      await logError('processDraftContact', matchError, { stage: 'create_match', patientId, therapist_id });
      return { success: false, error: 'Match konnte nicht erstellt werden' };
    }

    void track({
      type: 'draft_contact_match_created',
      source: 'lib.processDraftContact',
      props: {
        match_id: match.id,
        therapist_id: therapist.id,
        patient_id: patientId,
        contact_type,
        contact_method: contactMethod,
      },
    });

    // Send therapist notification email (unless test)
    if (!isTest) {
      try {
        const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
        const hideIds = new Set(
          hideIdsEnv ? hideIdsEnv.split(',').map((s) => s.trim()).filter(Boolean) : []
        );
        const md = (therapist?.metadata || {}) as Record<string, unknown>;
        const hiddenVal = md['hidden'] as unknown;
        const isHidden = hideIds.has(therapist.id) || hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';

        if (!isHidden) {
          const emailContent = renderTherapistNotification({
            type: 'outreach',
            therapistName: therapist.first_name,
            patientCity: '',
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
          }).catch((err) => {
            void logError('email.therapist_notification', err, {
              match_id: match.id,
              therapist_id: therapist.id,
            });
          });

          void track({
            type: 'draft_contact_email_sent',
            source: 'lib.processDraftContact',
            props: { match_id: match.id, therapist_id: therapist.id },
          });
        }
      } catch (emailErr) {
        void logError('email.therapist_notification', emailErr, { match_id: match.id });
      }
    }

    return { success: true, matchId: match.id };
  } catch (err) {
    await logError('processDraftContact', err, { stage: 'unhandled', patientId, therapist_id });
    return { success: false, error: 'Verarbeitung fehlgeschlagen' };
  }
}

/**
 * Clear draft_contact from patient metadata after successful processing
 */
export async function clearDraftContact(patientId: string): Promise<void> {
  try {
    const { data: person } = await supabaseServer
      .from('people')
      .select('metadata')
      .eq('id', patientId)
      .single();

    if (person?.metadata) {
      const clearedMeta = { ...(person.metadata as Record<string, unknown>) };
      delete clearedMeta['draft_contact'];
      await supabaseServer
        .from('people')
        .update({ metadata: clearedMeta })
        .eq('id', patientId);
    }
  } catch {
    // Non-blocking
  }
}
