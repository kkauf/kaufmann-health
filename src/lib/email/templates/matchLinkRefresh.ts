import { renderLayout, renderButton } from '../layout';
import { BASE_URL } from '@/lib/constants';

type MatchLinkRefreshParams = {
  patientName?: string | null;
  matchesUrl: string;
};

export function renderMatchLinkRefresh({ patientName, matchesUrl }: MatchLinkRefreshParams) {
  const greeting = patientName ? `Hallo ${patientName}` : 'Hallo';
  const fullUrl = matchesUrl.startsWith('http') ? matchesUrl : `${BASE_URL}${matchesUrl}`;

  const contentHtml = `
    <p>${greeting},</p>
    <p>Du hast versucht, deine Therapeuten-Empfehlungen aufzurufen, aber der Link war abgelaufen.</p>
    <p>Kein Problem – hier ist dein neuer Zugangslink:</p>
    ${renderButton(fullUrl, 'Meine Empfehlungen ansehen')}
    <p style="margin-top: 24px; color: #666; font-size: 14px;">
      Dieser Link ist 30 Tage gültig. Falls er erneut abläuft, kannst du jederzeit einen neuen anfordern.
    </p>
    <p style="margin-top: 16px;">Liebe Grüße,<br/>Dein Kaufmann Health Team</p>
  `;

  return {
    subject: 'Dein neuer Zugangslink zu deinen Therapeuten-Empfehlungen',
    html: renderLayout({
      title: 'Neuer Zugangslink',
      contentHtml,
      preheader: 'Dein Link wurde erneuert – hier kannst du deine Empfehlungen ansehen.',
    }),
  };
}
