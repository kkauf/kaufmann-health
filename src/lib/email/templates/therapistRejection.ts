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

export function renderTherapistRejection(params: {
  name?: string | null;
  uploadUrl?: string;
  missingDocuments?: boolean;
  photoIssue?: string | null;
  approachIssue?: string | null;
  adminNotes?: string | null;
}): EmailContent {
  const name = (params.name || '').trim();
  const notes = (params.adminNotes || '').trim();
  const photo = (params.photoIssue || '').trim();
  const approach = (params.approachIssue || '').trim();
  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">Vielen Dank für dein Interesse. Wir benötigen noch Anpassungen an deinem Profil:</p>');

  lines.push('<div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 8px 0 12px;">');
  lines.push('<ul style="margin:0 0 0 18px; color:#374151;">');
  if (params.missingDocuments) {
    lines.push('<li>DOKUMENTE: Bitte lade deine Qualifikationsnachweise hoch.</li>');
  }
  if (photo) {
    lines.push(`<li>PROFILFOTO: ${escapeHtml(photo)}</li>`);
  }
  if (approach) {
    lines.push(`<li>ANSATZ‑BESCHREIBUNG: ${escapeHtml(approach)}</li>`);
  }
  lines.push('</ul>');
  if (notes) {
    lines.push(`<p style=\"margin:8px 0 0; color:#374151;\"><strong>Details:</strong> ${escapeHtml(notes)}</p>`);
  }
  lines.push('</div>');

  if (params.uploadUrl) {
    lines.push(`<p style=\"margin:0 0 12px;\">Bitte aktualisiere dein Profil: <a href=\"${params.uploadUrl}\" style=\"color:#4A9B8E; text-decoration:none; font-weight:600;\">Profil vervollständigen</a></p>`);
  }
  lines.push('<p style="margin:16px 0 0; color:#6B7280; font-size:12px;">Bei Fragen antworte gerne auf diese E‑Mail.</p>');

  return {
    subject: 'Rückfrage zu deinem Profil',
    html: renderLayout({ title: 'Rückfrage zu deinem Profil', contentHtml: lines.join('') }),
  };
}
