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
 * Soft decline email for therapists who are not accepted into the network.
 * Unlike rejection (transient, needs fixes), decline is terminal but leaves the door open.
 */
export function renderTherapistDecline(params: {
  name?: string | null;
  reason: string; // Required - admin must provide a reason
}): EmailContent {
  const name = (params.name || '').trim();
  const reason = (params.reason || '').trim();

  const founderImg = `${EMAIL_ASSETS_URL}/profile-pictures/konstantin.JPEG`;

  const contentHtml = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Deine Bewerbung bei Kaufmann Health</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">vielen Dank für dein Interesse an Kaufmann Health und dass du dir die Zeit genommen hast, dich bei uns zu bewerben.</p>
    
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 16px 0 20px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <p style="margin:0; font-size:16px; line-height:1.65; color:#475569 !important;">${escapeHtml(reason).replace(/\n/g, '<br>')}</p>
    </div>

    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Sollte sich an deiner Situation etwas ändern, melde dich gerne erneut bei uns. Wir freuen uns, von dir zu hören.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:16px;">
          <img src="${founderImg}" alt="Konstantin Kaufmann" width="64" height="64" style="border-radius:9999px; display:block; border:2px solid #e2e8f0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.1);" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a !important; font-size:16px; margin-bottom:4px;">Konstantin Kaufmann</div>
          <div style="color:#64748b !important; font-size:14px; line-height:1.5;">Gründer, Kaufmann Health</div>
        </td>
      </tr>
    </table>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte gerne auf diese E‑Mail.</p>
    </div>
  `;

  return {
    subject: 'Deine Bewerbung bei Kaufmann Health',
    html: renderLayout({
      title: 'Deine Bewerbung bei Kaufmann Health',
      contentHtml,
      preheader: 'Vielen Dank für dein Interesse an Kaufmann Health.',
    }),
  };
}
