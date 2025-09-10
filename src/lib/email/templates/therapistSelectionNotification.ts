import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTherapistSelectionNotification(params: {
  therapistName?: string | null;
  patientName?: string | null;
  patientEmail?: string | null;
  patientPhone?: string | null;
  patientCity?: string | null;
  patientIssue?: string | null;
  patientSessionPreference?: 'online' | 'in_person' | null;
  ctaUrl: string; // tracking redirect that leads to a mailto: link
  subjectOverride?: string | null;
}): EmailContent {
  const tName = (params.therapistName || '').trim();
  const pName = (params.patientName || '').trim();
  const pEmail = (params.patientEmail || '').trim();
  const pPhone = (params.patientPhone || '').trim();
  const pCity = (params.patientCity || '').trim();
  const pIssue = (params.patientIssue || '').trim();
  const pFormat = (params.patientSessionPreference || '').trim();

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
  lines.push('<div style="background:#10B981; color:white; padding:16px; border-radius:8px; margin: 0 0 16px;">');
  lines.push('<h2 style="margin:0 0 8px; font-size:20px;">Ein Klient möchte mit Ihnen arbeiten!</h2>');
  lines.push(`<p style=\"margin:0;\">${pName ? esc(pName) : 'Ein/e Klient/in'} hat Sie als Therapeut/in ausgewählt.</p>`);
  lines.push('</div>');

  lines.push('<h3 style="margin:12px 0 8px; font-size:16px;">Klienteninformationen:</h3>');
  lines.push('<ul style="margin:0 0 12px 16px; padding:0;">');
  lines.push(`<li><strong>Name:</strong> ${pName ? esc(pName) : 'Unbekannt'}</li>`);
  if (pIssue) lines.push(`<li><strong>Anliegen:</strong> ${esc(pIssue)}</li>`);
  if (pCity) lines.push(`<li><strong>Ort:</strong> ${esc(pCity)}</li>`);
  if (pFormat) lines.push(`<li><strong>Format:</strong> ${pFormat === 'online' ? 'Online' : 'Vor Ort'}</li>`);
  if (pEmail) lines.push(`<li><strong>E-Mail:</strong> ${esc(pEmail)}</li>`);
  if (pPhone) lines.push(`<li><strong>Telefon:</strong> ${esc(pPhone)}</li>`);
  lines.push('</ul>');

  lines.push('<div style="background:#FEF3C7; padding:12px; border-radius:8px;">');
  lines.push('⚡ <strong>Nächster Schritt: Kontaktieren Sie den Klienten JETZT</strong><br/>Der Klient erwartet Ihre Nachricht innerhalb von 24 Stunden.');
  lines.push('</div>');

  // Big CTA button opening the therapist's email client with prefilled content via tracking redirect
  const ctaUrl = params.ctaUrl;
  lines.push('<div style="margin:20px 0;">');
  lines.push(`<a href="${ctaUrl}" style="background:#2563EB; color:white; padding:16px 32px; display:inline-block; text-decoration:none; border-radius:8px; font-size:18px;">📧 E-Mail an Klient senden (öffnet in Ihrem E-Mail-Programm)</a>`);
  lines.push('</div>');

  const html = renderLayout({ title: 'Neue Auswahl durch Klient/in', contentHtml: lines.join('') });

  return {
    subject: params.subjectOverride?.trim() || '🎉 Neuer Klient hat Sie ausgewählt - Bitte innerhalb 24 Std. kontaktieren',
    html,
  };
}

