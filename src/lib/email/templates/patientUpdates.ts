import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPatientMatchFound(params: {
  patientName?: string | null;
  therapistName?: string | null;
  specializations?: string[] | null;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const therapist = (params.therapistName || '').trim();
  const specs = Array.isArray(params.specializations) ? params.specializations.filter(Boolean) : [];

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">gute Neuigkeiten! Wir haben eine:n passende:n Therapeut:in für dich gefunden.</p>');
  lines.push('<div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 12px 0;">');
  lines.push(`<p style=\"margin:0; font-weight:600; color:#1A365D;\">${therapist ? escapeHtml(therapist) : 'Dein:e Therapeut:in'}</p>`);
  if (specs.length > 0) {
    lines.push(`<p style=\"margin:4px 0 0; color:#374151;\">Spezialisierung: ${escapeHtml(specs.join(', '))}</p>`);
  }
  lines.push('</div>');
  lines.push('<p style="margin:0 0 12px;">Der/die Therapeut:in wird dich in der Regel innerhalb von 24&nbsp;Stunden kontaktieren. Falls du in dieser Zeit nichts hörst, antworte gerne auf diese E‑Mail, dann kümmern wir uns sofort darum.</p>');
  lines.push('<p style="margin:16px 0 0; color:#6B7280; font-size:12px;">Du kannst jederzeit auf diese Nachricht antworten, falls du Ergänzungen oder Fragen hast.</p>');

  const html = renderLayout({
    title: 'Update zu deiner Suche',
    contentHtml: [
      `<h1 style=\"color:#1A365D; font-size:22px; margin:0 0 12px;\">Dein:e Therapeut:in wird sich melden</h1>`,
      ...lines,
    ].join(''),
  });

  return {
    subject: `Dein:e Therapeut:in wird sich melden${therapist ? ` - ${therapist}` : ''}`,
    html,
  };
}

export function renderPatientCustomUpdate(params: {
  patientName?: string | null;
  message?: string | null;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const message = (params.message || '').trim();
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br/>');

  const contentHtml = `
    <h1 style=\"color:#1A365D; font-size:22px; margin:0 0 12px;\">Update zu deiner Therapeut:innensuche</h1>
    <p style=\"margin:0 0 12px;\">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>
    <p style=\"margin:0 0 12px;\">${safeMessage || 'kurzes Update von uns.'}</p>
    <p style=\"margin:16px 0 0; color:#6B7280; font-size:12px;\">Bei Fragen antworte gerne auf diese E‑Mail.</p>
  `;

  return {
    subject: 'Update zu deiner Therapeut:innensuche',
    html: renderLayout({ title: 'Update', contentHtml }),
  };
}
