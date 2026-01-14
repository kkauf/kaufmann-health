import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Patient apology email - simple format matching production selection email.
 * Just apologizes and links to the matches page - no embedded therapist previews.
 */
export function renderPatientApologyEmail(params: {
  patientName?: string | null;
  matchesUrl: string;
  customMessage?: string;
}): EmailContent {
  const name = (params.patientName || '').trim();
  const firstName = name ? name.split(/\s+/)[0] : '';
  const matchesUrl = `${params.matchesUrl}?direct=1`;
  const customMessage = (params.customMessage || '').trim();

  const header = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 20px; line-height:1.3; letter-spacing:-0.02em;">Deine Therapeuten-Auswahl ist bereit</h1>
  `;

  const greeting = firstName
    ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(firstName)},</p>`
    : '';

  const apologyText = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Vielen Dank für deine Anfrage bei Kaufmann Health. <strong style="color:#0f172a !important;">Entschuldige bitte die Verzögerung</strong> – durch einen technischen Fehler konnten wir dir nicht sofort passende Therapeut:innen anzeigen.
    </p>
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Das haben wir jetzt behoben und deine persönliche Auswahl ist bereit.
    </p>
  `;

  const customMessageBox = customMessage
    ? `
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; background-image: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.3); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(59, 130, 246, 0.08);">
        <p style="margin:0; font-size:16px; line-height:1.65; color:#1e3a8a !important; white-space:pre-wrap;">${escapeHtml(customMessage)}</p>
      </div>
    `
    : '';

  const ctaBox = `
    <div style="margin: 0 0 32px; text-align: center; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.3); box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.1);">
      ${renderButton(matchesUrl, 'Deine persönliche Therapeutenauswahl ansehen')}
    </div>
  `;

  const trustBox = `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <strong style="display:block; margin-bottom:12px; color:#0f172a !important; font-size:17px; font-weight:700;">Was dich erwartet:</strong>
      <ul style="margin:8px 0 0 18px; padding:0; color:#475569 !important; line-height:1.65;">
        <li style="margin-bottom:6px;">Handverlesene Therapeut:innen passend zu deinen Wünschen</li>
        <li style="margin-bottom:6px;">Kostenloses 15-minütiges Kennenlerngespräch buchbar</li>
        <li>Alle Therapeut:innen sind von uns persönlich geprüft</li>
      </ul>
    </div>
  `;

  const supportNote = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Falls du Fragen hast, antworte einfach auf diese E-Mail – wir helfen dir gerne weiter.
    </p>
  `;

  const closing = `
    <p style="margin:24px 0 0; font-size:16px; line-height:1.65; color:#475569 !important;">
      Herzliche Grüße<br/>
      <strong style="color:#0f172a !important;">Dein Team von Kaufmann Health</strong>
    </p>
  `;

  const contentHtml = [
    header,
    greeting,
    apologyText,
    customMessageBox,
    ctaBox,
    trustBox,
    supportNote,
    closing,
  ].join('\n');

  return {
    subject: 'Deine Therapeuten-Auswahl ist bereit',
    html: renderLayout({
      title: 'Deine Therapeuten-Auswahl',
      contentHtml,
      preheader: 'Entschuldige die Verzögerung – deine persönliche Auswahl ist jetzt bereit.',
    }),
  };
}
