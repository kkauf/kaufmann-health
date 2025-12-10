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
};

export function renderSelectionNudgeEmail(params: SelectionNudgeEmailParams): EmailContent {
  const { patientName, matchesUrl } = params;
  const name = (patientName || '').trim();

  const profileUrl = `${matchesUrl}?direct=1&utm_source=email&utm_medium=transactional&utm_campaign=selection_nudge_d5`;
  const helpEmail = 'kontakt@kaufmann-health.de';

  const contentHtml = `
    <div style="margin:0 0 24px;">
      ${name ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0; font-size:16px; line-height:1.65; color:#475569 !important;">die Wahl einer Therapeut:in ist eine wichtige Entscheidung — nimm dir die Zeit, die du brauchst.</p>
    </div>

    <!-- Reassurance Box -->
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(100, 116, 139, 0.06);">
      <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#334155 !important; font-weight:600;">Falls du unsicher bist, hier ein paar Gedanken:</p>
      
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
      ${renderButton(profileUrl, 'Meine Vorschläge ansehen')}
    </div>

    <!-- Help Section -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; border-radius:12px; border:1px solid rgba(34, 197, 94, 0.2); padding:16px 20px; box-shadow: 0 2px 4px 0 rgba(34, 197, 94, 0.06);">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#166534 !important;">
        <strong style="color:#14532d !important;">Brauchst du Hilfe bei der Entscheidung?</strong><br />
        <a href="mailto:${escapeHtml(helpEmail)}?subject=${encodeURIComponent('Hilfe bei der Therapeutenwahl')}" style="color:#16a34a !important;text-decoration:underline;">Schreib uns</a> — wir helfen dir gern.
      </p>
    </div>
  `;

  const subject = 'Noch unsicher? So findest du die richtige Person';
  const preheader = 'Das kostenlose Kennenlerngespräch ist unverbindlich – du entscheidest danach.';

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ViewAction',
      name: 'Meine Vorschläge ansehen',
      url: profileUrl,
    },
    description: preheader,
  };

  return {
    subject,
    html: renderLayout({ title: 'Noch unsicher?', contentHtml, preheader, schema }),
  };
}
