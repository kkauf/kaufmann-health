import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderTherapistCalOnboarding(params: {
  name?: string | null;
  calUsername: string;
  calPassword: string;
  calLoginUrl: string;
  portalUrl?: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const calProfileUrl = `https://cal.kaufmann.health/${params.calUsername}`;
  const portalUrl = params.portalUrl;

  const contentHtml = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Dein Terminkalender ist bereit!</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Großartige Neuigkeiten! Wir haben dein persönliches Terminbuchungssystem eingerichtet. Ab sofort können Klient:innen direkt Termine bei dir buchen.</p>

    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 24px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.1);">
      <h3 style="margin:0 0 16px; color:#064e3b !important; font-size:18px; font-weight:700;">🔐 Deine Zugangsdaten</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600; width:120px;">Login-URL:</td>
          <td style="padding:8px 0;"><a href="${escapeHtml(params.calLoginUrl)}" style="color:#059669 !important; text-decoration:none; font-weight:600;">${escapeHtml(params.calLoginUrl)}</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600;">E-Mail:</td>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px;">(deine KH-E-Mail)</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#064e3b !important; font-size:15px; font-weight:600;">Passwort:</td>
          <td style="padding:8px 0; font-family:monospace; font-size:16px; color:#064e3b !important; background:#ffffff; padding:8px 12px; border-radius:6px; display:inline-block;">${escapeHtml(params.calPassword)}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center; margin: 0 0 24px;">${renderButton(params.calLoginUrl, 'Jetzt einloggen')}</div>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 0 0 24px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <h3 style="margin:0 0 16px; color:#0f172a !important; font-size:18px; font-weight:700;">📋 Wichtig: So richtest du deinen Kalender ein</h3>
      <ol style="margin:0 0 0 20px; color:#475569 !important; font-size:15px; line-height:1.65; padding-left:0;">
        <li style="margin:8px 0;"><strong style="color:#0f172a !important;">Verfügbarkeit anpassen:</strong> Gehe nach dem Login zu "Verfügbarkeit" und stelle deine tatsächlichen freien Zeiten ein.</li>
        <li style="margin:8px 0;"><strong style="color:#0f172a !important;">Kalender verbinden (optional):</strong> Verbinde deinen Google/Outlook-Kalender, damit gebuchte Termine automatisch synchronisiert werden.</li>
        <li style="margin:8px 0;"><strong style="color:#0f172a !important;">Passwort ändern:</strong> Wir empfehlen, das Passwort beim ersten Login zu ändern (Einstellungen → Sicherheit).</li>
      </ol>
    </div>

    <div style="background:#ffffff !important; padding:16px 20px; border:1px solid rgba(226, 232, 240, 0.8); border-radius:12px; margin: 0 0 24px;">
      <div style="font-weight:700; color:#0f172a !important; margin-bottom:8px; font-size:15px;">Deine Buchungsseite</div>
      <div style="color:#475569 !important; font-size:15px; line-height:1.65;">Klient:innen können dich hier buchen:</div>
      <div style="margin-top:10px;"><a href="${escapeHtml(calProfileUrl)}" style="color:#10b981 !important; text-decoration:none; font-weight:600; font-size:15px;">${escapeHtml(calProfileUrl)} →</a></div>
    </div>

    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(245, 158, 11, 0.3); margin: 0 0 20px;">
      <p style="margin:0; color:#92400e !important; font-size:14px; line-height:1.6;"><strong>💡 Tipp:</strong> Wir haben bereits zwei Terminarten für dich eingerichtet: "Kostenloses Kennenlerngespräch" (15 Min) und "Therapiesitzung" (50 Min). Du kannst diese nach dem Login anpassen.</p>
    </div>

    ${portalUrl ? `
    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.3); margin: 0 0 24px; box-shadow: 0 2px 4px 0 rgba(59, 130, 246, 0.1);">
      <h3 style="margin:0 0 12px; color:#1e40af !important; font-size:18px; font-weight:700;">🎬 Video-Anleitung: Kalender einrichten</h3>
      <p style="margin:0 0 16px; color:#1e40af !important; font-size:15px; line-height:1.6;">Schau dir unser kurzes Tutorial an – wir zeigen dir Schritt für Schritt, wie du deinen Kalender einrichtest.</p>
      <div style="text-align:center;">${renderButton(portalUrl, '▶️ Video-Anleitung ansehen')}</div>
    </div>
    ` : ''}

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
          target: params.calLoginUrl,
          url: params.calLoginUrl,
          name: 'Jetzt einloggen',
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
