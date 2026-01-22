import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { renderRichTherapistEmail } from '@/lib/email/templates/richTherapistEmail';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { renderFeedbackRequestEmail } from '@/lib/email/templates/feedbackRequest';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { BASE_URL } from '@/lib/constants';
import { isCronAuthorized as isCronAuthorizedShared } from '@/lib/cron-auth';
import { getQaNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  return isCronAuthorizedShared(req);
}

// Sample data for email previews
const SAMPLE_THERAPIST = {
  id: 'preview-therapist',
  first_name: 'Anna',
  last_name: 'Müller',
  city: 'Berlin',
  photo_url: null,
  modalities: ['narm', 'somatic-experiencing'],
  approach_text: 'Ich begleite Menschen auf ihrem Weg zur Heilung. Mein Ansatz verbindet körperorientierte Methoden mit einem tiefen Verständnis für die Verbindung zwischen Körper und Psyche.',
};

const SAMPLE_PATIENT = {
  id: 'preview-patient',
  name: 'Max Mustermann',
};

type TemplateType = 'rich_therapist' | 'selection_nudge' | 'feedback_request' | 'email_confirmation' | 'all';

function renderTemplate(template: TemplateType): { subject: string; html: string }[] {
  const matchesUrl = `${BASE_URL}/matches/preview-uuid`;
  const confirmUrl = `${BASE_URL}/confirm?token=preview-token`;

  const results: { subject: string; html: string }[] = [];

  if (template === 'rich_therapist' || template === 'all') {
    const email = renderRichTherapistEmail({
      patientName: SAMPLE_PATIENT.name,
      patientId: SAMPLE_PATIENT.id,
      therapist: SAMPLE_THERAPIST,
      matchesUrl,
    });
    if (email.html) results.push({ subject: email.subject, html: email.html });
  }

  if (template === 'selection_nudge' || template === 'all') {
    const email = renderSelectionNudgeEmail({
      patientName: SAMPLE_PATIENT.name,
      matchesUrl,
    });
    if (email.html) results.push({ subject: email.subject, html: email.html });
  }

  if (template === 'feedback_request' || template === 'all') {
    const email = renderFeedbackRequestEmail({
      patientName: SAMPLE_PATIENT.name,
      patientId: SAMPLE_PATIENT.id,
    });
    if (email.html) results.push({ subject: email.subject, html: email.html });
  }

  if (template === 'email_confirmation' || template === 'all') {
    const email = renderEmailConfirmation({ confirmUrl });
    if (email.html) results.push({ subject: email.subject, html: email.html });
  }

  return results;
}

/**
 * GET /api/admin/emails/preview?template=rich_therapist&send=true
 * 
 * Query params:
 * - template: rich_therapist | selection_nudge | feedback_request | email_confirmation | all
 * - send: true to send to LEADS_NOTIFY_EMAIL, false to just return HTML
 * 
 * Examples:
 * - Preview HTML: /api/admin/emails/preview?template=rich_therapist&token=YOUR_CRON_SECRET
 * - Send to inbox: /api/admin/emails/preview?template=all&send=true&token=YOUR_CRON_SECRET
 */
export async function GET(req: Request) {
  try {
    const isAdmin = await assertAdmin(req);
    const isCron = isCronAuthorized(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const template = (url.searchParams.get('template') || 'all') as TemplateType;
    const shouldSend = url.searchParams.get('send') === 'true';

    const validTemplates: TemplateType[] = ['rich_therapist', 'selection_nudge', 'feedback_request', 'email_confirmation', 'all'];
    if (!validTemplates.includes(template)) {
      return NextResponse.json({ 
        error: `Invalid template. Valid options: ${validTemplates.join(', ')}` 
      }, { status: 400 });
    }

    const emails = renderTemplate(template);

    if (!shouldSend) {
      // Just return the rendered HTML for preview
      if (emails.length === 1) {
        return new Response(emails[0].html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      // Multiple templates: return JSON with all
      return NextResponse.json({
        templates: emails.map((e, i) => ({
          index: i,
          subject: e.subject,
          preview_url: `${url.origin}${url.pathname}?template=${template === 'all' ? validTemplates[i] : template}`,
        })),
      });
    }

    // Send to QA email for preview testing
    const notifyEmail = getQaNotifyEmail();
    if (!notifyEmail) {
      return NextResponse.json({ error: 'QA_NOTIFY_EMAIL not configured' }, { status: 500 });
    }

    const results: { subject: string; sent: boolean }[] = [];
    for (const email of emails) {
      const emailResult = await sendEmail({
        to: notifyEmail,
        subject: `[QA Preview] ${email.subject}`,
        html: email.html,
        context: { kind: 'qa_preview', template },
      });
      results.push({ subject: email.subject, sent: emailResult.sent });
    }

    return NextResponse.json({
      message: `Sent ${results.filter(r => r.sent).length}/${results.length} emails to ${notifyEmail}`,
      results,
    });
  } catch (e) {
    console.error('Email preview error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
