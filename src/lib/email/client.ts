import { EMAIL_FROM_DEFAULT, BASE_URL } from '@/lib/constants';
import type { SendEmailParams } from './types';
import { logError, track } from '@/lib/logger';
import { createHash } from 'crypto';

// Safety net: ensure any therapist profile images embedded in emails are served
// from our sending domain via the proxy endpoint (EARTH-138). This rewrites
// Supabase public bucket URLs found in the HTML to our proxy path.
export function rewriteTherapistProfileImagesInHtml(html?: string): string | undefined {
  if (!html) return html;
  try {
    const proxyPrefix = `${BASE_URL.replace(/\/+$/, '')}/api/images/therapist-profiles/`;
    // Match both object and render/image variants, drop any query string for cacheability.
    const re = /https?:\/\/[^"'\s<>()]+\/storage\/v1\/(?:object|render\/image)\/public\/therapist-profiles\/([^"'\?\s<>()]+)/g;
    return html.replace(re, (_m, p1) => `${proxyPrefix}${p1}`);
  } catch {
    return html;
  }
}

// Very small HTML -> text fallback for providers that weigh plain text positively.
// - Removes script/style
// - Converts <a> to "text (URL)"
// - Replaces <br>/<p>/<li> with newlines and bullets
// - Strips remaining tags
function htmlToText(html?: string): string | undefined {
  if (!html) return undefined;
  try {
    let s = html;
    // Remove script/style blocks
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    // Links: capture text and href
    s = s.replace(/<a\s+[^>]*href=("|')([^"']+)("|')[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q1, href, _q2, text) => {
      const t = String(text).replace(/<[^>]+>/g, '').trim();
      const u = String(href).trim();
      return t ? `${t} (${u})` : u;
    });
    // Line breaks and list items
    s = s.replace(/<\s*br\s*\/?>/gi, '\n');
    s = s.replace(/<\s*\/p\s*>/gi, '\n\n');
    s = s.replace(/<\s*li\s*>/gi, '\n- ');
    s = s.replace(/<\s*\/li\s*>/gi, '');
    // Strip remaining tags
    s = s.replace(/<[^>]+>/g, '');
    // Decode a few common entities
    s = s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // Collapse excessive whitespace
    s = s.replace(/[ \t\x0B\f\r]+/g, ' ');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  } catch {
    return undefined;
  }
}

/**
 * Thin wrapper around Resend HTTP API.
 * No-ops if RESEND_API_KEY is not configured or if 'to' is missing.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Observability: make it visible when emailing is disabled
    await track({
      type: 'email_skipped',
      level: 'warn',
      source: 'email.client',
      props: { reason: 'missing_api_key', subject: params.subject, ...(params.context || {}) },
    });
    return; // disabled in tests or locally
  }

  const toList = !params.to
    ? []
    : Array.isArray(params.to)
    ? params.to
    : [params.to];
  if (toList.length === 0) {
    // Observability: no recipient provided
    await track({
      type: 'email_skipped',
      level: 'warn',
      source: 'email.client',
      props: { reason: 'missing_recipient', subject: params.subject, ...(params.context || {}) },
    });
    return;
  }

  const fromAddress = params.from || process.env.LEADS_FROM_EMAIL || EMAIL_FROM_DEFAULT;

  // Minimal resiliency: short timeout + retry on 429/5xx. Never throw.
  const maxAttempts = 3;
  const timeoutMs = Number(process.env.RESEND_TIMEOUT_MS || 10000);

  // Build a stable idempotency key to avoid duplicate deliveries when our request
  // times out locally but was already accepted by the provider.
  const idempotencyKey = (() => {
    try {
      const ctx = (params.context || {}) as Record<string, unknown>;
      const stable = {
        to: toList,
        subject: params.subject,
        match_id: ctx['match_id'],
        patient_id: ctx['patient_id'],
        therapist_id: ctx['therapist_id'],
        // Include lead_id for patient flows and email_token (e.g., confirmation token)
        // to ensure re-sends with a new token do not get deduplicated by Resend
        lead_id: ctx['lead_id'],
        email_token: ctx['email_token'],
        kind: ctx['kind'],
        template: (ctx as Record<string, unknown>)['template'],
      };
      const raw = JSON.stringify(stable);
      return createHash('sha256').update(raw).digest('hex');
    } catch {
      return undefined;
    }
  })();

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const backoff = (attempt: number) => [200, 1000, 3000][Math.min(attempt - 1, 2)];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Prepare payload content for this attempt
      const htmlToSend = params.html ? rewriteTherapistProfileImagesInHtml(params.html) : undefined;
      const finalText = params.text ?? (htmlToSend ? htmlToText(htmlToSend) : undefined);
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: `Kaufmann Health <${fromAddress}>`,
          to: toList,
          subject: params.subject,
          ...(htmlToSend ? { html: htmlToSend } : {}),
          ...(finalText ? { text: finalText } : {}),
          ...(params.replyTo ? { reply_to: params.replyTo } : {}),
          ...(params.headers && Object.keys(params.headers).length > 0 ? { headers: params.headers } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        // Success: log once and exit.
        await track({
          type: 'email_sent',
          level: 'info',
          source: 'email.client',
          props: {
            subject: params.subject,
            to_count: toList.length,
            has_html: Boolean(params.html),
            has_text: Boolean(finalText),
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
      if (retryable && attempt < maxAttempts) {
        await track({
          type: 'email_retry',
          level: 'warn',
          source: 'email.client',
          props: {
            subject: params.subject,
            to_count: toList.length,
            has_html: Boolean(params.html),
            has_text: Boolean(finalText),
            status,
            status_text: resp.statusText,
            body,
            attempt,
            ...(params.context || {}),
          },
        });
        await delay(backoff(attempt));
        continue;
      }

      // Final failure (non-retryable or last attempt): log error once and stop.
      await logError('email.client', { name: 'EmailNonOk', message: `Resend returned ${status}` }, {
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
      return; // give up
    } catch (e) {
      clearTimeout(timer);
      // Network error or timeout; log and maybe retry.
      if (attempt < maxAttempts) {
        await track({
          type: 'email_timeout_retry',
          level: 'warn',
          source: 'email.client',
          props: {
            subject: params.subject,
            to_count: toList.length,
            has_html: Boolean(params.html),
            has_text: Boolean(params.text || params.html),
            attempt,
            timeout_ms: timeoutMs,
            ...(params.context || {}),
          },
        });
        await delay(backoff(attempt));
        continue;
      }
      await logError('email.client', e, {
        subject: params.subject,
        to_count: toList.length,
        has_html: Boolean(params.html),
        has_text: Boolean(params.text || params.html),
        attempt,
        timeout_ms: timeoutMs,
        ...(params.context || {}),
      });
      return;
    }
  }
}
