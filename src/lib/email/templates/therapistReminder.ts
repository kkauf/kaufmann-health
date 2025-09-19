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
  profileUrl: string;
  uploadUrl: string;
  missingDocuments: boolean;
  missingPhoto: boolean;
  missingApproach: boolean;
  missingBasic?: boolean; // gender/city/accepting_new missing
  completionPercentage?: number; // 0..100
  stageLabel?: string; // e.g., "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung"
  optOutUrl?: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const pct = typeof params.completionPercentage === 'number' ? Math.max(0, Math.min(100, Math.round(params.completionPercentage))) : undefined;
  const items: string[] = [];
  if (params.missingDocuments) items.push('Lizenz‑Nachweis');
  if (params.missingPhoto) items.push('Profilfoto');
  if (params.missingApproach) items.push('Ansatz‑Beschreibung');
  if (params.missingBasic) items.push('Basisdaten (Stadt, Verfügbarkeit)');

  const missingList = items.length ? items.join(', ') : 'Profilangaben';

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 12px;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 12px;">Dein Profil ist fast startklar – es fehlen nur noch wenige Angaben.</p>');
  lines.push(`<p style=\"margin:0 0 12px;\"><strong>Fehlende Angaben:</strong> ${escapeHtml(missingList)}</p>`);
  if (typeof pct === 'number') {
    lines.push(`<p style=\"margin:0 0 12px; color:#374151;\">Dein Profil ist zu ${pct}% vollständig.</p>`);
  }
  const targetIsProfile = Boolean(params.missingPhoto || params.missingApproach || params.missingBasic);
  const targetUrl = targetIsProfile ? params.profileUrl : params.uploadUrl;
  const ctaLabel = targetIsProfile ? 'Profil vervollständigen' : 'Dokumente hochladen';
  lines.push(`<div style=\"text-align:center; margin: 12px 0 16px;\">${renderButton(targetUrl, ctaLabel)}</div>`);
  lines.push('<p style="margin:0 0 12px;">Dauert nur 5–10 Minuten. Danach kannst du sofort Klienten‑Anfragen erhalten.</p>');
  if (params.optOutUrl) {
    lines.push(
      `<p style=\"margin:8px 0 0; color:#6b7280; font-size:12px;\">Möchtest du diese Erinnerungen pausieren? <a href=\"${escapeHtml(params.optOutUrl)}\" style=\"color:#6b7280; text-decoration:underline;\">Hier klicken</a>.</p>`
    );
  }

  const subjectStage = params.stageLabel ? ` – ${params.stageLabel}` : '';
  let subjectBase = 'Profil vervollständigen';
  if (params.missingDocuments && !targetIsProfile) subjectBase = 'Lizenz‑Nachweis ausstehend';
  else if (params.missingPhoto) subjectBase = 'Dein Profil ist fast startklar – Foto fehlt noch';
  return {
    subject: `${subjectBase}${subjectStage}`,
    html: renderLayout({ title: subjectBase, contentHtml: lines.join('') }),
  };
}
