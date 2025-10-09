import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { VERIFICATION_MODE } from '@/lib/config';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';

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
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }

    type PersonRow = {
      id: string;
      email: string;
      name?: string | null;
      status?: string | null;
      metadata?: Record<string, unknown> | null;
      campaign_source?: string | null;
      campaign_variant?: string | null;
    };

    let person: PersonRow | null = null;
    let error: unknown = null;
    try {
      const res = await supabaseServer
        .from('people')
        .select('id,email,name,status,metadata,campaign_source,campaign_variant')
        .eq('id', id)
        .single<PersonRow>();
      person = (res.data as PersonRow) ?? null;
      error = res.error;
      const msg = getErrorMessage(res.error);
      if (msg && msg.includes('schema cache')) {
        // Retry without optional columns (campaign_source/variant)
        const res2 = await supabaseServer
          .from('people')
          .select('id,email,name,status,metadata')
          .eq('id', id)
          .single<Pick<PersonRow, 'id' | 'email' | 'status' | 'metadata'>>();
        person = (res2.data as PersonRow) ?? null;
        error = res2.error;
      }
    } catch (e) {
      error = e;
    }

    if (error || !person) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }

    // If the email has already been confirmed previously, but preferences may not be set yet,
    // send the user directly to the preferences screen instead of showing an invalid link.
    if ((person.status || '').toLowerCase() === 'email_confirmed') {
      // Set client session cookie so the user is treated as verified (EARTH-204)
      try {
        const token = await createClientSessionToken({
          patient_id: id,
          contact_method: 'email',
          contact_value: person.email.toLowerCase(),
          name: person.name || undefined,
        });
        const cookie = createClientSessionCookie(token);
        if (isSafeRedirect) {
          const hasQuery = redirectPath!.includes('?');
          const separator = hasQuery ? '&' : '?';
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
          const resp = NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
          resp.headers.set('Set-Cookie', cookie);
          return resp;
        }
        const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      } catch {
        if (isSafeRedirect) {
          const hasQuery = redirectPath!.includes('?');
          const separator = hasQuery ? '&' : '?';
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
          return NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
        }
        return NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
      }
    }

    const metadata: Record<string, unknown> = person.metadata ?? {};
    const stored = typeof metadata['confirm_token'] === 'string' ? (metadata['confirm_token'] as string) : '';
    if (!stored || stored !== token) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }

    // TTL: 24h
    const sentAtIso = typeof metadata['confirm_sent_at'] === 'string' ? (metadata['confirm_sent_at'] as string) : undefined;
    if (!sentAtIso) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }
    const sentAt = Date.parse(sentAtIso);
    if (Number.isNaN(sentAt) || Date.now() - sentAt > 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=expired`, 302);
    }

    // Update status -> 'email_confirmed' and clear token; stamp email_confirmed_at (keep confirmed_at for backward compatibility)
    const newMetadata: Record<string, unknown> = { ...metadata };
    delete newMetadata['confirm_token'];
    delete newMetadata['confirm_sent_at'];
    const nowIso = new Date().toISOString();
    newMetadata['confirmed_at'] = nowIso;
    newMetadata['email_confirmed_at'] = nowIso;

    // If the questionnaire was completed already, the lead is actionable: mark as 'new'.
    // Otherwise, keep the transitional 'email_confirmed' status.
    const formCompletedAt = typeof newMetadata['form_completed_at'] === 'string' ? (newMetadata['form_completed_at'] as string) : undefined;
    const formIsCompleted = !!(formCompletedAt && !Number.isNaN(Date.parse(formCompletedAt)));
    const nextStatus: 'email_confirmed' | 'new' = formIsCompleted ? 'new' : 'email_confirmed';

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ status: nextStatus, metadata: newMetadata })
      .eq('id', id);

    if (upErr) {
      await logError('api.leads.confirm', upErr, { stage: 'update_status' });
      return NextResponse.redirect(`${origin}/fragebogen?confirm=error`, 302);
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

    // Enhanced Conversions moved to preferences submission when status becomes 'new'

    // Success → set client session cookie (EARTH-204)
    try {
      const token = await createClientSessionToken({
        patient_id: id,
        contact_method: 'email',
        contact_value: person.email.toLowerCase(),
        name: person.name || undefined,
      });
      const cookie = createClientSessionCookie(token);
      if (isSafeRedirect) {
        const hasQuery = redirectPath!.includes('?');
        const separator = hasQuery ? '&' : '?';
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
        const resp = NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      }
      const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
      resp.headers.set('Set-Cookie', cookie);
      return resp;
    } catch {
      if (isSafeRedirect) {
        const hasQuery = redirectPath!.includes('?');
        const separator = hasQuery ? '&' : '?';
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
        return NextResponse.redirect(`${origin}${redirectPath}${suffix}`, 302);
      }
      return NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
    }
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${origin}/fragebogen?confirm=error`, 302);
  }
}
