import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { renderRichTherapistEmail } from '@/lib/email/templates/richTherapistEmail';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { renderBehavioralFeedbackEmail } from '@/lib/email/templates/feedbackBehavioral';
import type { PatientBehaviorSegment } from '@/lib/email/patientBehavior';
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
// Real test therapist from staging (HIDE_THERAPIST_IDS) for realistic previews
const SAMPLE_THERAPIST = {
  id: 'e5de1fb4-90c6-4681-aa23-b4e84e7defa8',
  first_name: 'Konstantin',
  last_name: 'Testapeut',
  city: 'Berlin',
  photo_url: 'https://lvglocnygvmgwzdayqlc.supabase.co/storage/v1/object/public/therapist-profiles/profiles/e5de1fb4-90c6-4681-aa23-b4e84e7defa8/photo-1764785953430.jpg',
  modalities: ['core-energetics'],
  approach_text: null as string | null,
  gender: 'male' as const,
  schwerpunkte: ['entwicklung', 'trauma', 'wut', 'zwang', 'paare'],
  session_preferences: ['online', 'in_person'],
  who_comes_to_me: 'Menschen die Probleme haben. üadnuncüadfn üaknüfknüsofkmüofi',
  session_focus: 'Wünsche, Träume, Ängste, innere Blockaden und Widerstände. Wir arbeiten mit Atmung und Haltung, Ausdruck und Emotion. Wenn du willst.',
  first_session: 'Wir werden ein Gespräch führen, und uns kennen lernen.',
  about_me: 'Ich bin eigentlich studierter Volkswirt, doch habe mich voll der Arbeit mit Menschen hingegeben. Ich spreche auch fließend Englisch und bin Vater.',
  qualification: 'Heilpraktiker (Psychotherapie)',
  next_intro_slot: { date_iso: '2026-02-09', time_label: '09:00', time_utc: '2026-02-09T08:00:00Z' },
};

const SAMPLE_PATIENT = {
  id: 'preview-patient',
  name: 'Max Mustermann',
};

type TemplateType = 'rich_therapist' | 'selection_nudge' | 'feedback_behavioral' | 'email_confirmation' | 'all';

// Sample behavioral segments for previewing each variant
const BEHAVIORAL_SEGMENTS: { label: string; segment: PatientBehaviorSegment }[] = [
  { label: 'D: almost_booked', segment: { segment: 'almost_booked', therapist_id: 'preview-therapist' } },
  { label: 'A: never_visited', segment: { segment: 'never_visited' } },
  { label: 'B: visited_no_action', segment: { segment: 'visited_no_action', visitCount: 3 } },
  { label: 'C: rejected (not_right_fit)', segment: { segment: 'rejected', reasons: [{ reason: 'not_right_fit', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (method_wrong)', segment: { segment: 'rejected', reasons: [{ reason: 'method_wrong', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (too_expensive)', segment: { segment: 'rejected', reasons: [{ reason: 'too_expensive', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (wants_insurance)', segment: { segment: 'rejected', reasons: [{ reason: 'wants_insurance', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (no_availability)', segment: { segment: 'rejected', reasons: [{ reason: 'no_availability', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (location_wrong)', segment: { segment: 'rejected', reasons: [{ reason: 'location_wrong', therapist_id: 'preview-therapist' }] } },
  { label: 'C: rejected (other)', segment: { segment: 'rejected', reasons: [{ reason: 'other', therapist_id: 'preview-therapist', details: 'Ich bin mir einfach nicht sicher.' }] } },
];

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

  if (template === 'feedback_behavioral' || template === 'all') {
    for (const { label, segment } of BEHAVIORAL_SEGMENTS) {
      const email = renderBehavioralFeedbackEmail({
        patientName: SAMPLE_PATIENT.name,
        patientId: SAMPLE_PATIENT.id,
        segment,
        matchesUrl,
        therapist: {
          id: SAMPLE_THERAPIST.id,
          first_name: SAMPLE_THERAPIST.first_name,
          last_name: SAMPLE_THERAPIST.last_name,
          city: SAMPLE_THERAPIST.city,
          modalities: SAMPLE_THERAPIST.modalities,
          approach_text: SAMPLE_THERAPIST.approach_text,
          photo_url: SAMPLE_THERAPIST.photo_url,
          gender: SAMPLE_THERAPIST.gender,
          schwerpunkte: SAMPLE_THERAPIST.schwerpunkte,
          session_preferences: SAMPLE_THERAPIST.session_preferences,
          who_comes_to_me: SAMPLE_THERAPIST.who_comes_to_me,
          session_focus: SAMPLE_THERAPIST.session_focus,
          first_session: SAMPLE_THERAPIST.first_session,
          about_me: SAMPLE_THERAPIST.about_me,
          qualification: SAMPLE_THERAPIST.qualification,
          next_intro_slot: SAMPLE_THERAPIST.next_intro_slot,
        },
        availableSlots: 7,
        nextSlotDate: 'Mo 9. Feb',
      });
      if (email.html) results.push({ subject: `[${label}] ${email.subject}`, html: email.html });
    }
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
 * - template: rich_therapist | selection_nudge | feedback_request | feedback_behavioral | email_confirmation | all
 * - send: true to send to LEADS_NOTIFY_EMAIL, false to just return HTML
 *
 * Examples:
 * - Preview HTML: /api/admin/emails/preview?template=rich_therapist&token=YOUR_CRON_SECRET
 * - Send to inbox: /api/admin/emails/preview?template=all&send=true&token=YOUR_CRON_SECRET
 * - Send behavioral variants: /api/admin/emails/preview?template=feedback_behavioral&send=true&token=YOUR_CRON_SECRET
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

    const validTemplates: TemplateType[] = ['rich_therapist', 'selection_nudge', 'feedback_behavioral', 'email_confirmation', 'all'];
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
