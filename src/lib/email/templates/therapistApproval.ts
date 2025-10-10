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
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Herzlichen Glückwunsch!</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 20px; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.15);">');
  lines.push('<p style="margin:0; font-size:17px; line-height:1.65; color:#064e3b !important; font-weight:600;">✓ Dein Profil wurde genehmigt</p>');
  lines.push('</div>');
  if (visible) {
    lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Dein Profil ist nun im Verzeichnis sichtbar und du kannst Klienten‑Anfragen erhalten.</p>');
  } else {
    lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Deine Qualifikationsnachweise wurden genehmigt. Dein Profilfoto wird nach Freigabe durch das Team veröffentlicht.</p>');
  }
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Antworte gerne auf diese E‑Mail bei Fragen.</p>');
  lines.push('</div>');

  return {
    subject: 'Du kannst ab sofort Klienten‑Anfragen erhalten',
    html: renderLayout({ title: 'Profil genehmigt', contentHtml: lines.join('') }),
  };
}
