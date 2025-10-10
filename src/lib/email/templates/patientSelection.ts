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
  matchesUrl?: string; // optional: link to the pre-auth matches page
}): EmailContent {
  const name = (params.patientName || '').trim();
  const items = Array.isArray(params.items) ? params.items : [];
 
  // Gentle urgency notice (shown after cards by default, can be overridden by admin)
  const urgencyBox = params.bannerOverrideHtml ?? `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; background-image: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(251, 191, 36, 0.3); margin-top:24px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.1);">
      <p style="margin:0; font-size:15px; line-height:1.6; color:#78350f !important;"><strong style="font-weight:700; color:#78350f !important;">💡 Tipp:</strong> Diese Therapeut:innen haben begrenzte Kapazitäten. Wir empfehlen, sich zeitnah zu melden, um einen Termin in den nächsten 7 Tagen zu sichern.</p>
    </div>
  `;
 
  // Header and greeting/thanks
  const header = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Deine handverlesene Auswahl</h1>
  `;
  const greetingHtml = `
    ${name ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Vielen Dank für deine Anfrage bei Kaufmann Health.</p>
  `;
 
  // Primary CTA to view matches page (prominent when matchesUrl provided)
  const matchesCta = params.matchesUrl
    ? `
      <div style="margin: 0 0 32px; text-align: center; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.3); box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.1);">
        ${renderButton(params.matchesUrl, 'Deine persönliche Therapeutenauswahl ansehen')}
      </div>
    `
    : '';
 
  // Trust and quality box
  const trustBox = `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <strong style="display:block; margin-bottom:12px; color:#0f172a !important; font-size:17px; font-weight:700;">Warum diese Auswahl?</strong>
      <ul style="margin:8px 0 0 18px; padding:0; color:#475569 !important; line-height:1.65;">
        <li style="margin:8px 0; color:#475569 !important;">Wir haben uns deiner Anfrage persönlich angenommen.</li>
        <li style="margin:8px 0; color:#475569 !important;">Auf Basis deiner Präferenzen (z.&nbsp;B. online oder vor Ort) ausgewählt.</li>
        <li style="margin:8px 0; color:#475569 !important;">Wir prüfen die Qualifikationen der Therapeut:innen gründlich (Ausbildung, zertifizierte Fortbildungen, Erfahrung, aktuelle Verfügbarkeit).</li>
        <li style="margin:8px 0; color:#475569 !important;">Spezielle Ausbildungen für Körpertherapie sind in den farbigen Abzeichen sichtbar (z.&nbsp;B. NARM, Somatic Experiencing, Hakomi, Core Energetics).</li>
      </ul>
      <p style="margin:16px 0 0; color:#0f172a !important; font-weight:600;">Du kannst dieser Auswahl guten Gewissens vertrauen.</p>
    </div>
  `;
 
  // Availability framing (7 days)
  const availabilityLine = `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Folgende Therapeut:innen haben freie Kapazitäten innerhalb der kommenden 7 Tage.</p>
  `;

  const cardsHtml = items
    .map((it) => {
      const button = renderButton(it.selectUrl, '✓ Diese:n Therapeut:in auswählen');
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
        ? `<div style="margin:0 0 12px 0;"><span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color:#ffffff !important; padding:6px 12px; border-radius:999px; font-size:13px; font-weight:700; display:inline-block; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.25);">⭐ Beste Übereinstimmung</span></div>`
        : '';
      const borderColor = it.isBest ? 'rgba(16, 185, 129, 0.4)' : 'rgba(226, 232, 240, 0.8)';
      const boxShadow = it.isBest ? 'box-shadow: 0 4px 12px 0 rgba(16, 185, 129, 0.12);' : 'box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);';
      return `
        <div style="border:1px solid ${borderColor}; background:#ffffff !important; padding:20px; margin:20px 0; border-radius:12px; ${boxShadow}">
          ${bestBadge}
          ${preview}
        </div>
      `;
    })
    .join('');
 
  // Action guidance
  const actionGuidance = `
    <p style="margin:12px 0 0; font-size:15px; line-height:1.65; color:#64748b !important;">Mit einem Klick auf „Auswählen" reservierst du unverbindlich den nächsten Schritt. Wir stellen den Kontakt direkt her.</p>
  `;
 
  // Modalities explanation (concise, email-friendly)
  const modalitiesHtml = `
    <div style="margin-top:32px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8);">
      <h2 style="color:#0f172a !important; font-size:20px; font-weight:700; margin:0 0 16px; line-height:1.3;">Körperorientierte Therapieverfahren – kurz erklärt</h2>
      <div style="font-size:15px; color:#475569 !important; line-height:1.65;">
        <p style="margin:12px 0; color:#475569 !important;"><strong style="color:#0f172a !important; font-weight:600;">NARM (Neuroaffektives Beziehungsmodell):</strong> Fokussiert auf Entwicklungs- und Bindungstrauma sowie Selbstregulation. Achtsame Körperwahrnehmung ohne re-traumatisierende Details.</p>
        <p style="margin:12px 0; color:#475569 !important;"><strong style="color:#0f172a !important; font-weight:600;">Somatic Experiencing (SE):</strong> Arbeitet mit der natürlichen Stressreaktion des Körpers. Durch dosierte Annäherung wird das Nervensystem behutsam entlastet.</p>
        <p style="margin:12px 0; color:#475569 !important;"><strong style="color:#0f172a !important; font-weight:600;">Hakomi:</strong> Achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht. Neue korrigierende Erfahrungen entstehen sanft.</p>
        <p style="margin:12px 0; color:#475569 !important;"><strong style="color:#0f172a !important; font-weight:600;">Core Energetics:</strong> Verbindet körperlichen Ausdruck mit emotionaler Integration. Über Haltung, Atmung und Bewegung werden Spannungen gelöst.</p>
        <small style="display:block; margin-top:12px; color:#64748b !important; font-size:13px; line-height:1.5;">Kurzbeschreibungen dienen der Orientierung und ersetzen keine individuelle therapeutische Beratung.</small>
      </div>
    </div>
  `;

  const closingHtml = `
    <p style="margin:24px 0 0; font-size:16px; line-height:1.65; color:#475569 !important;">Herzliche Grüße<br/><strong style="color:#0f172a !important;">Dein Team von Kaufmann Health</strong></p>
  `;
 
  // Only show cards if no matchesUrl (backward compatibility)
  const cardsSection = params.matchesUrl ? '' : [availabilityLine, cardsHtml, actionGuidance, urgencyBox].join('\n');
  const contentHtml = [header, greetingHtml, matchesCta, trustBox, cardsSection, modalitiesHtml, closingHtml].join('\n');

  const actionTarget = items[0]?.selectUrl;
  const schema = actionTarget
    ? {
        '@context': 'http://schema.org',
        '@type': 'EmailMessage',
        potentialAction: {
          '@type': 'ViewAction',
          target: actionTarget,
          url: actionTarget,
          name: 'Therapeuten ansehen',
        },
        description: 'Deine personalisierten Therapeuten-Empfehlungen',
      }
    : undefined;

  return {
    subject: params.subjectOverride || 'Deine handverlesene Auswahl – Termine in den nächsten 7 Tagen (bitte innerhalb von 48 Std. wählen)',
    html: renderLayout({ title: 'Therapie-Auswahl', contentHtml, preheader: 'Deine handverlesene Auswahl ist da – bitte innerhalb von 48 Std. wählen.', schema }),
  };
}
