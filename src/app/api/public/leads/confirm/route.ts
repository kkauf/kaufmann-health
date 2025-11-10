import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { BASE_URL } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { sendEmail } from '@/lib/email/client';
import { renderBookingTherapistNotification } from '@/lib/email/templates/bookingTherapistNotification';
import { renderBookingClientConfirmation } from '@/lib/email/templates/bookingClientConfirmation';

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

    // Resolve an effective redirect path: prefer query param if safe; otherwise fallback to stored metadata value
    const personMeta: Record<string, unknown> = (person.metadata ?? {}) as Record<string, unknown>;
    const storedRedirectRaw = typeof personMeta['last_confirm_redirect_path'] === 'string' ? (personMeta['last_confirm_redirect_path'] as string) : undefined;
    const storedRedirectSafe = !!(storedRedirectRaw && storedRedirectRaw.startsWith('/') && !storedRedirectRaw.startsWith('/api') && !storedRedirectRaw.startsWith('//'));
    const effectiveRedirect = isSafeRedirect ? redirectPath! : (storedRedirectSafe ? storedRedirectRaw! : undefined);

    // If the email has already been confirmed previously (or the lead is already actionable as 'new'),
    // send the user directly back to the intended UI context instead of showing an invalid link.
    const statusLower = (person.status || '').toLowerCase();
    if (statusLower === 'email_confirmed' || statusLower === 'new') {
      // Set client session cookie so the user is treated as verified (EARTH-204)
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
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
          const resp = NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
          resp.headers.set('Set-Cookie', cookie);
          return resp;
        }
        const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      } catch {
        if (effectiveRedirect) {
          const hasQuery = effectiveRedirect.includes('?');
          const separator = hasQuery ? '&' : '?';
          const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
          return NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
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

    // Read draft_contact if present (therapist directory flow). Do NOT remove yet; only clear after successful processing.
    const draftContact = (metadata?.['draft_contact'] as Record<string, unknown> | undefined) || undefined;
    const draftBooking = (metadata?.['draft_booking'] as Record<string, unknown> | undefined) || undefined;

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

    // Fire Google Ads conversion on email verification (EARTH-204)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined;
      const ua = req.headers.get('user-agent') || undefined;
      await maybeFirePatientConversion({
        patient_id: id,
        email: person.email,
        verification_method: 'email',
        ip,
        ua,
      });
    } catch {}

    // Enhanced Conversions handled by maybeFirePatientConversion above

    // Process draft contact if present (therapist directory flow)
    if (draftContact) {
      try {
        const therapistId = typeof draftContact.therapist_id === 'string' ? draftContact.therapist_id : null;
        const contactType = (draftContact.contact_type === 'booking' || draftContact.contact_type === 'consultation') ? draftContact.contact_type : 'booking';
        const patientReason = typeof draftContact.patient_reason === 'string' ? draftContact.patient_reason : '';
        const patientMessage = typeof draftContact.patient_message === 'string' ? draftContact.patient_message : '';
        const sessionFormat = (draftContact.session_format === 'online' || draftContact.session_format === 'in_person') ? draftContact.session_format : undefined;

        if (therapistId && (patientReason || patientMessage)) {
          const idempotencyKey = `${id}:${therapistId}:${contactType}`;
          // Create match via internal contact endpoint logic
          const contactPayload = {
            therapist_id: therapistId,
            contact_type: contactType,
            patient_name: person.name || '',
            patient_email: person.email,
            contact_method: 'email' as const,
            patient_reason: patientReason,
            patient_message: patientMessage,
            session_format: sessionFormat,
            idempotency_key: idempotencyKey,
          };

          // Call internal contact API
          const contactRes = await fetch(`${origin}/api/public/contact`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': req.headers.get('x-forwarded-for') || '',
              'user-agent': req.headers.get('user-agent') || '',
            },
            body: JSON.stringify(contactPayload),
          });

          if (!contactRes.ok) {
            await logError('api.leads.confirm', new Error('Draft contact creation failed'), {
              stage: 'draft_contact',
              status: contactRes.status,
              therapistId,
            });
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_contact_failed',
                source: 'api.leads.confirm',
                props: { therapist_id: therapistId, contact_type: contactType, status: contactRes.status },
              });
            } catch {}
          } else {
            // Clear draft_contact only after success
            try {
              const clearedMeta = { ...(newMetadata || {}) } as Record<string, unknown>;
              delete clearedMeta['draft_contact'];
              await supabaseServer
                .from('people')
                .update({ metadata: clearedMeta })
                .eq('id', id);
            } catch {}
            try {
              await ServerAnalytics.trackEventFromRequest(req, {
                type: 'draft_contact_processed',
                source: 'api.leads.confirm',
                props: { therapist_id: therapistId, contact_type: contactType },
              });
            } catch {}
          }
        }
      } catch (err) {
        await logError('api.leads.confirm', err, { stage: 'draft_contact_processing' });
      }
    }

    // Process draft booking if present (therapist directory flow)
    if (draftBooking) {
      try {
        const therapistId = typeof draftBooking.therapist_id === 'string' ? draftBooking.therapist_id : null;
        const dateIso = typeof draftBooking.date_iso === 'string' ? draftBooking.date_iso : '';
        const timeLabel = typeof draftBooking.time_label === 'string' ? draftBooking.time_label : '';
        const fmt = draftBooking.format === 'in_person' ? 'in_person' : (draftBooking.format === 'online' ? 'online' : null);

        if (therapistId && dateIso && timeLabel && fmt) {
          const { data: existing } = await supabaseServer
            .from('bookings')
            .select('id')
            .eq('therapist_id', therapistId)
            .eq('date_iso', dateIso)
            .eq('time_label', timeLabel)
            .maybeSingle();
          if (!existing) {
            const { error: bookErr } = await supabaseServer
              .from('bookings')
              .insert({ therapist_id: therapistId, patient_id: id, date_iso: dateIso, time_label: timeLabel, format: fmt });
            if (bookErr) {
              await logError('api.leads.confirm', bookErr, { stage: 'draft_booking_insert', therapistId, dateIso, timeLabel });
            } else {
              try {
                await ServerAnalytics.trackEventFromRequest(req, {
                  type: 'booking_created',
                  source: 'api.leads.confirm',
                  session_id: sessionIdHeader,
                  props: { therapist_id: therapistId, date_iso: dateIso, time_label: timeLabel, format: fmt },
                });
              } catch {}
              // Fire-and-forget emails
              try {
                // Therapist recipient
                const { data: t } = await supabaseServer
                  .from('therapists')
                  .select('email, first_name, last_name')
                  .eq('id', therapistId)
                  .maybeSingle();
                // Slot address (if in_person): fetch active slots and match by time/format
                let addr = '';
                if (fmt === 'in_person') {
                  const { data: slots } = await supabaseServer
                    .from('therapist_slots')
                    .select('time_local, format, address, active')
                    .eq('therapist_id', therapistId)
                    .eq('active', true);
                  if (Array.isArray(slots)) {
                    const m = (slots as { time_local: string | null; format: string; address?: string | null }[])
                      .find((s) => String(s.time_local || '').slice(0, 5) === timeLabel && s.format === 'in_person');
                    addr = (m?.address || '').trim();
                  }
                }
                type TherapistEmailRow = { email?: string | null; first_name?: string | null; last_name?: string | null } | null;
                const tRow = (t as unknown) as TherapistEmailRow;
                const therapistEmail = (tRow?.email || undefined) as string | undefined;
                const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].filter(Boolean).join(' ');
                if (therapistEmail) {
                  const content = renderBookingTherapistNotification({
                    therapistName,
                    patientName: (person.name || '') || null,
                    patientEmail: (person.email || '') || null,
                    dateIso: dateIso,
                    timeLabel: timeLabel,
                    format: fmt,
                    address: addr || null,
                  });
                  void sendEmail({
                    to: therapistEmail,
                    subject: content.subject,
                    html: content.html,
                    context: { kind: 'booking_therapist_notification', therapist_id: therapistId, patient_id: id },
                  }).catch(() => {});
                }
                if (person.email) {
                  const content2 = renderBookingClientConfirmation({
                    therapistName,
                    dateIso: dateIso,
                    timeLabel: timeLabel,
                    format: fmt,
                    address: addr || null,
                  });
                  void sendEmail({
                    to: person.email,
                    subject: content2.subject,
                    html: content2.html,
                    context: { kind: 'booking_client_confirmation', therapist_id: therapistId, patient_id: id },
                  }).catch(() => {});
                }
              } catch {}
            }
          }
          // Clear draft_booking regardless (processed or duplicate)
          try {
            const clearedMeta = { ...(newMetadata || {}) } as Record<string, unknown>;
            delete clearedMeta['draft_booking'];
            await supabaseServer
              .from('people')
              .update({ metadata: clearedMeta })
              .eq('id', id);
          } catch {}
        }
      } catch (err) {
        await logError('api.leads.confirm', err, { stage: 'draft_booking_processing' });
      }
    }

    // Success → set client session cookie (EARTH-204)
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
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
        const resp = NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
        resp.headers.set('Set-Cookie', cookie);
        return resp;
      }
      const resp = NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
      resp.headers.set('Set-Cookie', cookie);
      return resp;
    } catch {
      if (effectiveRedirect) {
        const hasQuery = effectiveRedirect.includes('?');
        const separator = hasQuery ? '&' : '?';
        const suffix = `${separator}confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`;
        return NextResponse.redirect(`${origin}${effectiveRedirect}${suffix}`, 302);
      }
      return NextResponse.redirect(`${origin}/fragebogen?confirm=1&id=${id}${fs ? `&fs=${encodeURIComponent(fs)}` : ''}`, 302);
    }
  } catch (e) {
    await logError('api.leads.confirm', e, { stage: 'unhandled' });
    return NextResponse.redirect(`${origin}/fragebogen?confirm=error`, 302);
  }
}
