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
}): EmailContent {
  const tName = (params.therapistName || '').trim();
  const pName = (params.patientName || '').trim();
  const pEmail = (params.patientEmail || '').trim();
  const pPhone = (params.patientPhone || '').trim();

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">ein/e Klient/in hat Sie als bevorzugte/n Therapeut/in ausgewählt.</p>');
  lines.push('<div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 12px 0;">');
  lines.push(`<p style=\"margin:0;\"><strong>Klient/in:</strong> ${pName ? esc(pName) : 'Unbekannt'}</p>`);
  if (pEmail) lines.push(`<p style=\"margin:4px 0 0;\"><strong>E-Mail:</strong> ${esc(pEmail)}</p>`);
  if (pPhone) lines.push(`<p style=\"margin:4px 0 0;\"><strong>Telefon:</strong> ${esc(pPhone)}</p>`);
  lines.push('</div>');
  lines.push('<p style="margin:0 0 12px;">Bitte kontaktieren Sie die Person innerhalb von 24 Stunden, um einen Termin zu vereinbaren.</p>');

  const html = renderLayout({ title: 'Neue Auswahl durch Klient/in', contentHtml: lines.join('') });

  return {
    subject: 'Ein/e Klient/in hat Sie ausgewählt – bitte innerhalb 24h melden',
    html,
  };
}
