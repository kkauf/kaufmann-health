import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderEmailConfirmation(params: { confirmUrl: string }): EmailContent {
  const contentHtml = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">E-Mail-Bestätigung</h1>
    <p style="margin:0 0 12px;">Fast geschafft! Bitte bestätige deine E‑Mail‑Adresse, um mit deiner Therapeuten‑Empfehlung fortzufahren.</p>
    <div style="text-align:center; margin: 24px 0;">
      ${renderButton(params.confirmUrl, 'E‑Mail bestätigen')}
    </div>
    <p style="color:#6B7280; font-size:12px;">Der Link ist 24 Stunden gültig. Füge bitte <strong>kontakt@kaufmann-health.de</strong> zu deinen Kontakten hinzu, damit dich deine Therapeuten‑Empfehlung sicher erreicht.</p>
  `;
  const confirmSchema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ConfirmAction',
      name: 'E-Mail bestätigen',
      handler: {
        '@type': 'HttpActionHandler',
        url: params.confirmUrl,
        method: 'HttpRequestMethod.GET',
      },
    },
    description: 'Bestätige deine E‑Mail‑Adresse für Therapeuten‑Empfehlungen',
  } as const;
  return {
    subject: 'Bitte bestätige deine E‑Mail‑Adresse',
    html: renderLayout({ title: 'E-Mail-Bestätigung', contentHtml, preheader: 'Bitte bestätige deine E‑Mail‑Adresse.', schema: confirmSchema }),
  };
}
