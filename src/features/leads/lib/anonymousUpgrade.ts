import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { logError, track } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';
import { ServerAnalytics } from '@/lib/server-analytics';
import { createInstantMatchesForPatient } from '@/features/leads/lib/match';
import { safeJson } from '@/lib/http';
import type { LeadPayload } from '@/features/leads/lib/types';

export type AnonymousUpgradeOpts = {
  anonymousPatientId: string;
  baseMetadata: Record<string, unknown>;
  data: LeadPayload;
  email: string | undefined;
  phoneNumber: string | undefined;
  cookieVerifiedPhone: boolean;
  campaign_source: string | undefined;
  campaign_variant: string | undefined;
  contactMethod: 'email' | 'phone' | undefined;
  confirmToken: string;
  formSessionId: string | undefined;
  confirmRedirectPath: string | undefined;
  isTest: boolean;
  ip: string | undefined;
  ua: string | undefined;
  req: Request;
};

/**
 * Upgrades an anonymous patient record (from questionnaire) to a full lead
 * with contact info. Returns a Response if successful, or null to fall through
 * to the normal insert flow.
 */
export async function handleAnonymousUpgrade(opts: AnonymousUpgradeOpts): Promise<Response | null> {
  const {
    anonymousPatientId, baseMetadata, data, email, phoneNumber,
    cookieVerifiedPhone, campaign_source, campaign_variant, contactMethod,
    confirmToken, formSessionId, confirmRedirectPath, isTest, ip, ua, req,
  } = opts;

  const { data: anonPatient } = await supabaseServer
    .from('people')
    .select('id, status, type, metadata')
    .eq('id', anonymousPatientId)
    .eq('type', 'patient')
    .eq('status', 'anonymous')
    .maybeSingle<{
      id: string;
      status: string;
      type: string;
      metadata: Record<string, unknown> | null;
    }>();

  if (!anonPatient) return null;

  const mergedMeta = { ...(anonPatient.metadata || {}), ...baseMetadata };
  const newStatus = cookieVerifiedPhone ? 'new' : 'pre_confirmation';

  const { error: upgradeErr } = await supabaseServer
    .from('people')
    .update({
      ...(data.name ? { name: data.name } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      status: newStatus,
      metadata: mergedMeta,
      ...(campaign_source ? { campaign_source } : {}),
      ...(campaign_variant ? { campaign_variant } : {}),
    })
    .eq('id', anonPatient.id);

  if (upgradeErr) return null;

  void track({
    type: 'anonymous_patient_upgraded',
    level: 'info',
    source: 'api.leads',
    ip,
    ua,
    props: {
      patient_id: anonPatient.id,
      contact_method: contactMethod,
      new_status: newStatus,
    },
  });

  // Send confirmation email if email-based
  if (email) {
    try {
      const origin = new URL(req.url).origin || BASE_URL;
      const confirmBase = `${origin}/api/public/leads/confirm?token=${encodeURIComponent(confirmToken)}&id=${encodeURIComponent(anonPatient.id)}`;
      const withFs = formSessionId
        ? `${confirmBase}&fs=${encodeURIComponent(formSessionId)}`
        : confirmBase;
      const confirmUrl = confirmRedirectPath
        ? `${withFs}&redirect=${encodeURIComponent(confirmRedirectPath)}`
        : withFs;
      const emailContent = renderEmailConfirmation({ confirmUrl });
      const emailResult = await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        replyTo: 'kontakt@kaufmann-health.de',
        context: {
          stage: 'email_confirmation',
          lead_id: anonPatient.id,
          lead_type: 'patient',
          template: 'email_confirmation',
          email_token: confirmToken,
        },
      });
      if (!emailResult.sent && emailResult.reason === 'failed') {
        await logError(
          'api.leads',
          new Error('Confirmation email send failed'),
          { stage: 'email_confirmation_send_failed', lead_id: anonPatient.id, email },
          ip,
          ua,
        );
      }
    } catch (e) {
      void logError('api.leads', e, { stage: 'email_confirmation_email' }, ip, ua);
    }
  }

  // Create instant matches (patient already has preferences from questionnaire)
  const skipAutoMatch = campaign_variant === 'concierge';
  if (!skipAutoMatch) {
    const matchResult = await createInstantMatchesForPatient(
      anonPatient.id,
      campaign_variant || undefined,
    );
    if (matchResult) {
      try {
        const freshMeta =
          (await supabaseServer
            .from('people')
            .select('metadata')
            .eq('id', anonPatient.id)
            .single()
          ).data?.metadata || {};
        await supabaseServer
          .from('people')
          .update({
            metadata: {
              ...(freshMeta as Record<string, unknown>),
              last_confirm_redirect_path: matchResult.matchesUrl,
            },
          })
          .eq('id', anonPatient.id);
      } catch {
        /* Non-blocking */
      }
    }
  }

  await ServerAnalytics.trackEventFromRequest(req, {
    type: 'contact_submitted',
    source: 'api.leads',
    props: {
      campaign_source,
      campaign_variant,
      requires_confirmation: !cookieVerifiedPhone,
      is_test: isTest,
      contact_method: contactMethod,
      upgraded_from_anonymous: true,
    },
  });

  return safeJson(
    {
      data: { id: anonPatient.id, requiresConfirmation: !cookieVerifiedPhone },
      error: null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
