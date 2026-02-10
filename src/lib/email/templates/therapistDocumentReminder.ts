import { renderLayout } from '../layout';
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

export type ReminderStage = 'day3' | 'day10' | 'day21';

const STAGE_CONFIG: Record<ReminderStage, { subject: string; headline: string; urgency: string }> = {
  day3: {
    subject: 'Erinnerung: Deine Unterlagen fehlen noch',
    headline: 'Deine Anmeldung ist fast abgeschlossen',
    urgency: 'Nur noch ein Schritt, dann können wir dein Profil prüfen.',
  },
  day10: {
    subject: 'Noch keine Unterlagen erhalten – können wir helfen?',
    headline: 'Wir warten noch auf deine Unterlagen',
    urgency: 'Damit wir dein Profil freischalten können, benötigen wir deine Qualifikationsnachweise.',
  },
  day21: {
    subject: 'Dein Profil wartet noch auf dich',
    headline: 'Dein Profil ist noch unvollständig',
    urgency: 'Wir möchten dich gerne ins Netzwerk aufnehmen – bitte vervollständige deine Anmeldung.',
  },
};

/**
 * Reminder email for therapists who signed up but haven't uploaded documents.
 * Sent at day 3, 10, and 21 after signup.
 */
export function renderTherapistDocumentReminder(params: {
  name?: string | null;
  uploadUrl: string;
  stage: ReminderStage;
}): EmailContent {
  const name = (params.name || '').trim();
  const config = STAGE_CONFIG[params.stage];

  const lines: string[] = [];
  
  // Headline
  lines.push(`<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">${escapeHtml(config.headline)}</h1>`);
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push(`<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">${escapeHtml(config.urgency)}</p>`);

  // Clear action box
  lines.push('<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; background-image: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(202, 138, 4, 0.3); margin: 0 0 24px; box-shadow: 0 2px 4px 0 rgba(202, 138, 4, 0.1);">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#92400e !important;">📋 Was du jetzt tun musst:</p>');
  lines.push('<ol style="margin:0; padding-left:20px; color:#78350f !important; font-size:15px; line-height:1.8;">');
  lines.push('<li><strong style="font-weight:600;">Klicke auf den Button unten</strong></li>');
  lines.push('<li><strong style="font-weight:600;">Lade deine Qualifikationsnachweise hoch</strong> (Zulassung oder Spezialisierungs‑Zertifikat)</li>');
  lines.push('<li><strong style="font-weight:600;">Ergänze dein Profilfoto</strong></li>');
  lines.push('</ol>');
  lines.push('<p style="margin:12px 0 0; font-size:14px; line-height:1.6; color:#92400e !important;">⏱️ Dauert nur 5–10 Minuten. Danach prüfen wir alles innerhalb von 2 Werktagen.</p>');
  lines.push('</div>');

  // CTA Button
  lines.push(`
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(16, 185, 129, 0.2);">
          <a href="${params.uploadUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">
            Jetzt Profil vervollständigen →
          </a>
        </td>
      </tr>
    </table>
  `);

  // What we need - simplified checklist
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 0 0 24px;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:600; color:#0f172a !important;">Diese Unterlagen benötigen wir:</p>');
  lines.push('<ul style="margin:0; padding-left:20px; color:#475569 !important; font-size:15px; line-height:1.8;">');
  lines.push('<li><strong style="font-weight:600;">Qualifikationsnachweis</strong> (Zulassung oder Spezialisierungs‑Zertifikat)</li>');
  lines.push('<li><strong style="font-weight:600;">Spezialisierungs-Zertifikat</strong> – NARM, Hakomi, SE oder Core Energetics</li>');
  lines.push('<li><strong style="font-weight:600;">Profilfoto</strong> – Professionell, für dein Verzeichnisprofil</li>');
  lines.push('</ul>');
  lines.push('</div>');

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
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Hast du Fragen oder brauchst Hilfe? Antworte einfach auf diese E‑Mail – ich helfe dir gerne weiter.</p>');
  lines.push('</div>');

  return {
    subject: config.subject,
    html: renderLayout({
      title: config.headline,
      contentHtml: lines.join(''),
      preheader: config.urgency,
    }),
  };
}
