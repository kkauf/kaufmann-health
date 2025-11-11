import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderEmailConfirmation(params: { 
  confirmUrl: string;
  isBooking?: boolean; // true when user is confirming email for a booking
}): EmailContent {
  const isBooking = params.isBooking || false;
  
  // Use booking-specific copy when user is in booking flow
  const bodyText = isBooking
    ? 'Fast geschafft! Bitte bestätige deine E‑Mail‑Adresse, um deine Buchung abzuschließen.'
    : 'Fast geschafft! Bitte bestätige deine E‑Mail‑Adresse, um mit deiner Therapeuten‑Empfehlung fortzufahren.';
  
  const footerText = isBooking
    ? 'Der Link ist 24 Stunden gültig. Füge bitte <strong style="color:#475569 !important;">kontakt@kaufmann-health.de</strong> zu deinen Kontakten hinzu, damit dich deine Buchungsbestätigung sicher erreicht.'
    : 'Der Link ist 24 Stunden gültig. Füge bitte <strong style="color:#475569 !important;">kontakt@kaufmann-health.de</strong> zu deinen Kontakten hinzu, damit dich deine Therapeuten‑Empfehlung sicher erreicht.';
  
  const schemaDescription = isBooking
    ? 'Bestätige deine E‑Mail‑Adresse für deine Buchung'
    : 'Bestätige deine E‑Mail‑Adresse für Therapeuten‑Empfehlungen';

  const contentHtml = `
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.08);">
      <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 12px; line-height:1.3; letter-spacing:-0.02em;">E-Mail-Bestätigung</h1>
      <p style="margin:0; font-size:16px; line-height:1.65; color:#166534 !important;">${bodyText}</p>
    </div>
    <div style="text-align:center; margin: 0 0 24px;">
      ${renderButton(params.confirmUrl, 'E‑Mail bestätigen')}
    </div>
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8);">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">${footerText}</p>
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
    description: schemaDescription,
  } as const;
  return {
    subject: 'Bitte bestätige deine E‑Mail‑Adresse',
    html: renderLayout({ title: 'E-Mail-Bestätigung', contentHtml, preheader: 'Bitte bestätige deine E‑Mail‑Adresse.', schema: confirmSchema }),
  };
}
