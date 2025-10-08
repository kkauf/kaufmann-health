import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderEmailConfirmation(params: { confirmUrl: string }): EmailContent {
  const contentHtml = `
    <h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">E-Mail-Bestätigung</h1>
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;">Fast geschafft! Bitte bestätige deine E‑Mail‑Adresse, um mit deiner Therapeuten‑Empfehlung fortzufahren.</p>
    <div style="text-align:center; margin: 32px 0;">
      ${renderButton(params.confirmUrl, 'E‑Mail bestätigen')}
    </div>
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">
      <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Der Link ist 24 Stunden gültig. Füge bitte <strong style="color:#475569;">kontakt@kaufmann-health.de</strong> zu deinen Kontakten hinzu, damit dich deine Therapeuten‑Empfehlung sicher erreicht.</p>
    </div>
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
