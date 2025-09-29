import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type TherapistNotificationParams = {
  type: 'selection' | 'outreach' | 'reminder';
  magicUrl: string;
  therapistName?: string | null;
  patientCity?: string | null;
  patientIssue?: string | null;
  patientSessionPreference?: 'online' | 'in_person' | null;
  subjectOverride?: string | null;
  expiresHours?: number | null; // for outreach copy
};

export function renderTherapistNotification(params: TherapistNotificationParams): EmailContent {
  const tName = (params.therapistName || '').trim();
  const city = (params.patientCity || '').trim();
  const issue = (params.patientIssue || '').trim();
  const format = (params.patientSessionPreference || '').trim();
  const expiresHours = typeof params.expiresHours === 'number' && params.expiresHours > 0 ? params.expiresHours : 72;

  const lines: string[] = [];
  // Header based on type
  if (params.type === 'selection') {
    lines.push(`<p style=\"margin:0 0 12px;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    lines.push('<div style="background:#10B981; color:white; padding:16px; border-radius:8px; margin: 0 0 16px;">');
    lines.push('<h2 style="margin:0 0 8px; font-size:20px;">Ein:e Klient:in hat dich ausgewählt</h2>');
    lines.push('<p style="margin:0;">Bitte sieh dir die Anfrage kurz an und gib deine Rückmeldung.</p>');
    lines.push('</div>');
  } else if (params.type === 'reminder') {
    lines.push(`<p style=\"margin:0 0 12px;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    lines.push('<div style="background:#F59E0B; color:white; padding:16px; border-radius:8px; margin: 0 0 16px;">');
    lines.push('<h2 style="margin:0 0 8px; font-size:20px;">⚠️ Erinnerung: Bitte Rückmeldung geben</h2>');
    lines.push('<p style="margin:0;">Eine von Klient:in getroffene Auswahl wartet noch auf deine Antwort.</p>');
    lines.push('</div>');
  } else {
    // outreach
    lines.push(`<p style=\"margin:0 0 12px;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    lines.push('<h2 style="margin:0 0 8px; font-size:20px;">Neue Klientenanfrage</h2>');
    lines.push(`<p style=\"margin:0 0 12px;\">Bitte prüfe die Details und gib deine Rückmeldung. Der Link ist aus Sicherheitsgründen nur für ${expiresHours} Stunden gültig.</p>`);
  }

  // Minimal, non-PII context
  const details: string[] = [];
  if (issue) details.push(`<li><strong>Anliegen:</strong> ${esc(issue)}</li>`);
  if (city) details.push(`<li><strong>Ort:</strong> ${esc(city)}</li>`);
  if (format) details.push(`<li><strong>Format:</strong> ${format === 'online' ? 'Online' : 'Vor Ort'}</li>`);
  if (details.length) {
    lines.push('<h3 style="margin:12px 0 8px; font-size:16px;">Anfrage‑Details</h3>');
    lines.push('<ul style="margin:0 0 12px 16px; padding:0;">');
    lines.push(details.join(''));
    lines.push('</ul>');
  }

  // CTA
  lines.push('<div style="margin:20px 0; text-align:center;">');
  lines.push(renderButton(params.magicUrl, params.type === 'outreach' ? 'Anfrage ansehen' : 'Anfrage ansehen und annehmen'));
  lines.push('</div>');

  lines.push('<p style="color:#6B7280; font-size:12px; margin-top:12px;">Kontaktdaten werden aus Datenschutzgründen erst nach Annahme angezeigt.</p>');

  const title = params.type === 'outreach' ? 'Neue Klientenanfrage' : 'Neue Auswahl durch Klient:in';
  const html = renderLayout({ title, contentHtml: lines.join('') });

  let subject: string;
  if (params.subjectOverride && params.subjectOverride.trim()) subject = params.subjectOverride.trim();
  else if (params.type === 'selection') subject = 'Ein:e Klient:in hat dich ausgewählt – bitte Rückmeldung geben';
  else if (params.type === 'reminder') subject = 'Erinnerung: Klient:in wartet auf deine Antwort';
  else subject = `Neue Klientenanfrage – ${city || 'unbekannt'} – ${issue || 'Allgemein'}`;

  return { subject, html };
}
