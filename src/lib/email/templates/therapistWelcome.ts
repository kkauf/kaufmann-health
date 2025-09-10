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
    ? 'Sie können schon bald Klienten‑Anfragen über unser Netzwerk erhalten.'
    : `Kaufmann Health startet bald in ${city || 'Ihrer Stadt'}. Wir melden uns, sobald wir live sind.`;

  const termsUrl = `${BASE_URL}/therapist-terms?version=${encodeURIComponent(params.termsVersion)}`;

  const founderImg = `${BASE_URL}/profile-pictures/konstantin-kaufmann.jpg`;

  const contentHtml = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Willkommen! Vervollständigen Sie Ihr Profil</h1>
    <p style="margin:0 0 12px;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">vielen Dank für Ihre Anmeldung bei Kaufmann Health!</p>
    <p style="margin:0 0 12px;"><strong>${escapeHtml(leadStatusMessage)}</strong></p>

    ${params.uploadUrl ? `
    <div style="text-align:center; margin: 12px 0 16px;">${renderButton(params.uploadUrl, 'Profil vervollständigen')}</div>
    ` : ''}

    <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 12px 0 16px;">
      <h3 style="margin:0 0 8px; color:#1A365D; font-size:16px;">Was wir benötigen</h3>
      <div style="display:block;">
        <div style="margin:8px 0 0;">
          <div style="font-weight:600; color:#111827;">📋 QUALIFIKATIONSNACHWEISE:</div>
          <ul style="margin:6px 0 0 18px; color:#374151;">
            <li> Staatlich anerkannte Psychotherapie‑Berechtigung (erforderlich)</li>
            <li> Spezialisierungs‑Zertifikat (NARM, Hakomi, Core Energetics, Somatic Experiencing)</li>
            <li> Berufshaftpflicht (optional)</li>
          </ul>
        </div>
        <div style="margin:12px 0 0;">
          <div style="font-weight:600; color:#111827;">👤 IHR THERAPEUTENPROFIL:</div>
          <ul style="margin:6px 0 0 18px; color:#374151;">
            <li> Professionelles Foto (für Ihr Verzeichnisprofil)</li>
            <li> Beschreibung Ihres therapeutischen Ansatzes (2–3 Absätze)</li>
          </ul>
        </div>
      </div>
      <p style="margin:12px 0 0; color:#374151;">Alles in einem Schritt – dauert nur 5–10 Minuten. Wir prüfen innerhalb von 2 Werktagen.</p>
    </div>

    <div style="margin: 8px 0 0; padding:12px; border:1px solid #E5E7EB; border-radius:8px; background:#FFFFFF;">
      <div style="font-weight:600; color:#111827; margin-bottom:4px;">Vertragsdokumente</div>
      <div style="color:#374151; font-size:14px;">Sie haben Version <strong>${escapeHtml(params.termsVersion)}</strong> akzeptiert.</div>
      <div style="margin-top:6px;"><a href="${termsUrl}" style="color:#4A9B8E; text-decoration:none; font-weight:600;">Vertrag ansehen</a></div>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:12px;">
          <img src="${founderImg}" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:1px solid #E5E7EB;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:600; color:#111827;">Konstantin Kaufmann</div>
          <div style="color:#6B7280; font-size:14px;">Gründer, Kaufmann Health</div>
          <div style="color:#6B7280; font-size:12px; margin-top:2px;">Kaufmann Health - Trauma-Heilung beginnt hier</div>
        </td>
      </tr>
    </table>

    <p style="color:#6B7280; font-size:12px; margin-top:16px;">Antworten Sie gerne direkt auf diese Nachricht, falls Sie Rückfragen haben.</p>
  `;

  return {
    subject: 'Willkommen! Vervollständigen Sie Ihr Profil',
    html: renderLayout({ title: 'Willkommen bei Kaufmann Health', contentHtml }),
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
