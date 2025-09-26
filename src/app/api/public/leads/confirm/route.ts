import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { VERIFICATION_MODE } from '@/lib/config';

export const runtime = 'nodejs';

function getErrorMessage(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
  }
  return undefined;
}

export async function GET(req: Request) {
  const origin = (() => {
    try {
      return new URL(req.url).origin || BASE_URL;
    } catch {
      return BASE_URL;
    }
  })();
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    const id = url.searchParams.get('id') || '';
    const fs = url.searchParams.get('fs') || '';
    const redirectPath = url.searchParams.get('redirect');
    const isSafeRedirect = !!(redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('/api') && !redirectPath.startsWith('//'));
    if (!token || !id) {
      return NextResponse.redirect(`${origin}/confirm?state=invalid`, 302);
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
      return NextResponse.redirect(`${origin}/confirm?state=invalid`, 302);
    }

    // If the email has already been confirmed previously, but preferences may not be set yet,
    // send the user directly to the preferences screen instead of showing an invalid link.
    if ((person.status || '').toLowerCase() === 'email_confirmed') {
      if (isSafeRedirect) {
        const suffix = `?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
        return NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
      }
      return NextResponse.redirect(`${origin}/fragebogen/confirmed?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
    }

    const metadata: Record<string, unknown> = person.metadata ?? {};
    const stored = typeof metadata['confirm_token'] === 'string' ? (metadata['confirm_token'] as string) : '';
    if (!stored || stored !== token) {
      return NextResponse.redirect(`${origin}/confirm?state=invalid`, 302);
    }

    // TTL: 24h
    const sentAtIso = typeof metadata['confirm_sent_at'] === 'string' ? (metadata['confirm_sent_at'] as string) : undefined;
    if (!sentAtIso) {
      return NextResponse.redirect(`${origin}/confirm?state=invalid`, 302);
    }
    const sentAt = Date.parse(sentAtIso);
    if (Number.isNaN(sentAt) || Date.now() - sentAt > 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(`${origin}/confirm?state=expired`, 302);
    }

    // Update status -> 'email_confirmed' and clear token; stamp email_confirmed_at (keep confirmed_at for backward compatibility)
    const newMetadata: Record<string, unknown> = { ...metadata };
    delete newMetadata['confirm_token'];
    delete newMetadata['confirm_sent_at'];
    const nowIso = new Date().toISOString();
    newMetadata['confirmed_at'] = nowIso;
    newMetadata['email_confirmed_at'] = nowIso;

    // Decide final status based on VERIFICATION_MODE and whether form has been completed
    let nextStatus: 'email_confirmed' | 'active' = 'email_confirmed';
    const formCompletedAt = typeof newMetadata['form_completed_at'] === 'string' ? (newMetadata['form_completed_at'] as string) : undefined;
    const formIsCompleted = !!(formCompletedAt && !Number.isNaN(Date.parse(formCompletedAt)));
    // Email path confirms one channel. Activate if mode allows email-only activation and form is completed.
    if (formIsCompleted) {
      if (VERIFICATION_MODE === 'email' || VERIFICATION_MODE === 'choice') {
        nextStatus = 'active';
      }
      // VERIFICATION_MODE 'both' requires SMS as well; 'sms' requires SMS only.
    }

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ status: nextStatus, metadata: newMetadata })
      .eq('id', id);

    if (upErr) {
      await logError('api.leads.confirm', upErr, { stage: 'update_status' });
      return NextResponse.redirect(`${origin}/confirm?state=error`, 302);
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

    // Success
    if (isSafeRedirect) {
      const suffix = `?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
      return NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
    }
    return NextResponse.redirect(`${origin}/fragebogen/confirmed?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${origin}/confirm?state=error`, 302);
  }
}
