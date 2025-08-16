import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

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
    ip?: string;
    user_agent?: string;
  } | null;
};

async function sendLeadNotification(row: NotificationRow) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.LEADS_NOTIFY_EMAIL;
    if (!apiKey || !to) return;
    const fromAddress = process.env.LEADS_FROM_EMAIL || 'no-reply@kaufmann-health.de';
    const text = [
      `New lead received`,
      `Name: ${row.name || '-'}`,
      `Email: ${row.email}`,
      `Phone: ${row.phone || '-'}`,
      `Notes: ${row.metadata?.notes || '-'}`,
      `City: ${row.metadata?.city || '-'}`,
      `Issue: ${row.metadata?.issue || '-'}`,
      `Availability: ${row.metadata?.availability || '-'}`,
      `Budget: ${row.metadata?.budget || '-'}`,
      `Specializations: ${row.metadata?.specializations?.map(s => SPEC_NAME_MAP[s] || s).join(', ') || '-'}`,
      `IP: ${row.metadata?.ip || '-'}`,
      `UA: ${row.metadata?.user_agent || '-'}`,
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
        subject: 'New lead submission',
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
    const specializations = Array.isArray(payload.specializations)
      ? payload.specializations
          .map((s) => sanitize(s)?.toLowerCase().replace(/\s+/g, '-'))
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
        type: 'patient',
        status: 'new',
        metadata: {
          ...(data.notes ? { notes: data.notes } : {}),
          ...(city ? { city } : {}),
          ...(issue ? { issue } : {}),
          ...(availability ? { availability } : {}),
          ...(budget ? { budget } : {}),
          ...(specializations.length ? { specializations } : {}),
          ...(ip ? { ip } : {}),
          ...(ua ? { user_agent: ua } : {}),
          funnel_type: 'koerperpsychotherapie',
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ data: null, error: 'Failed to save lead' }, { status: 500 });
    }

    // Fire-and-forget notification (optional via env vars)
    void sendLeadNotification(inserted).catch(() => {});
    return NextResponse.json({ data: { id: inserted.id }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
