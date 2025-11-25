import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { track, logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskPhone(n?: string | null) {
  if (!n) return 'redacted';
  const s = String(n);
  return s.length > 6 ? `***${s.slice(-6)}` : 'redacted';
}

export async function POST(req: Request) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const sig = req.headers.get('x-twilio-signature') || '';

    // Read raw body for signature validation
    const raw = await req.text();

    // Validate signature if we have auth token
    let valid = true;
    if (authToken && sig) {
      try {
        const url = req.url; // full URL
        // Twilio posts as application/x-www-form-urlencoded by default
        const params = Object.fromEntries(new URLSearchParams(raw));
        valid = twilio.validateRequest(authToken, sig, url, params as Record<string, string>);
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      await logError('api.internal.sms.status', new Error('Invalid Twilio signature'));
      return NextResponse.json({ data: null, error: 'Invalid signature' }, { status: 401 });
    }

    // Parse fields (accept both form-encoded and JSON)
    let payload: Record<string, unknown>;
    try {
      if (raw.trim().startsWith('{')) payload = JSON.parse(raw);
      else payload = Object.fromEntries(new URLSearchParams(raw));
    } catch {
      payload = {};
    }

    const messageSid = String(payload['MessageSid'] || payload['SmsSid'] || '');
    const messageStatus = String(payload['MessageStatus'] || payload['SmsStatus'] || '');
    const to = String(payload['To'] || '');
    const from = String(payload['From'] || '');
    const errorCode = String(payload['ErrorCode'] || '');

    // Track delivery status (no PII)
    void track({
      type: 'sms_status',
      level: 'info',
      source: 'api.internal.sms.status',
      props: {
        message_sid: messageSid || undefined,
        status: messageStatus || undefined,
        to: maskPhone(to),
        from: maskPhone(from),
        error_code: errorCode || undefined,
      },
    });

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('api.internal.sms.status', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
