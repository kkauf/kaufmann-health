import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createHash } from 'crypto';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { ACTIVE_CITIES } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { buildInternalLeadNotification } from '@/lib/email/internalNotification';
import type { LeadType } from '@/lib/email/types';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';
import { renderPatientConfirmation } from '@/lib/email/templates/patientConfirmation';
import { logError, track } from '@/lib/logger';
import { parseAttributionFromRequest } from '@/lib/server-analytics';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/leads
 * @description Form handler for incoming lead submissions. Returns { data, error }.
 */

type LeadPayload = {
  name?: string;
  email: string;
  phone?: string;
  notes?: string;
  city?: string;
  issue?: string;
  availability?: string;
  budget?: string;
  specializations?: string[];
  session_preference?: 'online' | 'in_person';
  // New (EARTH-19): therapist applications
  type?: 'patient' | 'therapist';
  qualification?: string; // e.g., Heilpraktiker f. Psychotherapie, Approbation
  experience?: string; // free text (e.g., '2-4 Jahre')
  website?: string;
  terms_version?: string;
  // Optional client attribution (no cookies). Only used for event props, not stored in DB.
  session_id?: string;
};

function sanitize(v?: string) {
  if (!v) return undefined;
  return v.toString().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 1000);
}

// Allowed specializations (slugs)
const ALLOWED_SPECIALIZATIONS = [
  'narm',
  'core-energetics',
  'hakomi',
  'somatic-experiencing',
] as const;

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

// Internal notification type moved to email lib; inline type removed

function hashIP(ip: string) {
  try {
    const salt = process.env.IP_HASH_SALT || '';
    return createHash('sha256').update(`${salt}${ip}`).digest('hex');
  } catch {
    // Fallback: return raw IP if hashing fails (should not happen in Node runtime)
    return ip;
  }
}

