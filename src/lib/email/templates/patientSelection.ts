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

export type PatientSelectionItem = {
  id: string; // therapist id
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  approach_text?: string | null;
  accepting_new?: boolean | null;
  city?: string | null;
  selectUrl: string; // absolute URL
  isBest?: boolean;
};

export function renderPatientSelectionEmail(params: {
  patientName?: string | null;
  items: PatientSelectionItem[];
  subjectOverride?: string;
  bannerOverrideHtml?: string; // optional custom banner instead of default urgency box
}): EmailContent {
  const name = (params.patientName || '').trim();
  const items = Array.isArray(params.items) ? params.items : [];

  const introBox = params.bannerOverrideHtml ?? `
    <div style="background: #FEF3C7; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
      ⏰ <strong>Diese Therapeuten haben begrenzte Kapazitäten.</strong><br/>
      Bitte wählen Sie innerhalb von 48 Stunden, sonst vergeben wir Ihren Platz an andere Klienten.
    </div>
  `;

  const header = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Ihre persönlichen Therapievorschläge</h1>
    ${name ? `<p style="margin:0 0 12px;">Hallo ${escapeHtml(name)}, bitte wählen Sie Ihre bevorzugte Option aus.</p>` : ''}
  `;

  const cardsHtml = items
    .map((it) => {
      const button = renderButton(it.selectUrl, '✓ Diese/n Therapeut/in auswählen');
      const preview = renderTherapistPreviewEmail({
        id: it.id,
        first_name: it.first_name,
        last_name: it.last_name,
        photo_url: it.photo_url,
        modalities: it.modalities || [],
        approach_text: it.approach_text || '',
        accepting_new: it.accepting_new ?? null,
        city: it.city || null,
        actionButtonHtml: button,
      });
      const bestBadge = it.isBest
        ? `<span style="background: #10B981; color: white; padding: 4px 8px; position: absolute; top: -10px; left: 10px; border-radius:6px; font-size:12px;">⭐ Beste Übereinstimmung</span>`
        : '';
      return `
        <div style="position:relative; border:2px solid #10B981; padding: 16px; margin: 16px 0; border-radius:8px;">
          ${bestBadge}
          ${preview}
        </div>
      `;
    })
    .join('');

  const contentHtml = [introBox, header, cardsHtml].join('\n');

  return {
    subject: params.subjectOverride || '3 Therapeuten haben diese Woche noch Termine frei (Auswahl innerhalb 48 Stunden)',
    html: renderLayout({ title: 'Therapie-Auswahl', contentHtml }),
  };
}
