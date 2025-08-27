import { EMAIL_FROM_DEFAULT } from '@/lib/constants';
import type { SendEmailParams } from './types';
import { logError, track } from '@/lib/logger';

/**
 * Thin wrapper around Resend HTTP API.
 * No-ops if RESEND_API_KEY is not configured or if 'to' is missing.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // disabled in tests or locally

  const toList = !params.to
    ? []
    : Array.isArray(params.to)
    ? params.to
    : [params.to];
  if (toList.length === 0) return;

  const fromAddress = params.from || process.env.LEADS_FROM_EMAIL || EMAIL_FROM_DEFAULT;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Kaufmann Health <${fromAddress}>`,
        to: toList,
        subject: params.subject,
        ...(params.html ? { html: params.html } : {}),
        ...(params.text ? { text: params.text } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    // fire-and-forget analytics
    void track({
      type: 'email_sent',
      level: 'info',
      source: 'email.client',
      props: {
        to_count: toList.length,
        has_html: Boolean(params.html),
        has_text: Boolean(params.text),
      },
    });
  } catch (e) {
    // Best-effort logging; do not throw from email client
    console.error('[email.send] Failed to send email', e);
    void logError('email.client', e, {
      subject: params.subject,
      to_count: toList.length,
      has_html: Boolean(params.html),
      has_text: Boolean(params.text),
    });
  }
}
