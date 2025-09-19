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
 
  // Urgency notice (shown after cards by default, can be overridden by admin)
  const urgencyBox = params.bannerOverrideHtml ?? `
    <div style="background:#FEF3C7; padding:12px; border-radius:8px; margin-top:20px;">
      ⏰ <strong>Diese Therapeut:innen haben begrenzte Kapazitäten.</strong><br/>
      Bitte wähle innerhalb von 48 Stunden, damit wir die Kapazitäten für dich sichern können.
    </div>
  `;
 
  // Header and greeting/thanks
  const header = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Deine persönlich kuratierte Auswahl</h1>
  `;
  const greetingHtml = `
    ${name ? `<p style="margin:0 0 12px;">Hallo ${escapeHtml(name)},</p>` : ''}
    <p style="margin:0 0 12px;">Vielen Dank für deine Anfrage bei Kaufmann Health.</p>
  `;
 
  // Trust and quality box
  const trustBox = `
    <div style="background:#F3F4F6; padding:12px; border-radius:8px; margin:0 0 16px;">
      <strong style="display:block; margin-bottom:6px; color:#111827;">Warum diese Auswahl?</strong>
      <ul style="margin:8px 0 0 18px; padding:0; color:#374151;">
        <li style="margin:4px 0;">Wir haben uns deiner Anfrage persönlich angenommen.</li>
        <li style="margin:4px 0;">Auf Basis deiner Präferenzen (z.&nbsp;B. online oder vor Ort) ausgewählt.</li>
        <li style="margin:4px 0;">Wir prüfen die Qualifikationen der Therapeut:innen gründlich (Ausbildung, zertifizierte Fortbildungen, Erfahrung, aktuelle Verfügbarkeit).</li>
        <li style="margin:4px 0;">Spezielle Ausbildungen für Körpertherapie sind in den farbigen Abzeichen sichtbar (z.&nbsp;B. NARM, Somatic Experiencing, Hakomi, Core Energetics).</li>
      </ul>
      <p style="margin:12px 0 0; color:#111827;">Du kannst dieser Auswahl guten Gewissens vertrauen.</p>
    </div>
  `;
 
  // Availability framing (7 days)
  const availabilityLine = `
    <p style="margin:0 0 12px;">Folgende Therapeut:innen haben freie Kapazitäten innerhalb der kommenden 7 Tage.</p>
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
        ? `<div style="margin:0 0 8px 0;"><span style="background:#10B981; color:#ffffff; padding:4px 8px; border-radius:999px; font-size:12px; display:inline-block;">⭐ Beste Übereinstimmung</span></div>`
        : '';
      const borderColor = it.isBest ? '#10B981' : '#E5E7EB';
      return `
        <div style="border:1px solid ${borderColor}; background:#ffffff; padding:16px; margin:16px 0; border-radius:10px;">
          ${bestBadge}
          ${preview}
        </div>
      `;
    })
    .join('');
 
  // Action guidance
  const actionGuidance = `
    <p style="margin:8px 0 0;">Mit einem Klick auf „Auswählen“ reservierst du unverbindlich den nächsten Schritt. Wir stellen den Kontakt direkt her.</p>
  `;
 
  // Modalities explanation (concise, email-friendly)
  const modalitiesHtml = `
    <div style="margin-top:20px;">
      <h2 style="color:#1A365D; font-size:18px; margin:0 0 8px;">Körperorientierte Therapieverfahren – kurz erklärt</h2>
      <div style="font-size:14px; color:#374151;">
        <p style="margin:8px 0;"><strong>NARM (Neuroaffektives Beziehungsmodell):</strong> Fokussiert auf Entwicklungs- und Bindungstrauma sowie Selbstregulation. Achtsame Körperwahrnehmung ohne re-traumatisierende Details.</p>
        <p style="margin:8px 0;"><strong>Somatic Experiencing (SE):</strong> Arbeitet mit der natürlichen Stressreaktion des Körpers. Durch dosierte Annäherung wird das Nervensystem behutsam entlastet.</p>
        <p style="margin:8px 0;"><strong>Hakomi:</strong> Achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht. Neue korrigierende Erfahrungen entstehen sanft.</p>
        <p style="margin:8px 0;"><strong>Core Energetics:</strong> Verbindet körperlichen Ausdruck mit emotionaler Integration. Über Haltung, Atmung und Bewegung werden Spannungen gelöst.</p>
        <small style="display:block; margin-top:6px; color:#6B7280;">Kurzbeschreibungen dienen der Orientierung und ersetzen keine individuelle therapeutische Beratung.</small>
      </div>
    </div>
  `;
 
  const closingHtml = `
    <p style="margin:16px 0 0;">Herzliche Grüße<br/>Dein Team von Kaufmann Health</p>
  `;
 
  const contentHtml = [header, greetingHtml, trustBox, availabilityLine, cardsHtml, actionGuidance, urgencyBox, modalitiesHtml, closingHtml].join('\n');

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
    subject: params.subjectOverride || 'Deine persönlich kuratierte Auswahl – Termine in den nächsten 7 Tagen (bitte innerhalb von 48 Std. wählen)',
    html: renderLayout({ title: 'Therapie-Auswahl', contentHtml, preheader: 'Deine persönlich kuratierte Auswahl ist da – bitte innerhalb von 48 Std. wählen.', schema }),
  };
}
