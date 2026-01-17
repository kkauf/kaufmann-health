/**
 * Email template for therapist low availability reminder
 * Sent weekly to therapists with <3 bookable slots in next 7 days
 */

import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

interface AvailabilityReminderProps {
  name: string;
  introSlots: number;
  fullSessionSlots: number;
  calUrl: string;
}

export function renderTherapistAvailabilityReminder({
  name,
  introSlots,
  fullSessionSlots,
  calUrl,
}: AvailabilityReminderProps): { subject: string; html: string } {
  const firstName = name.split(' ')[0] || name;
  
  const hasLowIntro = introSlots < 3;
  const hasLowFullSession = fullSessionSlots < 3;
  
  // Build the availability summary
  let availabilitySummary = '';
  if (hasLowIntro && hasLowFullSession) {
    availabilitySummary = `
      <li><strong>Kennenlerngespräche:</strong> ${introSlots} ${introSlots === 1 ? 'Termin' : 'Termine'}</li>
      <li><strong>Therapiesitzungen:</strong> ${fullSessionSlots} ${fullSessionSlots === 1 ? 'Termin' : 'Termine'}</li>
    `;
  } else if (hasLowIntro) {
    availabilitySummary = `
      <li><strong>Kennenlerngespräche:</strong> ${introSlots} ${introSlots === 1 ? 'Termin' : 'Termine'}</li>
    `;
  } else if (hasLowFullSession) {
    availabilitySummary = `
      <li><strong>Therapiesitzungen:</strong> ${fullSessionSlots} ${fullSessionSlots === 1 ? 'Termin' : 'Termine'}</li>
    `;
  }

  const body = `
    <p>Hallo ${firstName},</p>
    
    <p>wir haben gesehen, dass du aktuell nur wenige freie Termine in den nächsten 7 Tagen hast:</p>
    
    <ul style="margin: 16px 0; padding-left: 20px;">
      ${availabilitySummary}
    </ul>
    
    <p style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 20px 0;">
      <strong>Falls gewollt → alles gut, nichts zu tun ✓</strong>
    </p>
    
    <p>Falls du mehr Termine freigeben möchtest, kannst du deine Verfügbarkeit direkt in deinem Kalender anpassen:</p>
    
    <p style="margin: 24px 0;">
      <a href="${calUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Kalender öffnen
      </a>
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      Diese E-Mail wird einmal wöchentlich verschickt, wenn deine Verfügbarkeit gering ist.
    </p>
  `;

  return {
    subject: 'Stimmt deine Verfügbarkeit so?',
    html: emailWrapper({ body, preheader: `Du hast nur wenige freie Termine diese Woche` }),
  };
}
