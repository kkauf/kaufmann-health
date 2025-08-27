import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createHash } from 'crypto';
import { TERMS_VERSION } from '@/content/therapist-terms';

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

const SPEC_NAME_MAP: Record<string, string> = {
  'narm': 'NARM',
  'core-energetics': 'Core Energetics',
  'hakomi': 'Hakomi',
  'somatic-experiencing': 'Somatic Experiencing',
};

// Cities with active lead distribution
const ACTIVE_CITIES = new Set(['berlin']);

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

type NotificationRow = {
  name?: string | null;
  email: string;
  phone?: string | null;
  metadata?: {
    notes?: string;
    city?: string;
    issue?: string;
    availability?: string;
    budget?: string;
    specializations?: string[];
    session_preference?: 'online' | 'in_person';
    ip?: string;
    user_agent?: string;
    // New (EARTH-19)
    lead_type?: 'patient' | 'therapist';
    qualification?: string;
    experience?: string;
    website?: string;
    funnel_type?: string;
  } | null;
};

function hashIP(ip: string) {
  try {
    const salt = process.env.IP_HASH_SALT || '';
    return createHash('sha256').update(`${salt}${ip}`).digest('hex');
  } catch {
    // Fallback: return raw IP if hashing fails (should not happen in Node runtime)
    return ip;
  }
}

async function sendTherapistWelcomeEmail(therapistData: {
  name?: string | null;
  email: string;
  city?: string | null;
}) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const fromAddress = process.env.LEADS_FROM_EMAIL || 'kontakt@kaufmann-health.de';
    const isActiveCity = ACTIVE_CITIES.has((therapistData.city || '').toLowerCase());

    const leadStatusMessage = isActiveCity
      ? 'Sie können ab sofort Klienten-Anfragen über unser Verzeichnis erhalten.'
      : `Kaufmann Health startet bald in ${therapistData.city || 'Ihrer Stadt'}. Wir melden uns, sobald wir live sind.`;

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Willkommen bei Kaufmann Health</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F3F4F6;">
    <div style="max-width:640px; margin:0 auto; padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #E5E7EB;">
        <tr>
          <td style="padding:20px 24px; background:#111827;">
            <div style="color:#fff; font-weight:600; font-size:16px;">Kaufmann Health</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px; font-family: Arial, sans-serif; line-height:1.6; color:#374151;">
            <h1 style="color:#111827; font-size:22px; margin:0 0 12px;">Willkommen bei Kaufmann Health!</h1>
            <p style="margin:0 0 12px;">Hallo${therapistData.name ? ` ${therapistData.name}` : ''},</p>
            <p style="margin:0 0 12px;">vielen Dank für Ihre Registrierung in unserem Therapeuten-Verzeichnis. Ihr Vertrag ist ab sofort aktiv.</p>
            <p style="margin:0 0 16px;"><strong>${leadStatusMessage}</strong></p>

            <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 20px 0;">
              <h3 style="margin:0 0 8px; color:#111827; font-size:16px;">Nächste Schritte</h3>
              <p style="margin:0 0 8px;">Haben Sie Fragen zum Ablauf oder möchten Sie mehr über unser Verzeichnis erfahren?</p>
              <p style="margin:0 0 16px;">Buchen Sie gerne ein kurzes Kennenlernen mit uns:</p>
              <div style="text-align:center;">
                <a href="https://cal.com/kkauf/15min" style="display:inline-block; background-color:#111827; color:#ffffff; padding:10px 16px; border-radius:6px; text-decoration:none; font-weight:600;">Kennenlern-Call buchen</a>
              </div>
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 0;">
              <tr>
                <td style="vertical-align:top; padding-right:12px;">
                  <img src="https://kaufmann-health.de/profile-pictures/konstantin-kaufmann.jpg" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:1px solid #E5E7EB;" />
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-weight:600; color:#111827;">Konstantin Kaufmann</div>
                  <div style="color:#6B7280; font-size:14px;">Founder, Kaufmann Health</div>
                </td>
              </tr>
            </table>

            <p style="color:#6B7280; font-size:12px; margin-top:16px;">Antworten Sie gerne direkt auf diese Nachricht, falls Sie Rückfragen haben.</p>
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Kaufmann Health <${fromAddress}>`,
        to: [therapistData.email],
        subject: 'Willkommen bei Kaufmann Health',
        html: htmlContent,
      }),
    });
  } catch (e) {
    console.error('[welcome-email] Failed to send therapist welcome email', e);
  }
}

async function sendLeadNotification(row: NotificationRow) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.LEADS_NOTIFY_EMAIL;
    if (!apiKey || !to) return;
    const fromAddress = process.env.LEADS_FROM_EMAIL || 'kontakt@kaufmann-health.de';
    const isTherapist = row.metadata?.lead_type === 'therapist';
    const subject = isTherapist
      ? `New therapist registered: ${row.name || '-'}`
      : 'Neue Verzeichnis-Anfrage';
    const text = isTherapist
      ? [
          'New therapist registration',
          `Name: ${row.name || '-'}`,
          `Email: ${row.email}`,
          `Phone: ${row.phone || '-'}`,
          `Notes: ${row.metadata?.notes || '-'}`,
          `City: ${row.metadata?.city || '-'}`,
          `Issue: ${row.metadata?.issue || '-'}`,
          `Availability: ${row.metadata?.availability || '-'}`,
          `Budget: ${row.metadata?.budget || '-'}`,
          `Session Preference: ${row.metadata?.session_preference || '-'}`,
          `Specializations: ${row.metadata?.specializations?.map(s => SPEC_NAME_MAP[s] || s).join(', ') || '-'}`,
          `Type: ${row.metadata?.lead_type || '-'}`,
          `Qualification: ${row.metadata?.qualification || '-'}`,
          `Experience: ${row.metadata?.experience || '-'}`,
          `Website: ${row.metadata?.website || '-'}`,
          `IP: ${row.metadata?.ip || '-'}`,
          `UA: ${row.metadata?.user_agent || '-'}`,
          'Contract signed automatically',
        ].join('\n')
      : [
          'Neue Verzeichnis-Anfrage',
          'Hinweis: Personenbezogene Daten bitte ausschließlich in Supabase einsehen.',
        ].join('\n');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Leads <${fromAddress}>`,
        to: [to],
        subject,
        text,
      }),
    });
  } catch (e) {
    console.error('[notify] Failed to send email', e);
  }
}

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
      }
      // Fire-and-forget welcome email to therapist
      void sendTherapistWelcomeEmail({ name: data.name, email: data.email, city }).catch(() => {});
    }

    // Fire-and-forget notification (optional via env vars)
    void sendLeadNotification(inserted).catch(() => {});
    return NextResponse.json({ data: { id: inserted.id }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
