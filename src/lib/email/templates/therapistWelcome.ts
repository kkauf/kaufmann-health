import { renderLayout, renderButton } from '../layout';
import { BASE_URL } from '@/lib/constants';
import type { EmailContent } from '../types';

export function renderTherapistWelcome(params: {
  name?: string | null;
  city?: string | null;
  isActiveCity: boolean;
  termsVersion: string;
  uploadUrl?: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const city = (params.city || '').trim();

  const leadStatusMessage = params.isActiveCity
    ? 'Du kannst schon bald Klienten‑Anfragen über unser Netzwerk erhalten.'
    : `Kaufmann Health startet bald in ${city || 'deiner Stadt'}. Wir melden uns, sobald wir live sind.`;

  const termsUrl = `${BASE_URL}/therapist-terms?version=${encodeURIComponent(params.termsVersion)}`;

  const founderImg = `${BASE_URL}/profile-pictures/konstantin-kaufmann.jpg`;

  const contentHtml = `
    <h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Willkommen! Vervollständige dein Profil</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">vielen Dank für deine Anmeldung bei Kaufmann Health!</p>
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 20px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.1);">
      <p style="margin:0; font-size:16px; line-height:1.65; color:#064e3b; font-weight:600;">${escapeHtml(leadStatusMessage)}</p>
    </div>

    ${params.uploadUrl ? `
    <div style="text-align:center; margin: 20px 0 24px;">${renderButton(params.uploadUrl, 'Profil vervollständigen')}</div>
    ` : ''}

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 20px 0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <h3 style="margin:0 0 16px; color:#0f172a; font-size:18px; font-weight:700;">Was wir benötigen</h3>
      <div style="display:block;">
        <div style="margin:12px 0 0;">
          <div style="font-weight:700; color:#0f172a; font-size:15px; margin-bottom:8px;">📋 QUALIFIKATIONSNACHWEISE:</div>
          <ul style="margin:0 0 0 20px; color:#475569; font-size:15px; line-height:1.65;">
            <li style="margin:6px 0;"> Staatlich anerkannte Psychotherapie‑Berechtigung (erforderlich)</li>
            <li style="margin:6px 0;"> Spezialisierungs‑Zertifikat (NARM, Hakomi, Core Energetics, Somatic Experiencing)</li>
            <li style="margin:6px 0;"> Berufshaftpflicht (optional)</li>
          </ul>
        </div>
        <div style="margin:16px 0 0;">
          <div style="font-weight:700; color:#0f172a; font-size:15px; margin-bottom:8px;">👤 DEIN THERAPEUTENPROFIL:</div>
          <ul style="margin:0 0 0 20px; color:#475569; font-size:15px; line-height:1.65;">
            <li style="margin:6px 0;"> Professionelles Foto (für dein Verzeichnisprofil)</li>
            <li style="margin:6px 0;"> Beschreibung deines therapeutischen Ansatzes (2–3 Absätze)</li>
          </ul>
        </div>
      </div>
      <p style="margin:16px 0 0; color:#475569; font-size:15px; line-height:1.65;">Alles in einem Schritt – dauert nur 5–10 Minuten. Wir prüfen innerhalb von 2 Werktagen.</p>
    </div>

    <div style="margin: 16px 0 0; padding:16px 20px; border:1px solid rgba(226, 232, 240, 0.8); border-radius:12px; background:#ffffff; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <div style="font-weight:700; color:#0f172a; margin-bottom:8px; font-size:15px;">Vertragsdokumente</div>
      <div style="color:#475569; font-size:15px; line-height:1.65;">Du hast Version <strong style="color:#0f172a;">${escapeHtml(params.termsVersion)}</strong> akzeptiert.</div>
      <div style="margin-top:10px;"><a href="${termsUrl}" style="color:#10b981; text-decoration:none; font-weight:600; font-size:15px;">Vertrag ansehen →</a></div>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:16px;">
          <img src="${founderImg}" alt="Konstantin Kaufmann" width="64" height="64" style="border-radius:9999px; display:block; border:2px solid #e2e8f0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.1);" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a; font-size:16px; margin-bottom:4px;">Konstantin Kaufmann</div>
          <div style="color:#64748b; font-size:14px; line-height:1.5;">Gründer, Kaufmann Health</div>
          <div style="color:#94a3b8; font-size:13px; margin-top:4px;">Kaufmann Health - Trauma-Heilung beginnt hier</div>
        </td>
      </tr>
    </table>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">
      <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Antworte gerne direkt auf diese Nachricht, falls du Rückfragen hast.</p>
    </div>
  `;

  return {
    subject: 'Willkommen! Vervollständige dein Profil',
    html: renderLayout({
      title: 'Willkommen bei Kaufmann Health',
      contentHtml,
      preheader: 'Willkommen! Vervollständige dein Profil in 5–10 Minuten.',
      schema: params.uploadUrl
        ? {
            '@context': 'http://schema.org',
            '@type': 'EmailMessage',
            potentialAction: {
              '@type': 'ViewAction',
              target: params.uploadUrl,
              url: params.uploadUrl,
              name: 'Profil vervollständigen',
            },
            description: 'Willkommen bei Kaufmann Health - Vervollständige dein Profil',
          }
        : undefined,
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
