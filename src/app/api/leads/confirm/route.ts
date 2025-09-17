import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { googleAdsTracker } from '@/lib/google-ads';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    const id = url.searchParams.get('id') || '';
    if (!token || !id) {
      return NextResponse.redirect(`${BASE_URL}/confirm?state=invalid`, 302);
    }

    type PersonRow = {
      id: string;
      email: string;
      status?: string | null;
      metadata?: Record<string, unknown> | null;
      campaign_source?: string | null;
      campaign_variant?: string | null;
    };

    const { data: person, error } = await supabaseServer
      .from('people')
      .select('id,email,status,metadata,campaign_source,campaign_variant')
      .eq('id', id)
      .single<PersonRow>();

    if (error || !person) {
      return NextResponse.redirect(`${BASE_URL}/confirm?state=invalid`, 302);
    }

    const metadata: Record<string, unknown> = person.metadata ?? {};
    const stored = typeof metadata['confirm_token'] === 'string' ? (metadata['confirm_token'] as string) : '';
    if (!stored || stored !== token) {
      return NextResponse.redirect(`${BASE_URL}/confirm?state=invalid`, 302);
    }

    // TTL: 24h
    const sentAtIso = typeof metadata['confirm_sent_at'] === 'string' ? (metadata['confirm_sent_at'] as string) : undefined;
    if (!sentAtIso) {
      return NextResponse.redirect(`${BASE_URL}/confirm?state=invalid`, 302);
    }
    const sentAt = Date.parse(sentAtIso);
    if (Number.isNaN(sentAt) || Date.now() - sentAt > 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(`${BASE_URL}/confirm?state=expired`, 302);
    }

    // Update status -> 'new' and clear token
    const newMetadata: Record<string, unknown> = { ...metadata };
    delete newMetadata['confirm_token'];
    delete newMetadata['confirm_sent_at'];
    newMetadata['confirmed_at'] = new Date().toISOString();

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ status: 'new', metadata: newMetadata })
      .eq('id', id);

    if (upErr) {
      await logError('api.leads.confirm', upErr, { stage: 'update_status' });
      return NextResponse.redirect(`${BASE_URL}/confirm?state=error`, 302);
    }

    // Analytics: email_confirmed
    try {
      const elapsed = Math.floor((Date.now() - sentAt) / 1000);
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'email_confirmed',
        source: 'api.leads.confirm',
        props: {
          campaign_source: person.campaign_source || null,
          campaign_variant: person.campaign_variant || null,
          elapsed_seconds: elapsed,
        },
      });
    } catch {}

    // Fire Enhanced Conversions for patient registration AFTER confirmation
    try {
      const email = person.email;
      const orderId = person.id;
      const conversionActionAlias = 'patient_registration';
      const value = 10;
      await googleAdsTracker.trackConversion({
        email,
        conversionAction: conversionActionAlias,
        conversionValue: value,
        orderId,
      });
    } catch (e) {
      await logError('api.leads.confirm', e, { stage: 'google_ads_conversion' });
    }

    // Success: redirect to public confirmation page (EARTH-159)
    return NextResponse.redirect(`${BASE_URL}/confirm?state=success`, 302);
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${BASE_URL}/confirm?state=error`, 302);
  }
}
