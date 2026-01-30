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

/**
 * Product update email for therapists - announcing new client booking feature.
 * Used for Resend broadcast campaigns.
 */
export function renderTherapistProductUpdate(params: {
  name?: string | null;
  portalUrl?: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const portalUrl = params.portalUrl || 'https://www.kaufmann-health.de/portal';

  const lines: string[] = [];

  // Greeting
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);

  // Intro
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">wir haben ein neues Feature für dich: Ab sofort kannst du <strong>Folgetermine direkt für deine Klient:innen einbuchen</strong> – ohne dass sie selbst buchen müssen.</p>');

  // Section: Booking Flow
  lines.push('<div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); margin:0 0 24px;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:700; color:#166534 !important;">🎯 So funktioniert der Buchungsablauf</p>');
  lines.push('<p style="margin:0 0 8px; font-size:14px; color:#166534 !important;">Der typische Weg von Anfrage bis zur laufenden Therapie:</p>');
  lines.push('<ol style="margin:0; padding-left:20px; color:#15803d !important; font-size:14px; line-height:1.8;">');
  lines.push('<li><strong>Kostenloses Kennenlerngespräch</strong> (15 Min.) – Klient:in bucht über dein Profil</li>');
  lines.push('<li><strong>Erste Therapiesitzung</strong> (50 Min.) – Nach dem Kennenlernen: Du buchst für deine:n Klient:in</li>');
  lines.push('<li><strong>Folgetermine</strong> – Nach jeder Sitzung: Du buchst den nächsten Termin</li>');
  lines.push('</ol>');
  lines.push('</div>');

  // Section: Why book via Cal.com
  lines.push('<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(59, 130, 246, 0.2); margin:0 0 24px;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:700; color:#1e40af !important;">✨ Warum über Cal.com buchen?</p>');
  lines.push('<ul style="margin:0; padding-left:20px; color:#1e3a8a !important; font-size:14px; line-height:1.8;">');
  lines.push('<li>Termin landet automatisch in <strong>beiden Kalendern</strong></li>');
  lines.push('<li>Erinnerungen gehen automatisch an Klient:in raus (24h + 1h vorher)</li>');
  lines.push('<li>Du behältst den Überblick über alle Buchungen</li>');
  lines.push('</ul>');
  lines.push('</div>');

  // Section: Where to find
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:700; color:#0f172a !important;">📱 Wo findest du die Funktion?</p>');

  lines.push('<p style="margin:0 0 8px; font-size:14px; line-height:1.65; color:#475569 !important;"><strong>Option 1: In der Buchungsbestätigung</strong></p>');
  lines.push('<p style="margin:0 0 16px; font-size:14px; line-height:1.65; color:#64748b !important;">Nach jeder Buchung erhältst du eine E-Mail. Dort findest du jetzt einen Button „Nächsten Termin vereinbaren" – mit vorausgefüllten Klient:innen-Daten.</p>');

  lines.push('<p style="margin:0 0 8px; font-size:14px; line-height:1.65; color:#475569 !important;"><strong>Option 2: Im Therapeuten-Portal</strong></p>');
  lines.push('<p style="margin:0 0 24px; font-size:14px; line-height:1.65; color:#64748b !important;">Unter „Klient:in einbuchen" siehst du deine letzten Klient:innen und kannst direkt einen Folgetermin für sie buchen.</p>');

  // CTA
  lines.push(renderButton(portalUrl, 'Zum Portal →'));

  // Section: Client follow-up emails
  lines.push('<div style="background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(202, 138, 4, 0.2); margin:24px 0;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:700; color:#854d0e !important;">📬 Was deine Klient:innen bekommen</p>');
  lines.push('<p style="margin:0 0 8px; font-size:14px; line-height:1.65; color:#713f12 !important;">Nach jeder Sitzung erhält dein:e Klient:in ca. 15 Minuten später eine E-Mail mit der Einladung, den nächsten Termin zu buchen.</p>');
  lines.push('<p style="margin:0; font-size:14px; line-height:1.65; color:#713f12 !important;"><strong>Automatisch:</strong> Wenn du den Folgetermin innerhalb dieser 15 Minuten selbst einbuchst, wird die E-Mail automatisch übersprungen – dein:e Klient:in bekommt dann nur die Buchungsbestätigung.</p>');
  lines.push('</div>');

  // Section: Calendar sync note
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin:0 0 24px;">');
  lines.push('<p style="margin:0 0 12px; font-size:15px; font-weight:700; color:#0f172a !important;">💡 Hinweis: Kalender-Synchronisation</p>');
  lines.push('<p style="margin:0; font-size:14px; line-height:1.65; color:#475569 !important;">Falls du deinen Kalender mit Cal.com synchronisierst und einen Termin bereits manuell geblockt hast: Entferne zuerst den manuellen Eintrag, dann buche den Termin über Cal.com. So vermeidest du doppelte Einträge.</p>');
  lines.push('</div>');

  // Section: Backfill existing clients
  lines.push('<p style="margin:0 0 8px; font-size:15px; font-weight:700; color:#0f172a !important;">🔄 Bestehende Klient:innen nachbuchen</p>');
  lines.push('<p style="margin:0 0 24px; font-size:14px; line-height:1.65; color:#64748b !important;">Du hast Klient:innen, die noch nicht über Cal.com gebucht haben? Kein Problem – buche einfach ihren nächsten Termin über das Portal. So sind sie ab dann im System.</p>');

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

  return {
    subject: 'Neues Feature: Buche Folgetermine direkt für deine Klient:innen',
    html: renderLayout({
      title: 'Neues Feature: Klient:innen einbuchen',
      contentHtml: lines.join(''),
      preheader: 'Termine landen automatisch in beiden Kalendern – mit Erinnerungen',
    }),
  };
}
