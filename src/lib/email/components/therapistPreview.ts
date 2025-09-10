function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getInitials(first?: string | null, last?: string | null) {
  const f = (first?.trim() || "").charAt(0);
  const l = (last?.trim() || "").charAt(0);
  return `${f}${l}`.toUpperCase();
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function truncateSentences(text: string, maxSentences: number) {
  const parts = (text || "").split(/([.!?]\s+)/);
  let count = 0;
  let out = "";
  for (let i = 0; i < parts.length && count < maxSentences; i++) {
    out += parts[i];
    if (/([.!?]\s+)$/.test(parts[i])) count++;
  }
  return out || text || "";
}

export function renderTherapistPreviewEmail(params: {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  approach_text?: string | null;
  accepting_new?: boolean | null;
  city?: string | null;
  actionButtonHtml?: string; // already inlined styles, safe HTML (trusted)
}): string {
  const initials = getInitials(params.first_name, params.last_name);
  const avatarColor = `hsl(${hashCode(params.id) % 360}, 70%, 50%)`;
  const approach = truncateSentences(params.approach_text || "", 3);

  const photo = params.photo_url
    ? `<img src="${escapeHtml(params.photo_url)}" alt="${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:100%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;">${escapeHtml(initials)}</div>`;
  // Build multiple modality badges
  const badgeItems = buildBadgeItems(params.modalities || []);
  const maxBadges = 3;
  const shown = badgeItems.slice(0, maxBadges);
  const extra = badgeItems.length - shown.length;
  const badgesHtml = [
    ...shown.map((b) => `<span style="display:inline-flex;align-items:center;border-radius:999px;background:${b.color};color:#fff;font-size:12px;padding:2px 8px;">${escapeHtml(b.label)}</span>`),
    ...(extra > 0 ? [`<span style="display:inline-flex;align-items:center;border-radius:999px;background:#e5e7eb;color:#111827;font-size:12px;padding:2px 8px;">+${extra}</span>`] : []),
  ].join("");

  const availability = params.accepting_new
    ? `<span style="color:#16a34a;font-weight:500">✓ Verfügbar</span>`
    : `<span style="color:#ef4444;font-weight:500">✕ Derzeit keine Kapazität</span>`;

  const action = params.actionButtonHtml ? `<div style="margin-top:8px;">${params.actionButtonHtml}</div>` : "";

  return [
    `<div style="display:flex;align-items:flex-start;gap:12px;">`,
    `  <div style="width:56px;height:56px;border-radius:999px;overflow:hidden;background:${avatarColor};flex:0 0 auto;">${photo}</div>`,
    `  <div style="flex:1;min-width:0;">`,
    `    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap;">`,
    `      <div style="font-weight:600;">${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}</div>`,
    `      ${badgesHtml}`,
    `    </div>`,
    `    <div style="color:#475569;font-size:14px;margin-bottom:4px;">${escapeHtml(params.city || "")}</div>`,
    `    <div style="font-size:14px;color:#334155;margin-bottom:8px;">${escapeHtml(approach)}</div>`,
    `    <div style="font-size:14px;">Neue Klienten: ${availability}</div>`,
    `    ${action}`,
    `  </div>`,
    `</div>`,
  ].join("");
}

function normalizeModality(v: string): string {
  return String(v)
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function toTitleCase(s: string): string {
  return String(s)
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

const MODALITY_MAP: Record<string, { label: string; color: string }> = {
  'narm': { label: 'NARM', color: '#0f766e' },
  'somatic-experiencing': { label: 'Somatic Experiencing', color: '#d97706' },
  'hakomi': { label: 'Hakomi', color: '#047857' },
  'core-energetics': { label: 'Core Energetics', color: '#a21caf' },
};

function buildBadgeItems(modalities: string[]): Array<{ label: string; color: string }> {
  const list = Array.isArray(modalities) ? modalities : [];
  const items = list.map((m) => {
    const slug = normalizeModality(String(m));
    const conf = MODALITY_MAP[slug];
    const label = conf ? conf.label : toTitleCase(String(m));
    const color = conf ? conf.color : '#0f172a';
    return { label, color };
  });
  // Deduplicate by label
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
