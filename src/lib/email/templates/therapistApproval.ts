import { renderLayout } from '../layout';
import { EMAIL_ASSETS_URL } from '@/lib/constants';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Approval email for therapists whose qualifications have been verified.
 * This is a warm welcome with clear next steps for onboarding.
 */
export function renderTherapistApproval(params: {
  name?: string | null;
  profileVisible?: boolean; // true if photo_url published
  calLoginUrl?: string; // Cal.com login URL (if provisioned)
  calEmail?: string; // Cal.com login email (same as therapist email)
  calUsername?: string; // Cal.com username (for login)
  calPassword?: string; // Cal.com password (plaintext, one-time display)
  portalUrl?: string; // URL to therapist portal (magic link)
}): EmailContent {
  const name = (params.name || '').trim();
  const hasCalCredentials = params.calLoginUrl && params.calEmail && params.calUsername && params.calPassword;
  const portalUrl = params.portalUrl || 'https://www.kaufmann-health.de/portal';

  const lines: string[] = [];
  
  // Warm welcome headline
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Willkommen im Netzwerk!</h1>');
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">großartige Neuigkeiten: Deine Qualifikationsnachweise wurden geprüft und wir freuen uns sehr, dich offiziell bei Kaufmann Health begrüßen zu dürfen!</p>');
  
  // Success banner
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.05);">');
  lines.push('<p style="margin:0; font-size:17px; line-height:1.65; color:#065f46 !important; font-weight:600;">✓ Dein Account ist freigeschaltet</p>');
  lines.push('</div>');

  // Intro to next steps
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Um dein Profil für Klient:innen sichtbar zu machen, führe bitte folgende Schritte im Therapeuten-Portal durch. Im Portal findest du eine praktische Checkliste – dort kannst du jeden Schritt abhaken:</p>');
  
  // Checklist overview
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 0 0 24px;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#0f172a !important;">Deine Onboarding-Checkliste:</p>');
  lines.push('<ul style="margin:0; padding-left:20px; color:#475569 !important; font-size:15px; line-height:1.8;">');
  lines.push('<li><strong style="font-weight:600;">Profil-Texte schreiben</strong> – 3 kurze Abschnitte (je 2-3 Sätze) zu deinem Ansatz im Portal</li>');
  lines.push('<li><strong style="font-weight:600;">Verfügbarkeit einrichten</strong> – Deine freien Termine im Kalender hinterlegen</li>');
  lines.push('<li><strong style="font-weight:600;">Kalender-Passwort ändern</strong> – Für deine Sicherheit</li>');
  lines.push('</ul>');
  lines.push('<p style="margin:12px 0 0; font-size:14px; line-height:1.6; color:#64748b !important;">💡 Sobald Profil und Verfügbarkeit eingerichtet sind, kannst du dein Profil im Portal aktivieren.</p>');
  lines.push('</div>');

  // Cal.com credentials box (if provisioned)
  if (hasCalCredentials) {
    lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; background-image: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.2); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(59, 130, 246, 0.05);">');
    lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#1e40af !important;">📅 Deine Kalender-Zugangsdaten</p>');
    lines.push('<p style="margin:0 0 12px; font-size:14px; line-height:1.65; color:#1e3a8a !important;">Mit diesen Daten kannst du dich in deinen Buchungskalender einloggen und deine Verfügbarkeit hinterlegen:</p>');
    lines.push('<table style="width:100%; border-collapse:collapse; margin:12px 0; background:#fff; border-radius:8px;">');
    const calDisplayUrl = params.calLoginUrl!.replace(/^https?:\/\//, '');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px; width:90px; border-bottom:1px solid #e2e8f0;">Login:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; border-bottom:1px solid #e2e8f0;"><a href="' + escapeHtml(params.calLoginUrl!) + '" style="color:#2563eb; text-decoration:underline;">' + escapeHtml(calDisplayUrl) + '</a></td></tr>');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">E‑Mail:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; font-family:monospace; border-bottom:1px solid #e2e8f0;">' + escapeHtml(params.calEmail!) + '</td></tr>');
    lines.push('<tr><td style="padding:10px 12px; color:#64748b; font-size:14px;">Passwort:</td><td style="padding:10px 12px; color:#1e3a8a; font-size:14px; font-family:monospace; background:#fef3c7; border-radius:4px;">' + escapeHtml(params.calPassword!) + '</td></tr>');
    lines.push('</table>');
    lines.push('<p style="margin:12px 0 0; font-size:13px; line-height:1.5; color:#64748b !important;">⚠️ Bitte ändere dein Passwort nach dem ersten Login – das ist einer der Punkte auf deiner Checkliste.</p>');
    lines.push('</div>');
  }

  // CTA Button to portal
  lines.push(`
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.2);">
          <a href="${portalUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">
            Profil-Texte im Portal schreiben →
          </a>
        </td>
      </tr>
    </table>
  `);

  // Video tutorial hint
  lines.push('<p style="margin:0 0 16px; font-size:15px; line-height:1.65; color:#475569 !important;">Im Portal findest du auch ein kurzes <strong style="font-weight:600;">Video-Tutorial</strong>, das dir die Kalender-Einrichtung Schritt für Schritt zeigt – schau gerne rein, falls du Unterstützung brauchst.</p>');

  // Future login explanation
  lines.push('<div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%) !important; background-image: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(202, 138, 4, 0.2); margin:0 0 24px;">');
  lines.push('<p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#854d0e !important;">💡 Gut zu wissen: So loggst du dich später ein</p>');
  lines.push('<p style="margin:0; font-size:14px; line-height:1.6; color:#713f12 !important;">Besuche einfach <a href="https://www.kaufmann-health.de/portal/login" style="color:#ca8a04; text-decoration:underline;">kaufmann-health.de/portal/login</a> und gib deine E‑Mail-Adresse ein. Du erhältst dann einen Login-Link per E‑Mail – ganz ohne Passwort.</p>');
  lines.push('</div>');

  // Founder signature
  lines.push(`
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:16px;">
          <img src="${EMAIL_ASSETS_URL}/profile-pictures/konstantin.JPEG" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:2px solid #e2e8f0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.1);" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a !important; font-size:15px; margin-bottom:2px;">Konstantin Kaufmann</div>
          <div style="color:#64748b !important; font-size:14px; line-height:1.4;">Gründer, Kaufmann Health</div>
        </td>
      </tr>
    </table>
  `);

  // Help footer
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte einfach auf diese E‑Mail – ich helfe dir gerne weiter.</p>');
  lines.push('</div>');

  return {
    subject: 'Willkommen bei Kaufmann Health – dein Account ist bereit!',
    html: renderLayout({
      title: 'Willkommen bei Kaufmann Health',
      contentHtml: lines.join(''),
      preheader: 'Deine Qualifikationen wurden geprüft. Jetzt Profil einrichten und loslegen!',
    }),
  };
}
