import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

/**
 * Simple notification when an admin hides a therapist profile from the directory.
 */
export function renderTherapistProfileHidden(params: {
  name?: string | null;
}): EmailContent {
  const name = (params.name || '').trim();

  const contentHtml = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Dein Profil ist jetzt versteckt</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${name}` : ''},</p>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Dein Profil wird aktuell nicht mehr im öffentlichen Therapeuten-Verzeichnis angezeigt.</p>

    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen melde dich unter <a href="mailto:partners@kaufmann-health.de" style="color:#2563eb !important;">partners@kaufmann-health.de</a>.</p>
    </div>
  `;

  return {
    subject: 'Dein Profil ist jetzt versteckt',
    html: renderLayout({
      title: 'Dein Profil ist jetzt versteckt',
      contentHtml,
      preheader: 'Dein Profil wird aktuell nicht im Verzeichnis angezeigt.',
    }),
  };
}
