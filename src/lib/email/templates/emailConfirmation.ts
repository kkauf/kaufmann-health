import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderEmailConfirmation(params: { confirmUrl: string }): EmailContent {
  const contentHtml = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">E-Mail-Bestätigung</h1>
    <p style="margin:0 0 12px;">Fast geschafft! Bitte bestätigen Sie Ihre E‑Mail-Adresse, um mit Ihrer Therapeuten‑Empfehlung fortzufahren.</p>
    <div style="text-align:center; margin: 24px 0;">
      ${renderButton(params.confirmUrl, 'E‑Mail bestätigen')}
    </div>
    <p style="color:#6B7280; font-size:12px;">Der Link ist 24 Stunden gültig. Fügen Sie bitte <strong>kontakt@kaufmann-health.de</strong> zu Ihren Kontakten hinzu.</p>
  `;
  return {
    subject: 'Bestätigen Sie Ihre E‑Mail-Adresse',
    html: renderLayout({ title: 'E-Mail-Bestätigung', contentHtml }),
  };
}
