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

  // Minimal resiliency: short timeout + retry on 429/5xx. Never throw.
  const maxAttempts = 3;
  const timeoutMs = 5000;

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const backoff = (attempt: number) => [100, 500, 1500][Math.min(attempt - 1, 2)];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch('https://api.resend.com/emails', {
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
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        // Success: log once and exit.
        void track({
          type: 'email_sent',
          level: 'info',
          source: 'email.client',
          props: {
            to_count: toList.length,
            has_html: Boolean(params.html),
            has_text: Boolean(params.text),
            attempt,
            ...(params.context || {}),
          },
        });
        return;
      }

      const status = resp.status;
      let body = '';
      try {
        body = (await resp.text()).slice(0, 500);
      } catch {}

      const retryable = status === 429 || (status >= 500 && status < 600);
      void logError('email.client', { name: 'EmailNonOk', message: `Resend returned ${status}` }, {
        subject: params.subject,
        to_count: toList.length,
        has_html: Boolean(params.html),
        has_text: Boolean(params.text),
        status,
        status_text: resp.statusText,
        body,
        attempt,
        ...(params.context || {}),
      });

      if (!retryable || attempt === maxAttempts) return; // give up
      await delay(backoff(attempt));
    } catch (e) {
      clearTimeout(timer);
      // Network error or timeout; log and maybe retry.
      void logError('email.client', e, {
        subject: params.subject,
        to_count: toList.length,
        has_html: Boolean(params.html),
        has_text: Boolean(params.text),
        attempt,
        timeout_ms: timeoutMs,
        ...(params.context || {}),
      });
      if (attempt === maxAttempts) return;
      await delay(backoff(attempt));
    }
  }
}
