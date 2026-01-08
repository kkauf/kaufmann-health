import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderTherapistCalOnboarding(params: {
  name?: string | null;
  calEmail: string;
  calPassword: string;
  calLoginUrl: string;
  portalUrl: string;
}): EmailContent {
  const name = (params.name || '').trim();

  const contentHtml = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Dein Terminkalender ist bereit!</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Großartige Neuigkeiten! Wir haben deinen persönlichen Terminkalender eingerichtet. Im Therapeuten-Portal findest du alles, was du brauchst, um loszulegen.</p>

    <div style="text-align:center; margin: 0 0 24px;">${renderButton(params.portalUrl, 'Zum Therapeuten-Portal')}</div>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 0 0 24px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <h3 style="margin:0 0 16px; color:#0f172a !important; font-size:18px; font-weight:700;">📋 Nächste Schritte</h3>
      <ol style="margin:0; padding-left:20px; color:#475569 !important; font-size:15px; line-height:1.65;">
        <li style="margin:8px 0;"><strong style="color:#0f172a !important;">Verfügbarkeit einrichten:</strong> Logge dich in Cal.com ein und stelle deine freien Zeiten ein.</li>
        <li style="margin:8px 0;"><strong style="color:#0f172a !important;">Buchungen freischalten:</strong> Klicke im Portal auf „Buchungen freischalten", sobald du bereit bist.</li>
      </ol>
      <p style="margin:16px 0 0; color:#64748b !important; font-size:14px; line-height:1.5;">Im Portal findest du auch Anleitungen und ein Video-Tutorial.</p>
    </div>

    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.1);">
      <h3 style="margin:0 0 16px; color:#064e3b !important; font-size:18px; font-weight:700;">🔐 Deine Cal.com Zugangsdaten</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600; width:100px;">Login:</td>
          <td style="padding:8px 0;"><a href="${escapeHtml(params.calLoginUrl)}" style="color:#059669 !important; text-decoration:none; font-weight:600;">${escapeHtml(params.calLoginUrl)}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600;">E-Mail:</td>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px;">${escapeHtml(params.calEmail)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600;">Passwort:</td>
          <td style="padding:8px 0; font-family:monospace; font-size:16px; color:#064e3b !important; background:#ffffff; padding:8px 12px; border-radius:6px; display:inline-block;">${escapeHtml(params.calPassword)}</td>
        </tr>
      </table>
      <p style="margin:12px 0 0; color:#064e3b !important; font-size:13px; line-height:1.5;">Bitte ändere dein Passwort nach dem ersten Login (Einstellungen → Sicherheit).</p>
    </div>

    <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(239, 68, 68, 0.3); margin: 0 0 20px;">
      <p style="margin:0 0 8px; color:#991b1b !important; font-size:14px; line-height:1.6;"><strong>⚠️ Bitte nicht ändern:</strong> Damit Buchungen funktionieren, ändere in Cal.com bitte niemals deinen Benutzernamen oder die URLs der Terminarten („intro" / „full-session").</p>
    </div>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8);">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte einfach auf diese E-Mail – wir helfen dir gerne!</p>
    </div>
  `;

  return {
    subject: '🗓️ Dein Terminkalender ist bereit – Zugangsdaten anbei',
    html: renderLayout({
      title: 'Dein Terminkalender ist bereit',
      contentHtml,
      preheader: 'Logge dich ein und richte deine Verfügbarkeit ein.',
      schema: {
        '@context': 'http://schema.org',
        '@type': 'EmailMessage',
        potentialAction: {
          '@type': 'ViewAction',
          target: params.portalUrl,
          url: params.portalUrl,
          name: 'Zum Therapeuten-Portal',
        },
        description: 'Dein Terminkalender ist bereit - Zugangsdaten anbei',
      },
    }),
  };
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
