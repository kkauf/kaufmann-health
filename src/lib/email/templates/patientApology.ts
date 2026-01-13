import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import { renderTherapistPreviewEmail } from '../components/therapistPreview';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type ApologyTherapistItem = {
  id: string;
  first_name: string;
  last_name?: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  approach_text?: string | null;
  city?: string | null;
  isBest?: boolean;
};

export function renderPatientApologyEmail(params: {
  patientName?: string | null;
  matchesUrl: string;
  therapists?: ApologyTherapistItem[];
  customMessage?: string;
}): EmailContent {
  const name = (params.patientName || '').trim();
  const firstName = name ? name.split(/\s+/)[0] : '';
  const matchesUrl = `${params.matchesUrl}?direct=1`;
  const therapists = params.therapists || [];
  const customMessage = (params.customMessage || '').trim();

  const header = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 20px; line-height:1.3; letter-spacing:-0.02em;">Deine Therapeut:innen – Entschuldigung für die Verzögerung</h1>
  `;

  const greeting = firstName
    ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Liebe/r ${escapeHtml(firstName)},</p>`
    : '';

  const apologyBox = `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; background-image: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(245, 158, 11, 0.3); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(245, 158, 11, 0.1);">
      <p style="margin:0; font-size:16px; line-height:1.65; color:#78350f !important;">
        <strong style="color:#78350f !important;">Wir möchten uns aufrichtig entschuldigen.</strong> Durch einen technischen Fehler konnten wir dir nicht sofort passende Therapeut:innen anzeigen.
      </p>
    </div>
  `;

  const customMessageBox = customMessage
    ? `
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; background-image: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.3); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(59, 130, 246, 0.08);">
        <p style="margin:0; font-size:16px; line-height:1.65; color:#1e3a8a !important; white-space:pre-wrap;">${escapeHtml(customMessage)}</p>
      </div>
    `
    : '';

  const resolutionText = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      <strong style="color:#0f172a !important;">Das haben wir jetzt behoben.</strong> Wir haben deine Therapeuten-Vorschläge neu generiert – basierend auf deinen Präferenzen findest du jetzt passende Therapeut:innen, die für dich ausgewählt wurden.
    </p>
  `;

  const ctaBox = `
    <div style="margin: 0 0 24px; text-align: center; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.3); box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.1);">
      ${renderButton(matchesUrl, 'Deine Therapeut:innen ansehen')}
    </div>
  `;

  const freeConsultationNote = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Du kannst direkt ein <strong style="color:#0f172a !important;">kostenloses 15-minütiges Kennenlerngespräch</strong> buchen – unverbindlich und ohne Risiko. So kannst du herausfinden, ob die Chemie stimmt.
    </p>
  `;

  let therapistCardsHtml = '';
  if (therapists.length > 0) {
    const cardsHtml = therapists
      .map((t) => {
        const preview = renderTherapistPreviewEmail({
          id: t.id,
          first_name: t.first_name,
          last_name: t.last_name || '',
          photo_url: t.photo_url,
          modalities: t.modalities || [],
          approach_text: t.approach_text || '',
          accepting_new: true,
          city: t.city || null,
          actionButtonHtml: '',
        });
        const bestBadge = t.isBest
          ? `<div style="margin:0 0 12px 0;"><span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color:#ffffff !important; padding:6px 12px; border-radius:999px; font-size:13px; font-weight:700; display:inline-block; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.25);">⭐ Beste Übereinstimmung</span></div>`
          : '';
        const borderColor = t.isBest ? 'rgba(16, 185, 129, 0.4)' : 'rgba(226, 232, 240, 0.8)';
        return `
          <div style="border:1px solid ${borderColor}; background:#ffffff !important; padding:20px; margin:16px 0; border-radius:12px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
            ${bestBadge}
            ${preview}
          </div>
        `;
      })
      .join('');

    therapistCardsHtml = `
      <p style="margin:24px 0 16px; font-size:15px; line-height:1.65; color:#64748b !important; font-weight:600;">Deine neuen Therapeuten-Empfehlungen:</p>
      ${cardsHtml}
    `;
  }

  const supportNote = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Falls du Fragen hast oder Unterstützung bei der Auswahl brauchst, sind wir jederzeit für dich da. <strong style="color:#0f172a !important;">Antworte einfach auf diese E-Mail</strong> – wir helfen dir gerne weiter.
    </p>
  `;

  const finalApology = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">
      Nochmals entschuldige die Unannehmlichkeiten – wir wissen, wie wichtig es ist, schnell die richtige Unterstützung zu finden.
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
    apologyBox,
    customMessageBox,
    resolutionText,
    ctaBox,
    freeConsultationNote,
    therapistCardsHtml,
    supportNote,
    finalApology,
    closing,
  ].join('\n');

  return {
    subject: 'Deine Therapeut:innen – Entschuldigung für die Verzögerung',
    html: renderLayout({
      title: 'Entschuldigung – Deine Therapeut:innen',
      contentHtml,
      preheader: 'Wir haben deine Therapeuten-Auswahl neu generiert. Entschuldige die Verzögerung.',
    }),
  };
}
