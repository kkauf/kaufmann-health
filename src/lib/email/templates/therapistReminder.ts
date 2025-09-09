import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTherapistReminder(params: {
  name?: string | null;
  uploadUrl: string;
  missingDocuments: boolean;
  missingPhoto: boolean;
  missingApproach: boolean;
  completionPercentage?: number; // 0..100
  stageLabel?: string; // e.g., "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung"
}): EmailContent {
  const name = (params.name || '').trim();
  const pct = typeof params.completionPercentage === 'number' ? Math.max(0, Math.min(100, Math.round(params.completionPercentage))) : undefined;
  const items: string[] = [];
  if (params.missingDocuments) items.push('Dokumente');
  if (params.missingPhoto) items.push('Profilfoto');
  if (params.missingApproach) items.push('Ansatz‑Beschreibung');

  const missingList = items.length ? items.join(', ') : 'Profilangaben';

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">Sie haben sich erfolgreich angemeldet, aber Ihr Profil ist noch nicht vollständig.</p>');
  lines.push(`<p style=\"margin:0 0 12px;\"><strong>Fehlende Angaben:</strong> ${escapeHtml(missingList)}</p>`);
  if (typeof pct === 'number') {
    lines.push(`<p style=\"margin:0 0 12px; color:#374151;\">Ihr Profil ist zu ${pct}% vollständig.</p>`);
  }
  lines.push(`<div style=\"text-align:center; margin: 12px 0 16px;\">${renderButton(params.uploadUrl, 'Profil vervollständigen')}</div>`);
  lines.push('<p style="margin:0 0 12px;">Dauert nur 5–10 Minuten. Danach können Sie sofort Klienten‑Anfragen erhalten.</p>');

  const subjectStage = params.stageLabel ? ` – ${params.stageLabel}` : '';
  return {
    subject: `Profil vervollständigen${subjectStage}`,
    html: renderLayout({ title: 'Profil vervollständigen', contentHtml: lines.join('') }),
  };
}
