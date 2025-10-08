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
  lines.push('<h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Rückfrage zu deinem Profil</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;">Vielen Dank für dein Interesse. Wir benötigen noch Anpassungen an deinem Profil:</p>');

  lines.push('<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding:20px 24px; border-radius:12px; border:1px solid rgba(251, 191, 36, 0.3); margin: 16px 0 20px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.1);">');
  lines.push('<ul style="margin:0 0 0 20px; color:#78350f; font-size:15px; line-height:1.65;">');
  if (params.missingDocuments) {
    lines.push('<li style="margin:8px 0;"><strong style="font-weight:700;">DOKUMENTE:</strong> Bitte lade deine Qualifikationsnachweise hoch.</li>');
  }
  if (photo) {
    lines.push(`<li style="margin:8px 0;"><strong style="font-weight:700;">PROFILFOTO:</strong> ${escapeHtml(photo)}</li>`);
  }
  if (approach) {
    lines.push(`<li style="margin:8px 0;"><strong style="font-weight:700;">ANSATZ‑BESCHREIBUNG:</strong> ${escapeHtml(approach)}</li>`);
  }
  lines.push('</ul>');
  if (notes) {
    lines.push(`<div style=\"margin:16px 0 0; padding:16px; background:rgba(255, 255, 255, 0.6); border-radius:8px;\"><p style=\"margin:0; color:#78350f; font-size:15px; line-height:1.65;\"><strong style=\"font-weight:700;\">Details:</strong> ${escapeHtml(notes)}</p></div>`);
  }
  lines.push('</div>');

  if (params.uploadUrl) {
    lines.push(`<p style=\"margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;\">Bitte aktualisiere dein Profil: <a href=\"${params.uploadUrl}\" style=\"color:#10b981; text-decoration:none; font-weight:700;\">Profil vervollständigen →</a></p>`);
  }
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte gerne auf diese E‑Mail.</p>');
  lines.push('</div>');

  return {
    subject: 'Rückfrage zu deinem Profil',
    html: renderLayout({ title: 'Rückfrage zu deinem Profil', contentHtml: lines.join('') }),
  };
}
