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
  calLoginUrl?: string; // Cal.com login URL (if provisioned)
  calEmail?: string; // Cal.com login email (same as therapist email)
  calUsername?: string; // Cal.com username (for login)
  calPassword?: string; // Cal.com password (plaintext, one-time display)
}): EmailContent {
  const name = (params.name || '').trim();
  const visible = Boolean(params.profileVisible);
  const hasCalCredentials = params.calLoginUrl && params.calEmail && params.calUsername && params.calPassword;

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

  // Cal.com login credentials section
  if (hasCalCredentials) {
    lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; background-image: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.3); margin:20px 0; box-shadow: 0 2px 8px 0 rgba(59, 130, 246, 0.1);">');
    lines.push('<p style="margin:0 0 12px; font-size:17px; line-height:1.65; color:#1e40af !important; font-weight:600;">📅 Dein Kalender-Zugang</p>');
    lines.push('<p style="margin:0 0 12px; font-size:15px; line-height:1.65; color:#1e3a8a !important;">Wir haben dir einen Kalender-Account erstellt, mit dem Klient:innen direkt Termine bei dir buchen können.</p>');
    lines.push('<table style="width:100%; border-collapse:collapse; margin:12px 0;">');
    lines.push('<tr><td style="padding:8px 0; color:#64748b; font-size:14px; width:100px;">Login:</td><td style="padding:8px 0; color:#1e3a8a; font-size:14px;"><a href="' + escapeHtml(params.calLoginUrl!) + '" style="color:#2563eb;">' + escapeHtml(params.calLoginUrl!) + '</a></td></tr>');
    lines.push('<tr><td style="padding:8px 0; color:#64748b; font-size:14px;">E‑Mail:</td><td style="padding:8px 0; color:#1e3a8a; font-size:14px; font-family:monospace;">' + escapeHtml(params.calEmail!) + '</td></tr>');
    lines.push('<tr><td style="padding:8px 0; color:#64748b; font-size:14px;">Username:</td><td style="padding:8px 0; color:#1e3a8a; font-size:14px; font-family:monospace;">' + escapeHtml(params.calUsername!) + '</td></tr>');
    lines.push('<tr><td style="padding:8px 0; color:#64748b; font-size:14px;">Passwort:</td><td style="padding:8px 0; color:#1e3a8a; font-size:14px; font-family:monospace; background:#f1f5f9; padding:8px 12px; border-radius:6px;">' + escapeHtml(params.calPassword!) + '</td></tr>');
    lines.push('</table>');
    lines.push('<p style="margin:12px 0 0; font-size:13px; line-height:1.5; color:#64748b !important;">⚠️ Bitte ändere dein Passwort nach dem ersten Login. Bewahre diese Zugangsdaten sicher auf.</p>');
    lines.push('</div>');
  }

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Antworte gerne auf diese E‑Mail bei Fragen.</p>');
  lines.push('</div>');

  return {
    subject: 'Du kannst ab sofort Klienten‑Anfragen erhalten',
    html: renderLayout({ title: 'Profil genehmigt', contentHtml: lines.join('') }),
  };
}
