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
  lines.push('<p style="margin:0 0 12px;">gute Neuigkeiten! Wir haben einen passenden Therapeuten für Sie gefunden.</p>');
  lines.push('<div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 12px 0;">');
  lines.push(`<p style=\"margin:0; font-weight:600; color:#1A365D;\">${therapist ? escapeHtml(therapist) : 'Ihr Therapeut'}</p>`);
  if (specs.length > 0) {
    lines.push(`<p style=\"margin:4px 0 0; color:#374151;\">Spezialisierung: ${escapeHtml(specs.join(', '))}</p>`);
  }
  lines.push('</div>');
  lines.push('<p style="margin:0 0 12px;">Der Therapeut wird Sie in der Regel innerhalb von 24&nbsp;Stunden kontaktieren. Falls Sie in dieser Zeit nichts hören, antworten Sie gerne auf diese E‑Mail, dann kümmern wir uns sofort darum.</p>');
  lines.push('<p style="margin:16px 0 0; color:#6B7280; font-size:12px;">Sie können jederzeit auf diese Nachricht antworten, falls Sie Ergänzungen oder Fragen haben.</p>');

  const html = renderLayout({
    title: 'Update zu Ihrer Suche',
    contentHtml: [
      `<h1 style=\"color:#1A365D; font-size:22px; margin:0 0 12px;\">Ihr Therapeut wird sich melden</h1>`,
      ...lines,
    ].join(''),
  });

  return {
    subject: `Ihr Therapeut wird sich melden${therapist ? ` - ${therapist}` : ''}`,
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
    <h1 style=\"color:#1A365D; font-size:22px; margin:0 0 12px;\">Update zu Ihrer Therapeutensuche</h1>
    <p style=\"margin:0 0 12px;\">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>
    <p style=\"margin:0 0 12px;\">${safeMessage || 'kurzes Update von uns.'}</p>
    <p style=\"margin:16px 0 0; color:#6B7280; font-size:12px;\">Bei Fragen antworten Sie gerne auf diese E‑Mail.</p>
  `;

  return {
    subject: 'Update zu Ihrer Therapeutensuche',
    html: renderLayout({ title: 'Update', contentHtml }),
  };
}
