import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendSmsCode } from '@/lib/verification/sms';

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
    // Shared-secret verification via query token OR headers (x-cron-secret / Authorization: Bearer)
    const secret = process.env.CRON_SECRET || '';
    const token = getQueryParam(req, 'token');
    const header = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(authHeader.startsWith('Bearer ') && authHeader.slice(7) === secret);
    const authorized = Boolean(secret && (token === secret || header === secret || isAuthBearer));
    if (!authorized) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
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

      void track({ type: 'email_bounced', level: 'warn', source: 'internal.email.webhook', ip, ua, props: { email, reason, event: evt, person_found: Boolean(person) } });
    }

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('internal.email.webhook', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
