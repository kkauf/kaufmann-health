import { renderLayout, renderButton } from '../layout';
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
  portalUrl?: string; // URL to therapist portal for profile completion
}): EmailContent {
  const name = (params.name || '').trim();
  const hasCalCredentials = params.calLoginUrl && params.calEmail && params.calUsername && params.calPassword;
  const portalUrl = params.portalUrl || 'https://www.kaufmann-health.de/portal';

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Herzlichen Glückwunsch!</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 20px; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.15);">');
  lines.push('<p style="margin:0; font-size:17px; line-height:1.65; color:#064e3b !important; font-weight:600;">✓ Deine Qualifikationsnachweise wurden geprüft und genehmigt</p>');
  lines.push('</div>');

  // Next steps intro
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Damit Klient:innen dich finden und Termine buchen können, richte jetzt bitte deinen Account ein:</p>');

  // Step 1: Cal.com setup
  if (hasCalCredentials) {
    lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; background-image: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.3); margin:0 0 16px; box-shadow: 0 2px 8px 0 rgba(59, 130, 246, 0.1);">');
    lines.push('<p style="margin:0 0 12px; font-size:17px; line-height:1.65; color:#1e40af !important; font-weight:600;">📅 Schritt 1: Verfügbarkeit einrichten</p>');
    lines.push('<p style="margin:0 0 12px; font-size:15px; line-height:1.65; color:#1e3a8a !important;">Logge dich in deinen Kalender ein und hinterlege deine verfügbaren Zeiten. So können Klient:innen direkt Termine bei dir buchen.</p>');
    lines.push('<table style="width:100%; border-collapse:collapse; margin:12px 0; background:#fff; border-radius:8px;">');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px; width:90px; border-bottom:1px solid #e2e8f0;">Login:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; border-bottom:1px solid #e2e8f0;"><a href="' + escapeHtml(params.calLoginUrl!) + '" style="color:#2563eb;">' + escapeHtml(params.calLoginUrl!) + '</a></td></tr>');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">E‑Mail:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; font-family:monospace; border-bottom:1px solid #e2e8f0;">' + escapeHtml(params.calEmail!) + '</td></tr>');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">Username:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; font-family:monospace; border-bottom:1px solid #e2e8f0;">' + escapeHtml(params.calUsername!) + '</td></tr>');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px;">Passwort:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; font-family:monospace; background:#f1f5f9; border-radius:4px;">' + escapeHtml(params.calPassword!) + '</td></tr>');
    lines.push('</table>');
    lines.push('<p style="margin:12px 0 0; font-size:13px; line-height:1.5; color:#64748b !important;">⚠️ Bitte ändere dein Passwort nach dem ersten Login.</p>');
    lines.push('</div>');
  }

  // Step 2: Portal profile completion
  const stepNumber = hasCalCredentials ? '2' : '1';
  lines.push('<div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%) !important; background-image: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(147, 51, 234, 0.3); margin:0 0 16px; box-shadow: 0 2px 8px 0 rgba(147, 51, 234, 0.1);">');
  lines.push(`<p style="margin:0 0 12px; font-size:17px; line-height:1.65; color:#6b21a8 !important; font-weight:600;">✏️ Schritt ${stepNumber}: Profil vervollständigen</p>`);
  lines.push('<p style="margin:0 0 12px; font-size:15px; line-height:1.65; color:#7c3aed !important;">Beschreibe deinen therapeutischen Ansatz, damit Klient:innen dich besser kennenlernen können:</p>');
  lines.push('<ul style="margin:0 0 16px; padding-left:20px; color:#7c3aed; font-size:14px; line-height:1.8;">');
  lines.push('<li>Wer kommt zu dir?</li>');
  lines.push('<li>Worauf legst du in Sitzungen Wert?</li>');
  lines.push('<li>Was erwartet Klient:innen in der ersten Sitzung?</li>');
  lines.push('<li>Über dich</li>');
  lines.push('</ul>');
  lines.push(`<div style="text-align:center;">${renderButton(portalUrl, 'Zum Therapeuten-Portal')}</div>`);
  lines.push('</div>');

  // Help section
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Fragen? Antworte einfach auf diese E‑Mail – wir helfen dir gerne!</p>');
  lines.push('</div>');

  return {
    subject: 'Dein Account ist freigeschaltet – jetzt einrichten',
    html: renderLayout({ title: 'Account freigeschaltet', contentHtml: lines.join('') }),
  };
}
