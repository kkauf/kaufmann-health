import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type SelectionNudgeEmailParams = {
  patientName?: string | null;
  matchesUrl: string;
  // Enhanced therapist data for direct booking CTA
  therapist?: {
    first_name: string;
    last_name: string;
    photo_url?: string | null;
    city?: string | null;
    modalities?: string[] | null;
    qualification?: string | null;
    who_comes_to_me?: string | null;
  };
  nextIntroSlot?: { date_iso: string; time_label: string; time_utc: string } | null;
  calBookingUrl?: string | null;
};

/**
 * Format next intro slot for email display.
 */
function formatNextIntroSlot(slot: { date_iso: string; time_label: string; time_utc?: string } | null | undefined): string | null {
  if (!slot?.date_iso || !slot?.time_label) return null;
  try {
    const slotTime = slot.time_utc 
      ? new Date(slot.time_utc).getTime()
      : new Date(slot.date_iso + 'T' + slot.time_label + ':00').getTime();
    if (slotTime < Date.now() + 30 * 60 * 1000) return null;
    const date = new Date(slot.date_iso + 'T12:00:00');
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
    const day = date.getDate();
    const month = date.toLocaleDateString('de-DE', { month: 'short' });
    return `${weekday} ${day}. ${month} um ${slot.time_label}`;
  } catch {
    return null;
  }
}

