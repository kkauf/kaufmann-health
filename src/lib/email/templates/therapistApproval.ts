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

export function renderTherapistApproval(params: {
  name?: string | null;
  profileVisible?: boolean; // true if photo_url published
}): EmailContent {
  const name = (params.name || '').trim();
  const visible = Boolean(params.profileVisible);

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">Herzlichen Glückwunsch! Ihr Profil wurde genehmigt.</p>');
  if (visible) {
    lines.push('<p style="margin:0 0 12px;">Ihr Profil ist nun im Verzeichnis sichtbar und Sie können Klienten‑Anfragen erhalten.</p>');
  } else {
    lines.push('<p style="margin:0 0 12px;">Ihre Qualifikationsnachweise wurden genehmigt. Ihr Profilfoto wird nach Freigabe durch das Team veröffentlicht.</p>');
  }
  lines.push('<p style="margin:16px 0 0; color:#6B7280; font-size:12px;">Antworten Sie gerne auf diese E‑Mail bei Fragen.</p>');

  return {
    subject: 'Sie können ab sofort Klienten‑Anfragen erhalten',
    html: renderLayout({ title: 'Profil genehmigt', contentHtml: lines.join('') }),
  };
}
