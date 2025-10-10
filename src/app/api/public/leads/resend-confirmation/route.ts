import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { BASE_URL } from '@/lib/constants';
import { logError, track } from '@/lib/logger';
import { sanitize } from '@/features/leads/lib/validation';
import { isIpRateLimited } from '@/lib/leads/rateLimit';
import { isTestRequest } from '@/lib/test-mode';

export const runtime = 'nodejs';

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

/**
 * POST /api/public/leads/resend-confirmation
 * Purpose: Re-send email confirmation for patients in pre_confirmation state.
 * Also supports updating email if form_session_id matches and status is still pre_confirmation.
 * Privacy: Always returns 200 with ok=true to avoid user enumeration.
 */
export async function POST(req: Request) {
  const ip = getClientIP(req.headers);
  const ua = req.headers.get('user-agent') || undefined;
  try {
    let email = '';
    let formSessionId: string | undefined;
    try {
      const body = (await req.json()) as { email?: string; form_session_id?: string };
      email = sanitize(body.email)?.toLowerCase() || '';
      formSessionId = typeof body.form_session_id === 'string' ? body.form_session_id : undefined;
    } catch {
      // Ignore parse errors; keep email empty
    }

    // Always respond OK to avoid user enumeration
    const ok = () =>
      NextResponse.json(
        { data: { ok: true }, error: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );

    // Minimal email validation; if invalid, noop but still 200
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return ok();
    }

    // Soft IP rate limiting (60s window). Bypass when test.
    const isTest = isTestRequest(req, email);
    if (!isTest && ip) {
      try {
        const limited = await isIpRateLimited(supabaseServer, ip, undefined, 60_000);
        if (limited) return ok();
      } catch {}
    }

    // Look up patient lead in pre_confirmation - first try exact email match
    let { data: personRaw } = await supabaseServer
      .from('people')
      .select('id,email,status,metadata')
      .eq('email', email)
      .eq('type', 'patient')
      .single();

    type PersonRow = { id: string; email: string; status: string; metadata?: Record<string, unknown> | null };
    let person = (personRaw ?? null) as PersonRow | null;

    // If no exact match but formSessionId provided, try to find by session and update email
    if (!person && formSessionId) {
      const { data: sessionPerson } = await supabaseServer
        .from('people')
        .select('id,email,status,metadata')
        .eq('type', 'patient')
        .eq('status', 'pre_confirmation')
        .ilike('metadata->>form_session_id', formSessionId)
        .single();
      
      if (sessionPerson) {
        person = sessionPerson as PersonRow;
        // Update email if different (user is correcting their address)
        if (person.email !== email) {
          const { error: updateErr } = await supabaseServer
            .from('people')
            .update({ email })
            .eq('id', person.id);
          if (!updateErr) {
            person.email = email;
            void track({
              type: 'email_updated',
              level: 'info',
              source: 'api.leads.resend_confirmation',
              props: { lead_id: person.id, reason: 'correction' },
            });
          }
        }
      }
    }

    if (!person || person.status !== 'pre_confirmation') {
      return ok();
    }

    const metadata = (person.metadata ?? {}) as Record<string, unknown>;

    // Throttle by last sent time: 10 minutes (bypass when test)
    const sentAtIso = metadata['confirm_sent_at'] as string | undefined;
    if (!isTest && sentAtIso) {
      const sentAt = Date.parse(sentAtIso);
      if (!Number.isNaN(sentAt) && Date.now() - sentAt < 10 * 60 * 1000) {
        return ok();
      }
    }

    // Issue new token and update metadata.confirm_sent_at
    const newToken = randomUUID();
    const newMeta = { ...metadata, confirm_token: newToken, confirm_sent_at: new Date().toISOString() };
    const id = person.id;

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ metadata: newMeta })
      .eq('id', id);

    if (upErr) {
      void logError('api.leads.resend_confirmation', upErr, { stage: 'update_metadata' }, ip, ua);
      return ok();
    }

    // Send email (best-effort)
    try {
      const origin = new URL(req.url).origin || BASE_URL;
      const base = `${origin}/api/public/leads/confirm?token=${encodeURIComponent(newToken)}&id=${encodeURIComponent(id)}`;
      const fs = typeof metadata['form_session_id'] === 'string' ? String(metadata['form_session_id']) : '';
      const confirmUrl = fs ? `${base}&fs=${encodeURIComponent(fs)}` : base;
      const emailContent = renderEmailConfirmation({ confirmUrl });
      void track({
        type: 'email_attempted',
        level: 'info',
        source: 'api.leads.resend_confirmation',
        ip,
        ua,
        props: { stage: 'email_confirmation_resend', lead_id: id, lead_type: 'patient', subject: emailContent.subject },
      });
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        context: {
          stage: 'email_confirmation_resend',
          lead_id: id,
          lead_type: 'patient',
          template: 'email_confirmation',
          email_token: newToken,
        },
      });
    } catch (e) {
      void logError('api.leads.resend_confirmation', e, { stage: 'send_email' }, ip, ua);
    }

    return ok();
  } catch (e) {
    void logError('api.leads.resend_confirmation', e, { stage: 'unhandled' }, ip, ua);
    return NextResponse.json(
      { data: { ok: true }, error: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
