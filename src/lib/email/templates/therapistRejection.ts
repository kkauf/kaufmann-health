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
 * Rückfrage email for therapists who need to update their profile.
 * This is a friendly request for more info, not a rejection.
 */
export function renderTherapistRejection(params: {
  name?: string | null;
  uploadUrl?: string;
  missingDocuments?: boolean;
  photoIssue?: string | null;
  approachIssue?: string | null;
  adminNotes?: string | null;
}): EmailContent {
  const name = (params.name || '').trim();
  const notes = (params.adminNotes || '').trim();
  const photo = (params.photoIssue || '').trim();
  const approach = (params.approachIssue || '').trim();
  const founderImg = `${EMAIL_ASSETS_URL}/profile-pictures/konstantin.JPEG`;

  const lines: string[] = [];
  
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Fast geschafft – nur noch eine Kleinigkeit</h1>');
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">vielen Dank für deine Bewerbung bei Kaufmann Health! Wir freuen uns über dein Interesse.</p>');
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Damit wir dein Profil freischalten können, benötigen wir noch ein paar Ergänzungen:</p>');

  // Build checklist items
  const items: string[] = [];
  if (params.missingDocuments) {
    items.push('<li style="margin:8px 0;"><strong style="font-weight:600;">Qualifikationsnachweise</strong> – Bitte lade deine Zertifikate hoch.</li>');
  }
  if (photo) {
    items.push(`<li style="margin:8px 0;"><strong style="font-weight:600;">Profilfoto</strong> – ${escapeHtml(photo)}</li>`);
  }
  if (approach) {
    items.push(`<li style="margin:8px 0;"><strong style="font-weight:600;">Profiltext</strong> – ${escapeHtml(approach)}</li>`);
  }

  if (items.length > 0) {
    lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin: 16px 0 20px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.05);">');
    lines.push('<ul style="margin:0 0 0 20px; padding:0; color:#065f46 !important; font-size:15px; line-height:1.65;">');
    lines.push(items.join(''));
    lines.push('</ul>');
    lines.push('</div>');
  }

  // Admin notes as personal message
  if (notes) {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 16px 0 20px;">');
    lines.push(`<p style="margin:0; color:#475569 !important; font-size:15px; line-height:1.65;">${escapeHtml(notes).replace(/\n/g, '<br>')}</p>`);
    lines.push('</div>');
  }

  // CTA Button
  if (params.uploadUrl) {
    lines.push(`
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.2);">
            <a href="${params.uploadUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">
              Profil vervollständigen →
            </a>
          </td>
        </tr>
      </table>
    `);
  }

  lines.push('<p style="margin:0 0 24px; font-size:16px; line-height:1.65; color:#475569 !important;">Sobald alles vollständig ist, schalten wir dein Profil gerne frei. Wir melden uns!</p>');

  // Founder signature
  lines.push(`
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:16px;">
          <img src="${founderImg}" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:2px solid #e2e8f0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.1);" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a !important; font-size:15px; margin-bottom:2px;">Konstantin Kaufmann</div>
          <div style="color:#64748b !important; font-size:14px; line-height:1.4;">Gründer, Kaufmann Health</div>
        </td>
      </tr>
    </table>
  `);

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte einfach auf diese E‑Mail – ich helfe dir gerne weiter.</p>');
  lines.push('</div>');

  return {
    subject: 'Fast geschafft – nur noch eine Kleinigkeit',
    html: renderLayout({
      title: 'Fast geschafft – nur noch eine Kleinigkeit',
      contentHtml: lines.join(''),
      preheader: 'Damit wir dein Profil freischalten können, benötigen wir noch ein paar Ergänzungen.',
    }),
  };
}
