import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';

export const runtime = 'nodejs';

function getErrorMessage(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return undefined;
}

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
      landing_page?: string | null;
    };

    let person: PersonRow | null = null;
    let error: unknown = null;
    try {
      const res = await supabaseServer
        .from('people')
        .select('id,email,status,metadata,campaign_source,campaign_variant,landing_page')
        .eq('id', id)
        .single<PersonRow>();
      person = (res.data as PersonRow) ?? null;
      error = res.error;
      const msg = getErrorMessage(res.error);
      if (msg && msg.includes('schema cache')) {
        // Retry without optional columns (campaign_source/variant/landing_page)
        const res2 = await supabaseServer
          .from('people')
          .select('id,email,status,metadata')
          .eq('id', id)
          .single<Pick<PersonRow, 'id' | 'email' | 'status' | 'metadata'>>();
        person = (res2.data as PersonRow) ?? null;
        error = res2.error;
      }
    } catch (e) {
      error = e;
    }

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

    // Update status -> 'email_confirmed' and clear token
    const newMetadata: Record<string, unknown> = { ...metadata };
    delete newMetadata['confirm_token'];
    delete newMetadata['confirm_sent_at'];
    newMetadata['confirmed_at'] = new Date().toISOString();

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ status: 'email_confirmed', metadata: newMetadata })
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
          landing_page: person.landing_page || null,
          elapsed_seconds: elapsed,
        },
      });
    } catch {}

    // Enhanced Conversions moved to preferences submission when status becomes 'new'

    // Success: go straight to preferences to keep the flow seamless (EARTH-149)
    return NextResponse.redirect(`${BASE_URL}/preferences?confirm=1&id=${id}`, 302);
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${BASE_URL}/confirm?state=error`, 302);
  }
}
