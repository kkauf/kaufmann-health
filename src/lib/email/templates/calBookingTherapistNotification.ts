import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

function esc(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  } catch {
    return d;
  }
}

export type CalBookingTherapistNotificationParams = {
  therapistName?: string | null;
  patientName?: string | null;
  patientEmail?: string | null;
  dateIso: string;
  timeLabel: string; // HH:MM
  isIntro: boolean; // true for free intro sessions
  // Patient context from questionnaire (helps therapist prepare)
  patientPhone?: string | null;
  patientCity?: string | null;
  patientConcerns?: string | null; // additional_info free text
  patientSchwerpunkte?: string[]; // focus areas (Trauma, Burnout, etc.)
  patientSessionPreference?: 'online' | 'in_person' | null;
  // Location details
  locationType?: 'video' | 'in_person';
  locationAddress?: string | null;
  videoUrl?: string | null;
  // Portal magic link for therapist rebooking
  portalUrl?: string | null;
};

/**
 * Cal.com booking notification email for therapists.
 * 
 * Key differences from old KH booking notification:
 * - Clarifies this is supplementary to Cal.com's notification
 * - Explains the client came through Kaufmann Health
 * - For intros: reminds it's a free 15-min session
 * - Patient contact details included (for therapist context)
 */
export function renderCalBookingTherapistNotification(params: CalBookingTherapistNotificationParams): EmailContent {
  const tName = (params.therapistName || '').trim();
  const pName = (params.patientName || '').trim();
  const pEmail = (params.patientEmail || '').trim();
  const date = formatDate(params.dateIso);
  const time = params.timeLabel;
  const isIntro = params.isIntro;
  // Patient context fields
  const pPhone = (params.patientPhone || '').trim();
  const pCity = (params.patientCity || '').trim();
  const pConcerns = (params.patientConcerns || '').trim();
  const pSchwerpunkte = params.patientSchwerpunkte || [];
  const pSessionPref = params.patientSessionPreference;

  const lines: string[] = [];
  
  // Header
  const headline = isIntro ? 'Neues Kennenlerngespräch gebucht' : 'Neue Buchung über Kaufmann Health';
  lines.push(`<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">${headline}</h1>`);
  
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
  
  if (isIntro) {
    lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Ein:e neue:r Klient:in hat über Kaufmann Health ein <strong>kostenloses Kennenlerngespräch (15 Min.)</strong> bei dir gebucht.</p>');
  } else {
    lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Ein:e Klient:in hat über Kaufmann Health eine Sitzung bei dir gebucht.</p>');
  }

  // Booking details
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin: 16px 0;">');
  lines.push('<ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:1.65; color:#334155 !important;">');
  lines.push(`<li><strong>Datum:</strong> ${esc(date)}</li>`);
  lines.push(`<li><strong>Uhrzeit:</strong> ${esc(time)} Uhr</li>`);
  if (params.locationType === 'in_person') {
    lines.push(`<li><strong>Format:</strong> Vor Ort${params.locationAddress ? ` – ${esc(params.locationAddress)}` : ''}</li>`);
  } else {
    if (params.videoUrl) {
      lines.push(`<li><strong>Format:</strong> <a href="${esc(params.videoUrl)}" style="color:#059669 !important; text-decoration:underline;">Online-Videogespräch</a></li>`);
    } else {
      lines.push('<li><strong>Format:</strong> Online-Videogespräch</li>');
    }
  }
  if (isIntro) {
    lines.push('<li><strong>Art:</strong> Kostenloses Kennenlernen (15 Min.)</li>');
  }
  lines.push('</ul>');
  lines.push('</div>');

  // Client info (if available)
  if (pName || pEmail || pPhone) {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin-top:16px;">');
    lines.push('<p style="margin:0 0 8px; color:#475569 !important; font-size:14px; line-height:1.6;"><strong>Klient:in:</strong></p>');
    if (pName) {
      lines.push(`<p style="margin:0; color:#334155 !important; font-size:14px; line-height:1.6;">Name: ${esc(pName)}</p>`);
    }
    if (pEmail) {
      lines.push(`<p style="margin:0; color:#334155 !important; font-size:14px; line-height:1.6;">E-Mail: ${esc(pEmail)}</p>`);
    }
    if (pPhone) {
      lines.push(`<p style="margin:0; color:#334155 !important; font-size:14px; line-height:1.6;">Telefon: ${esc(pPhone)}</p>`);
    }
    lines.push('</div>');
  }

  // Patient context from questionnaire (if available)
  const hasContext = pCity || pSessionPref || pConcerns || pSchwerpunkte.length > 0;
  if (hasContext) {
    lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(59,130,246,0.3); margin-top:16px;">');
    lines.push('<p style="margin:0 0 12px; color:#1e40af !important; font-size:14px; line-height:1.6; font-weight:600;">Kontext zur Anfrage:</p>');

    if (pCity) {
      lines.push(`<p style="margin:0 0 4px; color:#1e3a8a !important; font-size:14px; line-height:1.6;"><strong>Wohnort:</strong> ${esc(pCity)}</p>`);
    }
    if (pSessionPref) {
      const formatLabel = pSessionPref === 'online' ? 'Online' : 'Vor Ort';
      lines.push(`<p style="margin:0 0 4px; color:#1e3a8a !important; font-size:14px; line-height:1.6;"><strong>Bevorzugtes Format:</strong> ${formatLabel}</p>`);
    }
    if (pSchwerpunkte.length > 0) {
      lines.push(`<p style="margin:0 0 4px; color:#1e3a8a !important; font-size:14px; line-height:1.6;"><strong>Schwerpunkte:</strong> ${pSchwerpunkte.map(s => esc(s)).join(', ')}</p>`);
    }
    if (pConcerns) {
      lines.push(`<p style="margin:8px 0 0; color:#1e3a8a !important; font-size:14px; line-height:1.6;"><strong>Anliegen:</strong></p>`);
      lines.push(`<p style="margin:4px 0 0; color:#334155 !important; font-size:14px; line-height:1.6; white-space:pre-wrap;">${esc(pConcerns)}</p>`);
    }

    lines.push('</div>');
  }

  // Calendar invite note
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin-top:16px;">');
  lines.push('<p style="margin:0; color:#064e3b !important; font-size:14px; line-height:1.6;"><strong>📅 Kalender:</strong> Diese E-Mail enthält eine Kalendereinladung (.ics) – öffne den Anhang, um den Termin zu deinem Kalender hinzuzufügen.</p>');
  lines.push('</div>');

  // Portal CTA - direct therapists to the portal for rebooking
  if (params.portalUrl) {
    const ctaLabel = isIntro
      ? 'Nach dem Kennenlernen: Folgetermin vereinbaren'
      : 'Nach der Sitzung: Nächsten Termin vereinbaren';

    lines.push('<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(245, 158, 11, 0.4); margin-top:16px;">');
    lines.push(`<p style="margin:0 0 12px; color:#92400e !important; font-size:14px; line-height:1.6;"><strong>📝 ${ctaLabel}</strong></p>`);
    lines.push(`<p style="margin:0 0 12px; color:#78350f !important; font-size:14px; line-height:1.6;">Im Portal findest du alle deine Termine und kannst Folgetermine direkt mit einem Klick buchen.</p>`);
    lines.push(`<a href="${esc(params.portalUrl)}" style="display:inline-block; background:#f59e0b; color:#ffffff !important; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px;">Zum Therapeuten-Portal</a>`);
    lines.push('</div>');
  }

  // Footer
  lines.push('<p style="margin:16px 0 0; font-size:14px; color:#64748b !important;">Bei Fragen antworte einfach auf diese E-Mail.</p>');

  const subject = isIntro 
    ? `Neues Kennenlernen: ${date}, ${time} Uhr`
    : `Neue Buchung: ${date}, ${time} Uhr`;
  
  const html = renderLayout({
    title: headline,
    contentHtml: lines.join(''),
    preheader: isIntro ? 'Kostenloses Kennenlerngespräch gebucht' : 'Neue Buchung über Kaufmann Health',
  });

  return { subject, html };
}
