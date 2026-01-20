/**
 * Cancellation Recovery Email Template
 * 
 * Sent ~2h after a booking is cancelled to help the patient find another therapist.
 * Shows their other matches (excluding the cancelled therapist) and offers support.
 * 
 * WHY: Recover leads after a booking cancellation by showing alternative therapists
 * and signaling we're here to help, not being intrusive.
 */

import { renderLayout, renderButton } from '@/lib/email/layout';
import type { EmailContent } from '@/lib/email/types';
import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface CancellationRecoveryParams {
  patientName?: string | null;
  cancelledTherapistName?: string | null;
  matchesUrl: string;
  otherTherapistCount?: number;
}

export function renderCancellationRecovery(params: CancellationRecoveryParams): EmailContent {
  const {
    patientName,
    cancelledTherapistName,
    matchesUrl,
    otherTherapistCount = 0,
  } = params;

  const name = (patientName || '').trim();
  const therapistName = (cancelledTherapistName || '').trim();
  const greeting = name ? `Hallo ${escapeHtml(name)}` : 'Hallo';
  
  const fullMatchesUrl = matchesUrl.startsWith('http') 
    ? matchesUrl 
    : `${BASE_URL}${matchesUrl.startsWith('/') ? '' : '/'}${matchesUrl}`;

  // Build therapist reference text
  const therapistRef = therapistName 
    ? `mit ${escapeHtml(therapistName)}` 
    : '';

  // Build other matches text
  const otherMatchesText = otherTherapistCount > 0
    ? `Du hast noch ${otherTherapistCount === 1 ? 'eine weitere Empfehlung' : `${otherTherapistCount} weitere Empfehlungen`} von uns.`
    : 'Du hast noch weitere Empfehlungen von uns.';

  const contentHtml = `
    <p style="margin:0 0 16px; color:#374151; font-size:16px; line-height:1.6;">
      ${greeting},
    </p>
    
    <p style="margin:0 0 16px; color:#374151; font-size:16px; line-height:1.6;">
      wir haben gesehen, dass dein Termin ${therapistRef} nicht stattfinden konnte.
      Das ist völlig in Ordnung – manchmal passt es einfach nicht, und das ist ein normaler Teil der Therapeut:innensuche.
    </p>

    <p style="margin:0 0 16px; color:#374151; font-size:16px; line-height:1.6;">
      ${otherMatchesText}
      Jede:r wurde sorgfältig für dich ausgewählt, basierend auf deinen Wünschen und Bedürfnissen.
    </p>

    <div style="background:#f0fdf4; border-radius:8px; padding:16px; margin:0 0 24px;">
      <p style="margin:0; color:#166534; font-size:15px; line-height:1.5;">
        <strong>💡 Tipp:</strong> Falls du unsicher bist, nutze gerne das kostenlose Kennenlerngespräch.
        So kannst du unverbindlich herausfinden, ob die Chemie stimmt.
      </p>
    </div>

    <div style="text-align:center; margin:0 0 24px;">
      ${renderButton(fullMatchesUrl, 'Meine anderen Empfehlungen ansehen')}
    </div>

    <p style="margin:0 0 16px; color:#374151; font-size:16px; line-height:1.6;">
      Falls du Fragen hast oder Unterstützung bei der Auswahl brauchst, antworte einfach auf diese E-Mail.
      Wir sind persönlich für dich da.
    </p>

    <p style="margin:0; color:#374151; font-size:16px; line-height:1.6;">
      Liebe Grüße,<br>
      Dein Kaufmann Health Team
    </p>
  `;

  const subject = therapistName
    ? `War ${therapistName} nicht der/die Richtige? Hier sind deine anderen Empfehlungen`
    : 'Dein Termin wurde abgesagt – hier sind deine anderen Empfehlungen';

  const preheader = otherTherapistCount > 0
    ? `Du hast noch ${otherTherapistCount} weitere sorgfältig ausgewählte Empfehlungen`
    : 'Wir helfen dir, den passenden Therapeuten zu finden';

  return {
    subject,
    html: renderLayout({
      title: subject,
      contentHtml,
      preheader,
    }),
  };
}
