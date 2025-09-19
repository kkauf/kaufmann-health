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
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Profil erhalten – wird geprüft</h1>
    <p style="margin:0 0 12px;">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">Dein Profil und deine Dokumente sind bei uns eingegangen und werden geprüft.</p>

    <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 12px 0;">
      <p style="margin:0 0 4px;">Erhalten:</p>
      <ul style="margin:8px 0 0 18px; color:#374151;">
        <li>✓ Qualifikationsnachweise</li>
        <li>✓ Profilfoto</li>
        <li>✓ Therapeutischer Ansatz</li>
      </ul>
    </div>

    <p style="margin:0 0 12px;">Du hörst binnen 2 Werktagen von uns!</p>
  `;

  return {
    subject: 'Profil erhalten – wird geprüft',
    html: renderLayout({ title: 'Profil erhalten', contentHtml }),
  };
}