export function renderSelectionNudgeEmail(params: SelectionNudgeEmailParams): EmailContent {
  const { patientName, matchesUrl, therapist, nextIntroSlot, calBookingUrl } = params;
  const name = (patientName || '').trim();
  const therapistName = therapist?.first_name || '';

  const profileUrl = `${matchesUrl}?direct=1&utm_source=email&utm_medium=transactional&utm_campaign=selection_nudge_d5`;
  const helpEmail = 'kontakt@kaufmann-health.de';

  // Check if we have Cal.com booking capability
  const hasCalBooking = Boolean(calBookingUrl && nextIntroSlot);
  const formattedSlot = formatNextIntroSlot(nextIntroSlot);

  // Enhanced mode: direct booking with therapist info
  // Legacy mode: general nudge to view matches
  let contentHtml: string;

  if (hasCalBooking && therapistName && formattedSlot) {
    // ENHANCED: Conversion-focused with direct booking
    const primaryCta = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:20px;">
        <tr>
          <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; border-radius:12px; padding:0; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.35);">
            <a href="${escapeHtml(calBookingUrl || profileUrl)}" target="_blank" style="display:inline-block; width:100%; padding:18px 24px; box-sizing:border-box; color:#ffffff !important; text-decoration:none; font-weight:700; text-align:center; font-size:18px; line-height:1.3; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Jetzt kostenlos kennenlernen</a>
          </td>
        </tr>
      </table>
    `;

    contentHtml = `
      ${name ? `<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      
      <h1 style="color:#0f172a !important; font-size:24px; font-weight:700; margin:0 0 8px; text-align:center; line-height:1.3;">Ein Schritt trennt dich vom Kennenlernen</h1>
      <p style="margin:0 0 24px; font-size:15px; color:#64748b !important; text-align:center;">Kostenlos • 15 Minuten • Unverbindlich</p>

      <!-- Therapist Card -->
      <div style="border:2px solid rgba(16, 185, 129, 0.4); background:#ffffff !important; padding:24px; border-radius:16px; box-shadow: 0 4px 16px 0 rgba(16, 185, 129, 0.12); text-align:center;">
        <div style="font-weight:700;font-size:20px;color:#0f172a !important;margin-bottom:4px;">${escapeHtml(therapistName)} ${escapeHtml(therapist?.last_name || '')}</div>
        ${therapist?.qualification ? `<div style="color:#166534 !important;font-size:13px;margin-bottom:8px;">✓ ${escapeHtml(therapist.qualification)}</div>` : '<div style="color:#166534 !important;font-size:13px;margin-bottom:8px;">✓ Verifiziert</div>'}
        ${therapist?.city ? `<div style="color:#64748b !important;font-size:14px;margin-bottom:12px;">📍 ${escapeHtml(therapist.city)}</div>` : ''}
        
        <!-- Slot Hero -->
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:16px 20px; border-radius:10px; margin:16px 0 0;">
          <div style="font-size:13px;color:#065f46 !important;font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">Nächster freier Termin</div>
          <div style="font-size:20px;color:#047857 !important;font-weight:700;">${escapeHtml(formattedSlot)}</div>
          <div style="font-size:13px;color:#059669 !important;margin-top:4px;">15 Min • Video-Call</div>
        </div>

        ${primaryCta}
        <div style="text-align:center;margin-top:12px;"><a href="${escapeHtml(profileUrl)}" target="_blank" style="color:#64748b !important;text-decoration:underline;font-size:13px;">Profil ansehen</a></div>
      </div>

      <!-- Objection handling -->
      <div style="margin-top:24px; padding:16px 20px; background:#fafafa !important; border-radius:10px;">
        <div style="font-size:14px; line-height:1.7; color:#475569 !important;">
          <div style="margin-bottom:6px;">✓ Die „Chemie" zeigt sich im Gespräch, nicht im Profil</div>
          <div style="margin-bottom:6px;">✓ Keine Kosten, keine Verpflichtung</div>
          <div>✓ Jederzeit absagbar</div>
        </div>
      </div>

      <!-- Help Section -->
      <div style="margin-top:20px; text-align:center;">
        <p style="margin:0;font-size:14px;color:#64748b !important;">
          Fragen? <a href="mailto:${escapeHtml(helpEmail)}" style="color:#16a34a !important;text-decoration:underline;">Schreib uns</a>
        </p>
      </div>
    `;
  } else {
    // LEGACY: Original reassurance-focused email
    contentHtml = `
      <div style="margin:0 0 24px;">
        ${name ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
        <p style="margin:0; font-size:16px; line-height:1.65; color:#475569 !important;">deine Therapeuten-Vorschläge warten auf dich. Ein kurzes Kennenlerngespräch zeigt dir schnell, ob es passt.</p>
      </div>

      <!-- Reassurance Box -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(100, 116, 139, 0.06);">
        <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#334155 !important; font-weight:600;">Warum jetzt ausprobieren?</p>
        
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:24px;">
              <span style="color:#16a34a !important;font-size:16px;font-weight:700;">✓</span>
            </td>
            <td style="padding:8px 0 8px 8px;vertical-align:top;">
              <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Das <strong style="color:#0f172a !important;">kostenlose Kennenlerngespräch</strong> ist unverbindlich — du entscheidest danach</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:24px;">
              <span style="color:#16a34a !important;font-size:16px;font-weight:700;">✓</span>
            </td>
            <td style="padding:8px 0 8px 8px;vertical-align:top;">
              <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Die <strong style="color:#0f172a !important;">„Chemie"</strong> zeigt sich meist im ersten Gespräch, nicht im Profil</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:24px;">
              <span style="color:#16a34a !important;font-size:16px;font-weight:700;">✓</span>
            </td>
            <td style="padding:8px 0 8px 8px;vertical-align:top;">
              <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Du kannst <strong style="color:#0f172a !important;">jederzeit wechseln</strong></span>
            </td>
          </tr>
        </table>
      </div>

      <!-- CTA Button -->
      <div style="margin:0 0 24px;">
        ${renderButton(profileUrl, 'Kostenlosen Termin buchen')}
      </div>

      <!-- Help Section -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); padding:16px 20px; box-shadow: 0 2px 4px 0 rgba(34, 197, 94, 0.06);">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#166534 !important;">
          <strong style="color:#14532d !important;">Brauchst du Hilfe bei der Entscheidung?</strong><br />
          <a href="mailto:${escapeHtml(helpEmail)}?subject=${encodeURIComponent('Hilfe bei der Therapeutenwahl')}" style="color:#16a34a !important;text-decoration:underline;">Schreib uns</a> — wir helfen dir gern.
        </p>
      </div>
    `;
  }

  // Dynamic subject - emphasize free + low commitment, remove doubt framing
  const subject = hasCalBooking && therapistName
    ? `Kostenlos: 15 Min mit ${therapistName} – unverbindlich kennenlernen`
    : 'Dein kostenloses Kennenlerngespräch wartet – 15 Min, unverbindlich';
  
  const preheader = hasCalBooking && therapistName
    ? `Kein Risiko, keine Kosten – ${therapistName} hat noch Termine frei`
    : 'Kein Risiko, keine Kosten – einfach mal reinschnuppern';

  const actionUrl = calBookingUrl || profileUrl;
  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ViewAction',
      name: hasCalBooking ? 'Intro-Termin buchen' : 'Meine Vorschläge ansehen',
      url: actionUrl,
    },
    description: preheader,
  };

  return {
    subject,
    html: renderLayout({ title: 'Kostenloses Kennenlerngespräch', contentHtml, preheader, schema }),
  };
}
