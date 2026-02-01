import { renderLayout, renderButton } from '../layout';
import { EMAIL_ASSETS_URL } from '@/lib/constants';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Capitalize first letter of schwerpunkt for display */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Human-readable month name in German */
function getMonthName(date: Date): string {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return months[date.getMonth()];
}

/** Get previous month name (for reporting on last month's data) */
function getPreviousMonthName(): string {
  const now = new Date();
  // Go back one month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return getMonthName(prevMonth);
}

/** Get previous month's year (handles Jan -> Dec year change) */
function getPreviousMonthYear(): number {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prevMonth.getFullYear();
}

export type DemandItem = {
  schwerpunkt: string;
  count: number;
  offered: boolean;
};

export type OpportunityGap = {
  schwerpunkt: string;
  gender: string | null;
  count: number;
} | null;

/**
 * Monthly demand digest email for therapists - shows market demand vs their offerings.
 * Helps therapists optimize their profiles by showing what patients are looking for.
 */
export function renderTherapistDemandDigest(params: {
  name?: string | null;
  city: string;
  topDemand: DemandItem[];
  currentSchwerpunkte: string[];
  opportunityGap: OpportunityGap;
  profileUrl: string;
  optOutUrl: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const city = params.city || 'deiner Region';
  // Report on PREVIOUS month's data (cron runs on 1st of month)
  const month = getPreviousMonthName();
  const year = getPreviousMonthYear();
  const currentCount = params.currentSchwerpunkte.length;
  const isAtMax = currentCount >= 5;

  const lines: string[] = [];

  // Greeting
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);

  // Intro - explain what this data represents
  lines.push(`<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">hier ist dein monatlicher Überblick: Diese Themen haben Klient:innen bei ihrer Anmeldung ausgewählt – verglichen mit deinen Spezialisierungen im Profil.</p>`);

  // Show current Spezialisierungen
  if (params.currentSchwerpunkte.length > 0) {
    const schwerpunkteList = params.currentSchwerpunkte.map(s => capitalize(s)).join(', ');
    lines.push(`<p style="margin:0 0 20px; font-size:14px; color:#64748b !important;"><strong>Deine aktuellen Spezialisierungen (${currentCount}/5):</strong> ${escapeHtml(schwerpunkteList)}</p>`);
  }

  // Section: Top Demand
  lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.2); margin:0 0 24px;">');
  lines.push(`<p style="margin:0 0 16px; font-size:15px; font-weight:700; color:#1e40af !important;">📊 Top-Anfragen (${escapeHtml(month)} ${year})</p>`);

  if (params.topDemand.length > 0) {
    lines.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">');
    for (const item of params.topDemand) {
      const checkmark = item.offered
        ? '<span style="color:#059669;">✓</span>'
        : '<span style="color:#dc2626;">✗</span>';
      const statusText = item.offered
        ? '<span style="color:#059669; font-size:12px;">du bietest das an</span>'
        : '<span style="color:#dc2626; font-size:12px;">du bietest das nicht an</span>';

      lines.push(`
        <tr>
          <td style="padding:8px 0; vertical-align:middle;">
            <span style="font-size:15px; color:#1e3a8a !important; font-weight:500;">${checkmark} ${escapeHtml(capitalize(item.schwerpunkt))}</span>
          </td>
          <td style="padding:8px 0; text-align:right; vertical-align:middle;">
            <span style="color:#1e3a8a !important; font-size:14px;">${item.count} Anfragen</span>
            <br/>
            ${statusText}
          </td>
        </tr>
      `);
    }
    lines.push('</table>');
  } else {
    lines.push('<p style="margin:0; font-size:14px; color:#1e3a8a !important;">Noch keine Daten für diesen Monat verfügbar.</p>');
  }

  lines.push('</div>');

  // Section: Opportunity Gap (if exists)
  if (params.opportunityGap && params.opportunityGap.count > 0) {
    const gap = params.opportunityGap;
    const genderText = gap.gender === 'male' ? 'männlichen Therapeut' : gap.gender === 'female' ? 'weibliche Therapeutin' : 'Therapeut:in';

    lines.push('<div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(202, 138, 4, 0.2); margin:0 0 24px;">');
    lines.push('<p style="margin:0 0 8px; font-size:15px; font-weight:700; color:#854d0e !important;">💡 Chance</p>');
    lines.push(`<p style="margin:0; font-size:14px; line-height:1.65; color:#713f12 !important;">${gap.count} Klient:innen suchten „${escapeHtml(capitalize(gap.schwerpunkt))}" + „${escapeHtml(genderText)}" in ${escapeHtml(city)} – ein Bereich, den du aktuell nicht anbietest.</p>`);
    lines.push('</div>');
  }

  // CTA - adapt based on whether they're at max capacity
  if (isAtMax) {
    lines.push('<p style="margin:0 0 16px; font-size:15px; color:#475569 !important;">5 Spezialisierungen – deine Herzensthemen. Falls sich dein Fokus verändert hat:</p>');
  } else {
    lines.push(`<p style="margin:0 0 16px; font-size:15px; color:#475569 !important;">Du hast ${currentCount} von 5 Spezialisierungen gewählt. Falls sich dein Fokus verändert hat:</p>`);
  }
  lines.push(renderButton(params.profileUrl, 'Spezialisierungen anpassen →'));

  // Founder signature
  lines.push(`
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 0;">
      <tr>
        <td style="vertical-align:top; padding-right:16px;">
          <img src="${EMAIL_ASSETS_URL}/profile-pictures/konstantin.JPEG" alt="Konstantin Kaufmann" width="56" height="56" style="border-radius:9999px; display:block; border:2px solid #e2e8f0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.1);" />
        </td>
        <td style="vertical-align:middle;">
          <div style="font-weight:700; color:#0f172a !important; font-size:15px; margin-bottom:2px;">Konstantin Kaufmann</div>
          <div style="color:#64748b !important; font-size:14px; line-height:1.4;">Gründer, Kaufmann Health</div>
        </td>
      </tr>
    </table>
  `);

  // Help footer
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte einfach auf diese E-Mail – ich helfe dir gerne weiter.</p>');
  lines.push('</div>');

  // Opt-out footer
  lines.push(`<p style="margin:24px 0 0; font-size:13px; color:#94a3b8 !important; text-align:center;">Du erhältst diese E-Mail monatlich. <a href="${escapeHtml(params.optOutUrl)}" style="color:#94a3b8 !important; text-decoration:underline;">Abmelden</a></p>`);

  return {
    subject: `📊 Deine Klienten-Nachfrage im ${month}`,
    html: renderLayout({
      title: `Klienten-Nachfrage ${month} ${year}`,
      contentHtml: lines.join(''),
      preheader: `Was Klient:innen in ${city} suchen – und wie es zu deinem Profil passt`,
    }),
  };
}
