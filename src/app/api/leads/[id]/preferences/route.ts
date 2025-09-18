import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { googleAdsTracker } from '@/lib/google-ads';

export const runtime = 'nodejs';

function getIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const leadsIdx = parts.indexOf('leads');
    if (leadsIdx >= 0 && parts.length > leadsIdx + 1) {
      return decodeURIComponent(parts[leadsIdx + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

function getString(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object') return '';
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
}

function getBoolean(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const v = (obj as Record<string, unknown>)[key];
  return Boolean(v);
}

export async function POST(req: Request) {
  const id = getIdFromUrl(req.url);
  if (!id) return NextResponse.json({ data: null, error: 'Missing id' }, { status: 400 });

  try {
    type Person = { id: string; email?: string | null; type?: string | null; metadata?: Record<string, unknown> | null };
    const { data: person, error } = await supabaseServer
      .from('people')
      .select('id,email,type,metadata')
      .eq('id', id)
      .single<Person>();

    if (error || !person) {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    if ((person.type || '').toLowerCase() !== 'patient') {
      return NextResponse.json({ data: null, error: 'Invalid lead type' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
    }

    const name = getString(body, 'name');
    const city = getString(body, 'city');
    const issue = getString(body, 'issue');
    const sessionPref = getString(body, 'session_preference');
    const consent = getBoolean(body, 'consent_share_with_therapists');
    const privacyVersion = getString(body, 'privacy_version');

    if (!city) {
      return NextResponse.json({ data: null, error: 'Missing fields' }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ data: null, error: 'Einwilligung zur Datenübertragung erforderlich' }, { status: 400 });
    }

    const metadata: Record<string, unknown> = { ...(person.metadata || {}) };
    metadata.city = city;
    if (issue) metadata.issue = issue;
    if (sessionPref === 'online' || sessionPref === 'in_person') {
      metadata.session_preference = sessionPref;
    }
    metadata.consent_share_with_therapists = true;
    metadata.consent_share_with_therapists_at = new Date().toISOString();
    if (privacyVersion) metadata.consent_privacy_version = privacyVersion;

    const updatePayload: Record<string, unknown> = { status: 'new', metadata };
    if (name) updatePayload.name = name;

    const { data, error: upErr } = await supabaseServer
      .from('people')
      .update(updatePayload)
      .eq('id', id);

    if (upErr) {
      await logError('api.leads.preferences', upErr, { stage: 'update', id });
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    try {
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'preferences_submitted',
        source: 'api.leads.preferences',
        props: {},
      });
    } catch {}

    // Fire Enhanced Conversions now that the lead is active (status='new')
    try {
      const email = person.email || '';
      if (email) {
        await googleAdsTracker.trackConversion({
          email,
          conversionAction: 'patient_registration',
          conversionValue: 10,
          orderId: id,
        });
      }
    } catch (e) {
      await logError('api.leads.preferences', e, { stage: 'google_ads_conversion', id });
    }

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('api.leads.preferences', e, { stage: 'unhandled' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
