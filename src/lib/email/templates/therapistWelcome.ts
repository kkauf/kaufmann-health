import { renderLayout, renderButton } from '../layout';
import { BASE_URL } from '@/lib/constants';
import type { EmailContent } from '../types';

export function renderTherapistWelcome(params: {
  name?: string | null;
  city?: string | null;
  isActiveCity: boolean;
  termsVersion: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const city = (params.city || '').trim();

  const leadStatusMessage = params.isActiveCity
    ? 'Sie können ab sofort Klienten-Anfragen über unser Verzeichnis erhalten.'
    : `Kaufmann Health startet bald in ${city || 'Ihrer Stadt'}. Wir melden uns, sobald wir live sind.`;

  const termsUrl = `${BASE_URL}/therapist-terms?version=${encodeURIComponent(params.termsVersion)}`;

  const founderImg = `${BASE_URL}/profile-pictures/konstantin-kaufmann.jpg`;

  const contentHtml = `
    <h1 style="color:#111827; font-size:22px; margin:0 0 12px;">Willkommen bei Kaufmann Health!</h1>
    <p style="margin:0 0 12px;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">vielen Dank für Ihre Registrierung in unserem Therapeuten-Verzeichnis. Ihr Vertrag ist ab sofort aktiv.</p>
    <p style="margin:0 0 16px;"><strong>${escapeHtml(leadStatusMessage)}</strong></p>

    <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 20px 0;">
      <h3 style="margin:0 0 8px; color:#111827; font-size:16px;">Nächste Schritte</h3>
      <p style="margin:0 0 8px;">Haben Sie Fragen zum Ablauf oder möchten Sie mehr über unser Verzeichnis erfahren?</p>
      <p style="margin:0 0 16px;">Buchen Sie gerne ein kurzes Kennenlernen mit uns:</p>
      <div style="text-align:center;">${renderButton('https://cal.com/kkauf/15min', 'Kennenlern-Call buchen')}</div>
    </div>

    <div style="margin: 8px 0 0; padding:12px; border:1px solid #E5E7EB; border-radius:8px; background:#FFFFFF;">
      <div style="font-weight:600; color:#111827; margin-bottom:4px;">Vertragsdokumente</div>
      <div style="color:#374151; font-size:14px;">Sie haben Version <strong>${escapeHtml(params.termsVersion)}</strong> akzeptiert.</div>
      <div style="margin-top:6px;"><a href="${termsUrl}" style="color:#111827; text-decoration:none; font-weight:600;">Vertrag ansehen</a></div>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 12px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:12px;">
          <img src="${founderImg}" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:1px solid #E5E7EB;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:600; color:#111827;">Konstantin Kaufmann</div>
          <div style="color:#6B7280; font-size:14px;">Founder, Kaufmann Health</div>
        </td>
      </tr>
    </table>

    <p style="color:#6B7280; font-size:12px; margin-top:16px;">Antworten Sie gerne direkt auf diese Nachricht, falls Sie Rückfragen haben.</p>
  `;

  return {
    subject: 'Willkommen bei Kaufmann Health',
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
