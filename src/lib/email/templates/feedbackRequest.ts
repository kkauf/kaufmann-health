import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type FeedbackRequestEmailParams = {
  patientName?: string | null;
  patientId: string;
  bookingUrl?: string; // Calendly or similar for interview scheduling
};

type FeedbackOption = {
  reason: string;
  label: string;
};

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { reason: 'price_too_high', label: 'Preis ist zu hoch' },
  { reason: 'unsure_which_therapist', label: 'Unsicher, welche:r Therapeut:in passt' },
  { reason: 'need_more_time', label: 'Brauche mehr Zeit' },
  { reason: 'found_alternative', label: 'Habe andere Lösung gefunden' },
  { reason: 'other', label: 'Etwas anderes' },
];

export function renderFeedbackRequestEmail(params: FeedbackRequestEmailParams): EmailContent {
  const { patientName, patientId, bookingUrl } = params;
  const name = (patientName || '').trim();
  
  const calendarUrl = bookingUrl || process.env.NEXT_PUBLIC_BOOKING_URL || 'https://cal.com/kkauf/15min';

  // Build one-click feedback options
  const optionsHtml = FEEDBACK_OPTIONS.map((opt) => {
    const feedbackUrl = `${BASE_URL}/feedback/quick?patient=${encodeURIComponent(patientId)}&reason=${encodeURIComponent(opt.reason)}&utm_source=email&utm_campaign=feedback_request_d10`;
    return `
      <tr>
        <td style="padding:8px 0;">
          <a href="${escapeHtml(feedbackUrl)}" style="display:block;width:100%;box-sizing:border-box;padding:14px 16px;background:#ffffff !important;border:1px solid rgba(226,232,240,0.8);border-radius:10px;text-decoration:none;color:#334155 !important;font-size:15px;line-height:1.4;transition:all 0.2s;">
            <span style="display:inline-block;width:20px;height:20px;border:2px solid #cbd5e1;border-radius:50%;vertical-align:middle;margin-right:12px;"></span>
            ${escapeHtml(opt.label)}
          </a>
        </td>
      </tr>
    `;
  }).join('');

  const contentHtml = `
    <div style="margin:0 0 24px;">
      ${name ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0; font-size:16px; line-height:1.65; color:#475569 !important;">wir möchten Kaufmann Health verbessern und würden gern verstehen, was bei der Therapeutensuche im Weg steht.</p>
    </div>

    <!-- Feedback Options -->
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(100, 116, 139, 0.06);">
      <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#0f172a !important; font-weight:600;">Was trifft am ehesten zu?</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${optionsHtml}
      </table>
    </div>

    <!-- Interview CTA -->
    <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; background-image: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; border-radius:16px; border:1px solid rgba(99, 102, 241, 0.2); padding:24px; box-shadow: 0 2px 8px 0 rgba(99, 102, 241, 0.08);">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="48" style="vertical-align:top;padding-right:16px;">
            <div style="width:44px;height:44px;background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;border-radius:12px;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:20px;">💬</span>
            </div>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 8px; font-size:17px; font-weight:700; color:#0f172a !important;">Hast du 15 Minuten für ein kurzes Gespräch?</p>
            <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#4338ca !important;">Als Dank erhältst du einen <strong style="color:#312e81 !important;">25€ Amazon-Gutschein</strong>.</p>
            ${renderButton(calendarUrl, 'Termin vereinbaren')}
          </td>
        </tr>
      </table>
    </div>
  `;

  const subject = 'Kurze Frage: Was hält dich zurück?';
  const preheader = 'Hilf uns, Kaufmann Health zu verbessern – mit einem Klick.';

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ViewAction',
      name: 'Feedback geben',
      url: `${BASE_URL}/feedback/quick?patient=${encodeURIComponent(patientId)}&reason=other&utm_source=email&utm_campaign=feedback_request_d10`,
    },
    description: preheader,
  };

  return {
    subject,
    html: renderLayout({ title: 'Kurze Frage', contentHtml, preheader, schema }),
  };
}