// Inline email functions removed in favor of shared email library

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Partial<LeadPayload>;
    const email = sanitize(payload.email)?.toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ data: null, error: 'Invalid email' }, { status: 400 });
    }

    const data: LeadPayload = {
      name: sanitize(payload.name),
      email,
      phone: sanitize(payload.phone),
      notes: sanitize(payload.notes),
    };

    // Optional additional fields captured as metadata
    const city = sanitize(payload.city);
    const issue = sanitize(payload.issue);
    const availability = sanitize(payload.availability);
    const budget = sanitize(payload.budget);
    const sessionPreferenceRaw = sanitize(payload.session_preference as string | undefined);
    const sessionPreference: 'online' | 'in_person' | undefined =
      sessionPreferenceRaw === 'online' || sessionPreferenceRaw === 'in_person' ? sessionPreferenceRaw : undefined;
    const qualification = sanitize(payload.qualification);
    const experience = sanitize(payload.experience);
    const website = sanitize(payload.website);
    const leadType: 'patient' | 'therapist' = payload.type === 'therapist' ? 'therapist' : 'patient';
    const session_id = sanitize(payload.session_id);
    const specializations = Array.isArray(payload.specializations)
      ? payload.specializations
          .map((s) =>
            sanitize(s)
              ?.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
          )
          .filter((s): s is string => !!s && (ALLOWED_SPECIALIZATIONS as readonly string[]).includes(s))
      : [];

    // Basic IP-based rate limiting (60s window). Note: best-effort and
    // dependent on upstream "x-forwarded-for" headers.
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    if (ip) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: recentByIp, error: ipErr } = await supabaseServer
        .from('people')
        .select('id, created_at')
        .contains('metadata', { ip })
        .gte('created_at', cutoff)
        .limit(1);
      if (!ipErr && recentByIp && recentByIp.length > 0) {
        const attr = parseAttributionFromRequest(req);
        void track({
          type: 'lead_rate_limited',
          level: 'warn',
          source: 'api.leads',
          ip,
          ua,
          props: {
            city,
            ...(session_id ? { session_id } : {}),
            ...(attr.referrer ? { referrer: attr.referrer } : {}),
            ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
            ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
            ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
          },
        });
        return NextResponse.json({ data: null, error: 'Rate limited' }, { status: 429 });
      }
    }


    const { data: inserted, error } = await supabaseServer
      .from('people')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        type: leadType,
        status: 'new',
        metadata: {
          ...(data.notes ? { notes: data.notes } : {}),
          ...(city ? { city } : {}),
          ...(issue ? { issue } : {}),
          ...(availability ? { availability } : {}),
          ...(budget ? { budget } : {}),
          ...(sessionPreference ? { session_preference: sessionPreference } : {}),
          ...(specializations.length ? { specializations } : {}),
          ...(ip ? { ip } : {}),
          ...(ua ? { user_agent: ua } : {}),
          ...(qualification ? { qualification } : {}),
          ...(experience ? { experience } : {}),
          ...(website ? { website } : {}),
          lead_type: leadType,
          funnel_type: leadType === 'therapist' ? 'therapist_acquisition' : 'koerperpsychotherapie',
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      void logError('api.leads', error, { stage: 'insert_lead', lead_type: leadType, city }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to save lead' }, { status: 500 });
    }

    // For therapist submissions, record immediate contract acceptance (best-effort)
    if (leadType === 'therapist' && inserted?.id) {
      const { error: contractErr } = await supabaseServer
        .from('therapist_contracts')
        .insert({
          therapist_id: inserted.id,
          contract_version: TERMS_VERSION,
          ip_address: ip ? hashIP(ip) : null,
          user_agent: ua,
        });
      if (contractErr) {
        console.error('Supabase contract insert error:', contractErr);
        void logError('api.leads', contractErr, { stage: 'insert_contract', id: inserted.id }, ip, ua);
      }
      // Fire-and-forget welcome email to therapist (shared template)
      try {
        const isActiveCity = ACTIVE_CITIES.has((city || '').toLowerCase());
        const welcome = renderTherapistWelcome({
          name: data.name,
          city,
          isActiveCity,
          termsVersion: TERMS_VERSION,
        });
        void sendEmail({ to: data.email, subject: welcome.subject, html: welcome.html }).catch(() => {});
      } catch (e) {
        console.error('[welcome-email] Failed to render/send therapist welcome', e);
        void logError('api.leads', e, { stage: 'welcome_email' }, ip, ua);
      }
    }

    // For patient submissions, send confirmation email (best-effort, fire-and-forget)
    if (leadType === 'patient' && inserted?.id) {
      try {
        const confirmation = renderPatientConfirmation({
          name: data.name,
          city,
          issue,
          sessionPreference: sessionPreference ?? null,
        });
        void sendEmail({ to: data.email, subject: confirmation.subject, html: confirmation.html }).catch(() => {});
      } catch (e) {
        console.error('[patient-confirmation-email] Failed to render/send patient confirmation', e);
        void logError('api.leads', e, { stage: 'patient_confirmation_email' }, ip, ua);
      }
    }

    // Fire-and-forget internal notification (PII-free)
    try {
      const to = process.env.LEADS_NOTIFY_EMAIL;
      if (to) {
        const notif = buildInternalLeadNotification({
          id: inserted.id,
          metadata: inserted.metadata as unknown as { lead_type?: LeadType; city?: string | null } | null,
        });
        void sendEmail({ to, subject: notif.subject, text: notif.text }).catch(() => {});
      }
    } catch (e) {
      console.error('[notify] Failed to build/send notification', e);
      void logError('api.leads', e, { stage: 'notify' }, ip, ua);
    }
    // Track successful submission (PII-free)
    const attr = parseAttributionFromRequest(req);
    void track({
      type: 'lead_submitted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: {
        id: inserted.id,
        lead_type: leadType,
        city: city || null,
        has_specializations: specializations.length > 0,
        ...(session_id ? { session_id } : {}),
        ...(attr.referrer ? { referrer: attr.referrer } : {}),
        ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
        ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
        ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
      },
    });
    return NextResponse.json({ data: { id: inserted.id }, error: null });
  } catch (e) {
    void logError('api.leads', e, { stage: 'json_parse' }, undefined, req.headers.get('user-agent') || undefined);
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
