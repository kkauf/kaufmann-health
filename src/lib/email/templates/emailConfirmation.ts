import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

/**
 * Render email verification with 6-digit code (Apple Mail auto-fill compatible)
 * Uses one-time-code format for iOS/macOS autofill support
 */
export function renderEmailVerificationCode(params: {
  code: string;
  isBooking?: boolean;
}): EmailContent {
  const { code, isBooking = false } = params;
  
  const bodyText = isBooking
    ? 'Fast geschafft! Gib diesen Code ein, um deine Buchung abzuschließen.'
    : 'Fast geschafft! Gib diesen Code ein, um fortzufahren.';
  
  const subjectPrefix = isBooking ? 'Buchungsbestätigung' : 'Bestätigungscode';
  
  // Apple Mail auto-fill: code must be in plain text, ideally with specific format
  // iOS looks for patterns like "Your code is: 123456" or just the number
  const contentHtml = `
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.08);">
      <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 12px; line-height:1.3; letter-spacing:-0.02em;">Dein Bestätigungscode</h1>
      <p style="margin:0; font-size:16px; line-height:1.65; color:#166534 !important;">${bodyText}</p>
    </div>
    <div style="text-align:center; margin: 0 0 24px;">
      <div style="display:inline-block; background:#f8fafc; border:2px dashed #cbd5e1; border-radius:12px; padding:20px 40px;">
        <span style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size:36px; font-weight:700; letter-spacing:8px; color:#0f172a;">${code}</span>
      </div>
    </div>
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8);">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Der Code ist <strong style="color:#475569 !important;">10 Minuten</strong> gültig. Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>
    </div>
  `;
  
  // Schema.org markup for email clients
  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    description: 'Dein Bestätigungscode für Kaufmann Health',
  } as const;
  
  return {
    // Include code in subject for Apple Mail auto-fill (pattern: "123456 is your code")
    subject: `${code} – ${subjectPrefix} | Kaufmann Health`,
    html: renderLayout({ 
      title: 'Bestätigungscode', 
      contentHtml, 
      preheader: `Dein Code: ${code}`,
      schema 
    }),
  };
}

export function renderEmailConfirmation(params: { 
  confirmUrl: string;
  isBooking?: boolean; // true when user is confirming email for a booking
  isReminder?: boolean; // true for 24h/72h reminder emails (value-focused copy)
}): EmailContent {
  const isBooking = params.isBooking || false;
  const isReminder = params.isReminder || false;
  
  // Reminder emails: shift framing from "confirm your email" to "your matches are waiting"
  if (isReminder && !isBooking) {
    const contentHtml = `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(34, 197, 94, 0.08);">
        <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 12px; line-height:1.3; letter-spacing:-0.02em;">Deine passenden Therapeut:innen sind bereit</h1>
        <p style="margin:0; font-size:16px; line-height:1.65; color:#166534 !important;">Wir haben Therapeut:innen gefunden, die zu deinen Wünschen passen. Mit einem Klick siehst du deine persönliche Auswahl.</p>
      </div>
      <div style="text-align:center; margin: 0 0 24px;">
        ${renderButton(params.confirmUrl, 'Jetzt ansehen')}
      </div>
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8);">
        <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Der Link ist 24 Stunden gültig. Füge bitte <strong style="color:#475569 !important;">kontakt@kaufmann-health.de</strong> zu deinen Kontakten hinzu, damit dich deine Therapeuten‑Empfehlung sicher erreicht.</p>
      </div>
    `;
    const reminderSchema = {
      '@context': 'http://schema.org',
      '@type': 'EmailMessage',
      potentialAction: {
        '@type': 'ViewAction',
        name: 'Jetzt ansehen',
        url: params.confirmUrl,
      },
      description: 'Deine Therapeutenauswahl ansehen',
    } as const;
    return {
      subject: 'Deine Therapeutenauswahl wartet auf dich 🌿',
      html: renderLayout({ title: 'Deine Therapeutenauswahl', contentHtml, preheader: 'Wir haben passende Therapeut:innen für dich gefunden.', schema: reminderSchema }),
    };
  }
  
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
