/**
 * Twilio Incoming SMS Webhook
 * 
 * Receives inbound SMS replies and forwards them to admin email.
 * Configure this URL in Twilio Console → Messaging Service → Integration → Incoming Messages
 * 
 * Twilio sends: From, To, Body, MessageSid, etc.
 */
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { track, logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskPhone(n?: string | null) {
  if (!n) return 'redacted';
  const s = String(n);
  return s.length > 6 ? `***${s.slice(-6)}` : 'redacted';
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const sig = req.headers.get('x-twilio-signature') || '';

    // Read raw body for signature validation
    const raw = await req.text();

    // Validate Twilio signature
    let valid = true;
    if (authToken && sig) {
      try {
        const url = req.url;
        const params = Object.fromEntries(new URLSearchParams(raw));
        valid = twilio.validateRequest(authToken, sig, url, params as Record<string, string>);
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      await logError('api.internal.sms.incoming', new Error('Invalid Twilio signature'), {}, ip, ua);
      return NextResponse.json({ data: null, error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try {
      if (raw.trim().startsWith('{')) payload = JSON.parse(raw);
      else payload = Object.fromEntries(new URLSearchParams(raw));
    } catch {
      payload = {};
    }

    const from = String(payload['From'] || '').trim();
    const to = String(payload['To'] || '').trim();
    const body = String(payload['Body'] || '').trim();
    const messageSid = String(payload['MessageSid'] || '');

    // Track incoming SMS (no PII in props)
    void track({
      type: 'sms_incoming',
      level: 'info',
      source: 'api.internal.sms.incoming',
      props: {
        message_sid: messageSid || undefined,
        from: maskPhone(from),
        body_length: body.length,
        contains_hilfe: /hilfe/i.test(body),
      },
    });

    // Try to find the patient by phone number
    let patientName = 'Unbekannt';
    let patientId = '';
    let patientEmail = '';
    if (from) {
      const { data: person } = await supabaseServer
        .from('people')
        .select('id, name, email, phone_number')
        .eq('phone_number', from)
        .eq('type', 'patient')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (person) {
        patientName = person.name || 'Unbekannt';
        patientId = person.id || '';
        patientEmail = person.email || '';
      }
    }

    // Detect callback request
    const wantsCallback = /hilfe|anruf|rückruf|call|help/i.test(body);

    // Forward to admin email
    const notifyEmail = process.env.LEADS_NOTIFY_EMAIL;
    if (notifyEmail) {
      const subject = wantsCallback
        ? `📞 Rückruf gewünscht: ${patientName} (${maskPhone(from)})`
        : `📱 SMS-Antwort: ${patientName} (${maskPhone(from)})`;

      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">${wantsCallback ? '📞 Rückruf gewünscht' : '📱 SMS-Antwort erhalten'}</h2>
          
          <div style="background: ${wantsCallback ? '#fef3c7' : '#f1f5f9'}; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Nachricht:</p>
            <p style="margin: 0; font-size: 16px; color: #1e293b; white-space: pre-wrap;">${body || '(leer)'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Name:</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${patientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Telefon:</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${from}</td>
            </tr>
            ${patientEmail ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">E-Mail:</td>
              <td style="padding: 8px 0; color: #1e293b;">${patientEmail}</td>
            </tr>
            ` : ''}
            ${patientId ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Patient ID:</td>
              <td style="padding: 8px 0; color: #64748b; font-family: monospace; font-size: 12px;">${patientId}</td>
            </tr>
            ` : ''}
          </table>

          ${wantsCallback ? `
          <div style="background: #fef9c3; border: 1px solid #fde047; padding: 12px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; color: #854d0e; font-weight: 500;">⚡ Bitte zeitnah zurückrufen</p>
          </div>
          ` : ''}
        </div>
      `;

      await sendEmail({
        to: notifyEmail,
        subject,
        html,
        context: { kind: 'sms_reply_forward', patient_id: patientId || undefined },
      });
    }

    // Return empty TwiML (no auto-reply for now)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (e) {
    await logError('api.internal.sms.incoming', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
