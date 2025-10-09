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

export function renderTherapistUploadConfirmation(params: {
  name?: string | null;
}): EmailContent {
  const name = (params.name || '').trim();

  const contentHtml = `
    <h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Profil erhalten – wird geprüft</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;">Dein Profil und deine Dokumente sind bei uns eingegangen und werden geprüft.</p>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 20px 0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <p style="margin:0 0 12px; color:#0f172a; font-size:17px; font-weight:700;">Erhalten:</p>
      <ul style="margin:0 0 0 20px; color:#475569; font-size:15px; line-height:1.65;">
        <li style="margin:8px 0;">✓ Qualifikationsnachweise</li>
        <li style="margin:8px 0;">✓ Profilfoto</li>
        <li style="margin:8px 0;">✓ Therapeutischer Ansatz</li>
      </ul>
    </div>

    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Du hörst binnen 2 Werktagen von uns!</p>
  `;

  return {
    subject: 'Profil erhalten – wird geprüft',
    html: renderLayout({ title: 'Profil erhalten', contentHtml }),
  };
}
