import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendSmsCode } from '@/lib/verification/sms';
import { sendEmail } from '@/lib/email/client';
import { renderLayout } from '@/lib/email/layout';
import { Webhook as SvixWebhook } from 'svix';
import { getAdminNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getQueryParam(req: Request, key: string): string | undefined {
  try {
    const u = new URL(req.url);
    const v = u.searchParams.get(key);
    return v || undefined;
  } catch {
    return undefined;
  }
}

function extractEmail(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  // Common webhook structures
  // Resend: { type, data: { email: { to: [addr], from, subject }, ... }, ... }
  // Fallback: email, recipient, to
  const p = payload as Record<string, unknown>;
  const direct = typeof p['email'] === 'string' ? (p['email'] as string) : undefined;
  if (direct) return direct.toLowerCase();
  const recipient = typeof p['recipient'] === 'string' ? (p['recipient'] as string) : undefined;
  if (recipient) return recipient.toLowerCase();
  const to = p['to'];
  if (typeof to === 'string') return to.toLowerCase();
  if (Array.isArray(to) && typeof to[0] === 'string') return to[0].toLowerCase();
  const data = p['data'] as Record<string, unknown> | undefined;
  const emailObj = data && typeof data['email'] === 'object' ? (data['email'] as Record<string, unknown>) : undefined;
  if (emailObj) {
    const to2 = emailObj['to'];
    if (typeof to2 === 'string') return to2.toLowerCase();
    if (Array.isArray(to2) && typeof to2[0] === 'string') return to2[0].toLowerCase();
  }
  return undefined;
}

function extractEvent(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const t = p['type'];
  if (typeof t === 'string') return t.toLowerCase();
  const e = p['event'];
  if (typeof e === 'string') return e.toLowerCase();
  return undefined;
}

function extractReason(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const r = p['reason'] || p['error'] || p['message'];
  return typeof r === 'string' ? r : undefined;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    let payload: unknown = {};
    // Attempt Resend/Svix signature verification first if signing secret is configured
    const signingSecret = process.env.EMAIL_WEBHOOK_SIGNING_SECRET || process.env.RESEND_WEBHOOK_SIGNING_SECRET || '';
    const svixId = req.headers.get('svix-id') || '';
    const svixTs = req.headers.get('svix-timestamp') || '';
    const svixSig = req.headers.get('svix-signature') || '';
    let signatureVerified = false;
    if (signingSecret && svixId && svixTs && svixSig) {
      try {
        const wh = new SvixWebhook(signingSecret);
        // verify returns the parsed JSON payload
        payload = wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTs,
          'svix-signature': svixSig,
        });
        signatureVerified = true;
      } catch {
        // fall through to shared-secret auth
      }
    }

    // If signature not verified, allow shared-secret verification via query/header as fallback
    if (!signatureVerified) {
      const secret = process.env.CRON_SECRET || '';
      const token = getQueryParam(req, 'token');
      const header = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
      const authHeader = req.headers.get('authorization') || '';
      const isAuthBearer = Boolean(authHeader.startsWith('Bearer ') && authHeader.slice(7) === secret);
      const authorized = Boolean(secret && (token === secret || header === secret || isAuthBearer));
      if (!authorized) {
        return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
      }
      // parse JSON after shared-secret auth
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = {};
      }
    }

    const evt = extractEvent(payload) || 'unknown';
    const email = extractEmail(payload);
    const reason = extractReason(payload) || '';

    // Only handle bounces; ignore other events
    if (evt.includes('bounce')) {
      // Find patient by email
      type Person = { id: string; email?: string | null; phone_number?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
      let person: Person | null = null;
      if (email) {
        const { data } = await supabaseServer
          .from('people')
          .select('id,email,phone_number,status,metadata')
          .eq('email', email)
          .eq('type', 'patient')
          .limit(1);
        if (Array.isArray(data) && data[0]) person = data[0] as Person;
      }

      if (person) {
        const meta = { ...(person.metadata || {}) } as Record<string, unknown>;
        meta['email_bounce_at'] = new Date().toISOString();
        if (reason) meta['email_bounce_reason'] = reason;
        // Flag UI prompt to update email when pre_confirmation
        if ((person.status || '').toLowerCase() === 'pre_confirmation') {
          meta['email_needs_update'] = true;
        }
        await supabaseServer
          .from('people')
          .update({ metadata: meta })
          .eq('id', person.id);

        // If phone exists and still pre_confirmation, try SMS fallback: send verification code
        if ((person.status || '').toLowerCase() === 'pre_confirmation' && person.phone_number) {
          try {
            const result = await sendSmsCode(person.phone_number);
            void track({
              type: 'email_bounce_sms_fallback',
              level: result.success ? 'info' : 'warn',
              source: 'internal.email.webhook',
              ip,
              ua,
              props: { lead_id: person.id, reason, success: result.success, twilio_status: result.twilio_status, twilio_code: result.twilio_code },
            });
          } catch (e) {
            await logError('internal.email.webhook', e, { stage: 'sms_fallback', lead_id: person.id }, ip, ua);
          }
        }
      }

      // Check if bounced email belongs to a therapist
      type Therapist = { id: string; email?: string | null; name?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
      let therapist: Therapist | null = null;
      if (email) {
        const { data } = await supabaseServer
          .from('therapists')
          .select('id,email,name,status,metadata')
          .eq('email', email)
          .limit(1);
        if (Array.isArray(data) && data[0]) therapist = data[0] as Therapist;
      }

      if (therapist) {
        // Update therapist metadata with bounce info
        const meta = { ...(therapist.metadata || {}) } as Record<string, unknown>;
        meta['email_bounce_at'] = new Date().toISOString();
        if (reason) meta['email_bounce_reason'] = reason;
        await supabaseServer
          .from('therapists')
          .update({ metadata: meta })
          .eq('id', therapist.id);

        // Send immediate admin alert for therapist bounces
        const time = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
        const contentHtml = `
          <div style="background:#fef2f2;padding:16px 20px;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
            <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">⚠️ Therapist Email Bounce</h1>
            <p style="margin:0;color:#475569;">An email to a therapist bounced and may need manual follow-up.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:600;width:140px;">Therapist</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">${therapist.name || '-'}</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:600;">Email</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">${email}</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:600;">Status</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">${therapist.status || '-'}</td></tr>
            <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bounce Reason</td><td style="padding:12px;border-bottom:1px solid #e2e8f0;">${reason || 'Unknown'}</td></tr>
            <tr><td style="padding:12px;font-weight:600;">Time</td><td style="padding:12px;">${time}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;">
            <p style="margin:0;font-size:14px;color:#64748b;">
              <strong>Action needed:</strong> Contact the therapist to resolve the email issue, then re-trigger the notification from the Admin dashboard.
            </p>
          </div>
        `;
        const adminNotifyEmail = getAdminNotifyEmail() || 'kontakt@kaufmann-health.de';
        void sendEmail({
          to: adminNotifyEmail,
          subject: `⚠️ Therapist Email Bounce: ${therapist.name || email}`,
          html: renderLayout({ contentHtml, preheader: `Email to ${therapist.name || email} bounced` }),
          context: { kind: 'therapist_bounce_alert', therapist_id: therapist.id, reason },
        });

        void track({ type: 'therapist_email_bounced', level: 'warn', source: 'internal.email.webhook', ip, ua, props: { email, reason, event: evt, therapist_id: therapist.id, therapist_name: therapist.name } });
      }

      void track({ type: 'email_bounced', level: 'warn', source: 'internal.email.webhook', ip, ua, props: { email, reason, event: evt, person_found: Boolean(person), therapist_found: Boolean(therapist) } });
    }

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('internal.email.webhook', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
