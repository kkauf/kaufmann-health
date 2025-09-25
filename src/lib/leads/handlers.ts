import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { ACTIVE_CITIES } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { buildInternalLeadNotification } from '@/lib/email/internalNotification';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';
import { BASE_URL } from '@/lib/constants';
import { renderPatientConfirmation } from '@/lib/email/templates/patientConfirmation';
import { logError, track } from '@/lib/logger';
import { googleAdsTracker } from '@/lib/google-ads';
import { parseAttributionFromRequest, parseCampaignFromRequest } from '@/lib/server-analytics';
import { hashIP } from './validation';
import { isTestRequest } from '@/lib/test-mode';
import type { HandlerContext } from './types';

export type PatientHandlerInput = {
  data: { name?: string; email: string; phone?: string; notes?: string };
  city?: string;
  issue?: string;
  availability?: string;
  budget?: string;
  sessionPreference?: 'online' | 'in_person';
  sessionPreferences: ('online' | 'in_person')[];
  specializations: string[];
  genderPreference?: 'male' | 'female' | 'no_preference';
  consentShare: boolean;
  privacyVersion?: string;
  session_id?: string;
};

export type TherapistHandlerInput = {
  data: { name?: string; email: string; phone?: string; notes?: string };
  city?: string;
  sessionPreferences: ('online' | 'in_person')[];
  specializations: string[];
  session_id?: string;
};

