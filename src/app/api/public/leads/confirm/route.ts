import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
// NOTE: maybeFirePatientConversion is now triggered by the CLIENT after redirect
// via fireLeadVerifiedWithEnhancement(). This ensures the gtag base conversion fires
// BEFORE the server-side enhancement, which is required for Google Ads matching.
// sendEmail imported but used conditionally
import { sendEmail as _sendEmail } from '@/lib/email/client';
import { processDraftContact, clearDraftContact } from '@/features/leads/lib/processDraftContact';
import { LeadConfirmQuery } from '@/contracts/leads';

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
    const sessionIdHeader = req.headers.get('x-session-id') || undefined;
    const url = new URL(req.url);
    const parsed = LeadConfirmQuery.safeParse({
      token: url.searchParams.get('token') || undefined,
      id: url.searchParams.get('id') || undefined,
      fs: url.searchParams.get('fs') || undefined,
      redirect: url.searchParams.get('redirect') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }
    const token = parsed.data.token;
    const id = parsed.data.id;
    const fs = parsed.data.fs || '';
    const redirectPath = parsed.data.redirect;
    const isSafeRedirect = !!redirectPath;

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
        // Retry with campaign_source/variant in select (they should exist in production)
        const res2 = await supabaseServer
          .from('people')
          .select('id,email,name,status,metadata,campaign_source,campaign_variant')
          .eq('id', id)
          .single<PersonRow>();
        person = (res2.data as PersonRow) ?? null;
        error = res2.error;
      }
    } catch (e) {
      error = e;
    }

    if (error || !person) {
      return NextResponse.redirect(`${origin}/fragebogen?confirm=invalid`, 302);
    }

    // Resolve an effective redirect path: prefer query param if safe; otherwise fallback to stored metadata value
    const personMeta: Record<string, unknown> = (person.metadata ?? {}) as Record<string, unknown>;
    const storedRedirectRaw = typeof personMeta['last_confirm_redirect_path'] === 'string' ? (personMeta['last_confirm_redirect_path'] as string) : undefined;
    const storedRedirectSafe = !!(storedRedirectRaw && storedRedirectRaw.startsWith('/') && !storedRedirectRaw.startsWith('/api') && !storedRedirectRaw.startsWith('//'));
    const effectiveRedirect = isSafeRedirect ? redirectPath! : (storedRedirectSafe ? storedRedirectRaw! : undefined);

    const personDraftContact = (personMeta?.['draft_contact'] as Record<string, unknown> | undefined) || undefined;
    const personFormCompletedAt = typeof personMeta['form_completed_at'] === 'string' ? (personMeta['form_completed_at'] as string) : undefined;
    const personFormIsCompleted = !!(personFormCompletedAt && !Number.isNaN(Date.parse(personFormCompletedAt)));
    const personHasDraftAction = !!personDraftContact;
    const redirectSuggestsDraftAction = !!(
      storedRedirectRaw &&
      storedRedirectRaw.startsWith('/therapeuten') &&
      storedRedirectRaw.includes('contact=compose')
    );

    // If the email has already been confirmed previously (or the lead is already actionable as 'new'),
    // send the user directly back to the intended UI context instead of showing an invalid link.
    const statusLower = (person.status || '').toLowerCase();
    if (statusLower === 'email_confirmed' || statusLower === 'new') {
      // If this lead is actionable (directory draft action or completed questionnaire), promote to 'new'
      // so admin views treat it as verified/actionable.
      if (statusLower === 'email_confirmed' && (personHasDraftAction || personFormIsCompleted || redirectSuggestsDraftAction)) {
        try {
          await supabaseServer
            .from('people')
            .update({ status: 'new' })
            .eq('id', id);
        } catch {}
      }
      // Set client session cookie so the user is treated as verified (EARTH-204)
      // Preserve variant for correct confirmation screen (concierge vs self-service)
      const earlyVariantParam = person.campaign_variant ? `&variant=${encodeURIComponent(person.campaign_variant)}` : '';
      try {
        const token = await createClientSessionToken({
          patient_id: id,
          contact_method: 'email',
          contact_value: person.email.toLowerCase(),
          name: person.name || undefined,
        });
        const cookie = createClientSessionCookie(token);
        if (effectiveRedirect) {
          const hasQuery = effectiveRedirect.includes('?');
          const separator = hasQuery ? '&' : '?';
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${earlyVariantParam}`;
          const resp = NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
          resp.headers.set('Set-Cookie', cookie);
          return resp;
        }
        const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${earlyVariantParam}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      } catch {
        if (effectiveRedirect) {
          const hasQuery = effectiveRedirect.includes('?');
          const separator = hasQuery ? '&' : '?';
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${earlyVariantParam}`;
          return NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
        }
        return NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${earlyVariantParam}`, 302);
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

    // Read draft_contact if present (therapist directory flow). Do NOT remove yet; only clear after successful processing.
    const draftContact = (metadata?.['draft_contact'] as Record<string, unknown> | undefined) || undefined;
    // If the questionnaire was completed already, the lead is actionable: mark as 'new'.
    // Otherwise, keep the transitional 'email_confirmed' status.
    const formCompletedAt = typeof newMetadata['form_completed_at'] === 'string' ? (newMetadata['form_completed_at'] as string) : undefined;
    const formIsCompleted = !!(formCompletedAt && !Number.isNaN(Date.parse(formCompletedAt)));
    const hasDraftAction = !!draftContact;
    const nextStatus: 'email_confirmed' | 'new' = (formIsCompleted || hasDraftAction) ? 'new' : 'email_confirmed';

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
        session_id: sessionIdHeader,
        props: {
          campaign_source: person.campaign_source || null,
          campaign_variant: person.campaign_variant || null,
          elapsed_seconds: elapsed,
          form_session_id: fs || undefined,
        },
      });
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'contact_verification_completed',
        source: 'api.leads.confirm',
        session_id: sessionIdHeader,
        props: { contact_method: 'email' },
      });
    } catch {}

    // NOTE: Google Ads conversion is now triggered by the CLIENT after redirect
    // via fireLeadVerifiedWithEnhancement() on the destination page (e.g., SignupWizard, MatchPage)
    // This ensures the gtag base conversion fires BEFORE the server-side enhancement

    // Process draft_contact if present (therapist directory flow)
    if (draftContact) {
      try {
        const therapistId = typeof draftContact.therapist_id === 'string' ? draftContact.therapist_id : null;
        const contactType = (draftContact.contact_type === 'booking' || draftContact.contact_type === 'consultation') ? draftContact.contact_type : 'consultation';
        const patientReason = typeof draftContact.patient_reason === 'string' ? draftContact.patient_reason : '';
        const patientMessage = typeof draftContact.patient_message === 'string' ? draftContact.patient_message : '';
        const sessionFormat = (draftContact.session_format === 'online' || draftContact.session_format === 'in_person') ? draftContact.session_format : undefined;
        const isTestDraft = draftContact.is_test === true;

        if (therapistId && (patientReason || patientMessage)) {
          const result = await processDraftContact({
            patientId: id,
            patientName: person.name || '',
            patientEmail: person.email,
            contactMethod: 'email',
            draftContact: {
              therapist_id: therapistId,
              contact_type: contactType,
              patient_reason: patientReason,
              patient_message: patientMessage,
              session_format: sessionFormat,
            },
            isTest: isTestDraft,
          });

          if (result.success) {
            await clearDraftContact(id);
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'draft_contact_processed',
              source: 'api.leads.confirm',
              session_id: sessionIdHeader,
              props: { therapist_id: therapistId, contact_type: contactType, match_id: result.matchId },
            });
          } else {
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'draft_contact_failed',
              source: 'api.leads.confirm',
              session_id: sessionIdHeader,
              props: { therapist_id: therapistId, error: result.error },
            });
          }
        }
      } catch (err) {
        await logError('api.leads.confirm', err, { stage: 'draft_contact_processing' });
      }
    }

    // Success → set client session cookie (EARTH-204)
    // For self-service variant, redirect directly to matches page (skip intermediate screen)
    const isSelfService = person.campaign_variant !== 'concierge';
    const matchesUrl = typeof newMetadata['last_confirm_redirect_path'] === 'string' 
      ? (newMetadata['last_confirm_redirect_path'] as string) 
      : null;
    const directToMatches = isSelfService && matchesUrl && matchesUrl.startsWith('/matches/');

    const variantParam = person.campaign_variant ? `&variant=${encodeURIComponent(person.campaign_variant)}` : '';
    try {
      const token = await createClientSessionToken({
        patient_id: id,
        contact_method: 'email',
        contact_value: person.email.toLowerCase(),
        name: person.name || undefined,
      });
      const cookie = createClientSessionCookie(token);

      // Self-service: go straight to matches
      if (directToMatches) {
        const resp = NextResponse.redirect(`${origin}${matchesUrl}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      }

      if (effectiveRedirect) {
        const hasQuery = effectiveRedirect.includes('?');
        const separator = hasQuery ? '&' : '?';
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${variantParam}`;
        const resp = NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      }
      const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${variantParam}`, 302);
      resp.headers.set('Set-Cookie', cookie);
      return resp;
    } catch {
      // Self-service: go straight to matches (fallback without cookie)
      if (directToMatches) {
        return NextResponse.redirect(`${origin}${matchesUrl}`, 302);
      }

      if (effectiveRedirect) {
        const hasQuery = effectiveRedirect.includes('?');
        const separator = hasQuery ? '&' : '?';
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${variantParam}`;
        return NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
      }
      return NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}${variantParam}`, 302);
    }
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${origin}/fragebogen?confirm=error`, 302);
  }
}