export async function handlePatientLead(ctx: HandlerContext, input: PatientHandlerInput) {
  const { req, ip, ua } = ctx;
  const {
    data,
    city,
    issue,
    availability,
    budget,
    sessionPreference,
    sessionPreferences,
    specializations,
    genderPreference,
    consentShare,
    privacyVersion,
    session_id,
  } = input;

  // Campaign parsing (first-party)
  const campaign = parseCampaignFromRequest(req);
  const isTest = isTestRequest(req, data.email);

  const res = await supabaseServer
    .from('people')
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone,
      type: 'patient',
      status: 'new',
      campaign_source: campaign.campaign_source,
      campaign_variant: campaign.campaign_variant,
      landing_page: campaign.landing_page,
      metadata: {
        ...(isTest ? { is_test: true } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        ...(city ? { city } : {}),
        ...(issue ? { issue } : {}),
        ...(availability ? { availability } : {}),
        ...(budget ? { budget } : {}),
        ...(sessionPreference ? { session_preference: sessionPreference } : {}),
        ...(sessionPreferences.length ? { session_preferences: sessionPreferences } : {}),
        ...(specializations.length ? { specializations } : {}),
        ...(genderPreference ? { gender_preference: genderPreference } : {}),
        ...(ip ? { ip } : {}),
        ...(ua ? { user_agent: ua } : {}),
        ...(consentShare
          ? {
              consent_share_with_therapists: true,
              consent_share_with_therapists_at: new Date().toISOString(),
              ...(privacyVersion ? { consent_privacy_version: privacyVersion } : {}),
            }
          : {}),
        funnel_type: 'koerperpsychotherapie',
        submitted_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  const inserted = (res.data as unknown as { id: string }) || null;
  const error = res.error;

  if (error) {
    console.error('Supabase error:', error);
    void logError('api.leads', error, { stage: 'insert_lead', lead_type: 'patient', city }, ip, ua);
    return NextResponse.json(
      { data: null, error: 'Failed to save lead' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (inserted?.id) {
    // Confirmation email (best-effort)
    try {
      const confirmation = renderPatientConfirmation({
        name: data.name,
        city,
        issue,
        sessionPreference: sessionPreference ?? null,
      });
      void track({
        type: 'email_attempted',
        level: 'info',
        source: 'api.leads',
        ip,
        ua,
        props: {
          stage: 'patient_confirmation',
          lead_id: inserted.id,
          lead_type: 'patient',
          subject: confirmation.subject,
          ...(session_id ? { session_id } : {}),
        },
      });
      await sendEmail({
        to: data.email,
        subject: confirmation.subject,
        html: confirmation.html,
        context: { stage: 'patient_confirmation', lead_id: inserted.id, lead_type: 'patient', ...(session_id ? { session_id } : {}) },
      });
    } catch (e) {
      console.error('[patient-confirmation-email] Failed to render/send patient confirmation', e);
      void logError('api.leads', e, { stage: 'patient_confirmation_email' }, ip, ua);
    }

    // Google Ads conversion (legacy flow only). In email-only mode (EARTH-146), this fires later at POST /api/leads/:id/preferences.
    if (process.env.REQUIRE_EMAIL_CONFIRMATION === 'false' && !isTest) {
      try {
        const conversionActionAlias = 'client_registration';
        const value = 10;
        void track({
          type: 'google_ads_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: { action: conversionActionAlias, order_id: inserted.id, lead_type: 'patient', value, ...(session_id ? { session_id } : {}) },
        });
        const gaPromise = googleAdsTracker.trackConversion({
          email: data.email,
          conversionAction: conversionActionAlias,
          conversionValue: value,
          orderId: inserted.id,
        });
        let gaDone = false;
        gaPromise.then(
          () => {
            gaDone = true;
          },
          async (err) => {
            gaDone = true;
            void logError('api.leads', err, { stage: 'google_ads_conversion' }, ip, ua);
          },
        );
        const waitMs = Number(process.env.GOOGLE_ADS_WAIT_MS ?? (process.env.NODE_ENV === 'development' ? 500 : 0));
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
          if (!gaDone) {
            void track({
              type: 'google_ads_deferred',
              level: 'info',
              source: 'api.leads',
              ip,
              ua,
              props: { action: conversionActionAlias, order_id: inserted.id, lead_type: 'patient', value, timeout_ms: waitMs, ...(session_id ? { session_id } : {}) },
            });
          }
        }
      } catch (e) {
        void logError('api.leads', e, { stage: 'google_ads_conversion', lead_type: 'patient' }, ip, ua);
      }
    }

    // Internal notification (PII-free)
    try {
      const to = process.env.LEADS_NOTIFY_EMAIL;
      if (to) {
        const notif = buildInternalLeadNotification({ id: inserted.id, metadata: { lead_type: 'patient', city: city ?? null } });
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: { stage: 'internal_notification', lead_id: inserted.id, lead_type: 'patient', subject: notif.subject, ...(session_id ? { session_id } : {}) },
        });
        void sendEmail({ to, subject: notif.subject, text: notif.text, context: { stage: 'internal_notification', lead_id: inserted.id, lead_type: 'patient', ...(session_id ? { session_id } : {}) } }).catch(() => {});
      } else {
        void track({ type: 'notify_skipped', level: 'warn', source: 'api.leads', ip, ua, props: { reason: 'missing_recipient', lead_id: inserted.id, lead_type: 'patient', ...(session_id ? { session_id } : {}) } });
      }
    } catch (e) {
      console.error('[notify] Failed to build/send notification', e);
      void logError('api.leads', e, { stage: 'notify' }, ip, ua);
    }

    // Track successful submission
    const attr = parseAttributionFromRequest(req);
    void track({
      type: 'lead_submitted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: {
        id: inserted.id,
        lead_type: 'patient',
        city: city || null,
        has_specializations: specializations.length > 0,
        campaign_source: campaign.campaign_source || null,
        campaign_variant: campaign.campaign_variant || null,
        landing_page: campaign.landing_page || null,
        is_test: isTest,
        ...(session_id ? { session_id } : {}),
        ...(attr.referrer ? { referrer: attr.referrer } : {}),
        ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
        ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
        ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
      },
    });
  }

  return NextResponse.json(
    { data: { id: inserted!.id }, error: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function handleTherapistLead(ctx: HandlerContext, input: TherapistHandlerInput) {
  const { req, ip, ua } = ctx;
  const { data, city, sessionPreferences, specializations, session_id } = input;
  const isTest = isTestRequest(req, data.email);

  const fullName = (data.name || '').trim();
  const first_name = fullName ? fullName.split(/\s+/)[0] : null;
  const last_name = fullName ? fullName.replace(/^\S+\s*/, '').trim() || null : null;
  const modalities = specializations;

  const { data: ins, error: err } = await supabaseServer
    .from('therapists')
    .insert({
      first_name,
      last_name,
      email: data.email,
      phone: data.phone,
      city: city || null,
      session_preferences: sessionPreferences,
      modalities,
      status: 'pending_verification',
      ...(isTest ? { metadata: { is_test: true } as Record<string, unknown> } : {}),
    })
    .select('id')
    .single();

  if (err || !ins?.id) {
    console.error('Supabase error:', err);
    void logError('api.leads', err, { stage: 'insert_lead', lead_type: 'therapist', city }, ip, ua);
    return NextResponse.json(
      { data: null, error: 'Failed to save lead' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const therapistId = (ins as unknown as { id: string }).id;

  // Contract (best-effort) + welcome email
  try {
    const { error: contractErr } = await supabaseServer
      .from('therapist_contracts')
      .insert({ therapist_id: therapistId, contract_version: TERMS_VERSION, ip_address: ip ? hashIP(ip) : null, user_agent: ua });
    if (contractErr) {
      console.error('Supabase contract insert error:', contractErr);
      void logError('api.leads', contractErr, { stage: 'insert_contract', id: therapistId }, ip, ua);
    }
    const isActiveCity = ACTIVE_CITIES.has((city || '').toLowerCase());
    const uploadUrl = `${BASE_URL}/therapists/complete-profile/${therapistId}`;
    const welcome = renderTherapistWelcome({ name: data.name, city, isActiveCity, termsVersion: TERMS_VERSION, uploadUrl });
    void track({ type: 'email_attempted', level: 'info', source: 'api.leads', ip, ua, props: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist', subject: welcome.subject, ...(session_id ? { session_id } : {}) } });
    await sendEmail({ to: data.email, subject: welcome.subject, html: welcome.html, context: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist', ...(session_id ? { session_id } : {}) } });
  } catch (e) {
    console.error('[welcome-email] Failed to render/send therapist welcome', e);
    void logError('api.leads', e, { stage: 'welcome_email' }, ip, ua);
  }

  // Google Ads conversion moved to documents submission endpoint (see /api/therapists/:id/documents)

  // Internal notification (PII-free)
  try {
    const to = process.env.LEADS_NOTIFY_EMAIL;
    if (to) {
      const notif = buildInternalLeadNotification({ id: therapistId, metadata: { lead_type: 'therapist', city: city ?? null } });
      void track({ type: 'email_attempted', level: 'info', source: 'api.leads', ip, ua, props: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist', subject: notif.subject, ...(session_id ? { session_id } : {}) } });
      void sendEmail({ to, subject: notif.subject, text: notif.text, context: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist', ...(session_id ? { session_id } : {}) } }).catch(() => {});
    } else {
      void track({ type: 'notify_skipped', level: 'warn', source: 'api.leads', ip, ua, props: { reason: 'missing_recipient', lead_id: therapistId, lead_type: 'therapist', ...(session_id ? { session_id } : {}) } });
    }
  } catch (e) {
    console.error('[notify] Failed to build/send notification', e);
    void logError('api.leads', e, { stage: 'notify' }, ip, ua);
  }

  // Track successful submission
  const attr = parseAttributionFromRequest(req);
  const campaign = parseCampaignFromRequest(req);
  void track({
    type: 'lead_submitted',
    level: 'info',
    source: 'api.leads',
    ip,
    ua,
    props: {
      id: therapistId,
      lead_type: 'therapist',
      city: city || null,
      has_specializations: specializations.length > 0,
      is_test: isTest,
      campaign_source: campaign.campaign_source || null,
      campaign_variant: campaign.campaign_variant || null,
      landing_page: campaign.landing_page || null,
      ...(session_id ? { session_id } : {}),
      ...(attr.referrer ? { referrer: attr.referrer } : {}),
      ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
      ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
      ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
    },
  });

  return NextResponse.json(
    { data: { id: therapistId }, error: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
