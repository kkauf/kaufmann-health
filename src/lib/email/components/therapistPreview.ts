import { BASE_URL } from '@/lib/constants';

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

// Convert Supabase public bucket URLs to our domain proxy for deliverability in emails
function toProxiedPhotoUrl(url?: string | null): string | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  // Already proxied or already our domain
  if (raw.startsWith(`${BASE_URL}/api/images/therapist-profiles/`) || raw.startsWith(BASE_URL)) return raw;
  try {
    const u = new URL(raw);
    const path = u.pathname;
    // Match both variants:
    //  - /storage/v1/object/public/therapist-profiles/<path>
    //  - /storage/v1/render/image/public/therapist-profiles/<path>
    const m = path.match(/\/storage\/v1\/(?:object|render\/image)\/public\/therapist-profiles\/(.+)$/);
    if (m && m[1]) {
      // Preserve any query string from the original URL? Public URLs shouldn't need it; drop to maximize cacheability.
      const proxiedPath = m[1];
      return `${BASE_URL}/api/images/therapist-profiles/${proxiedPath}`;
    }
  } catch {}
  return raw; // Fallback: leave as-is if not a Supabase public URL
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

  const photoSrc = toProxiedPhotoUrl(params.photo_url);
  const photo = photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;display:block;border-radius:999px;" />`
    : `<div style="width:72px;height:72px;color:#fff !important;display:flex;align-items:center;justify-content:center;font-weight:600;border-radius:999px;">${escapeHtml(initials)}</div>`;
  // Build multiple modality badges
  const badgeItems = buildBadgeItems(params.modalities || []);
  const maxBadges = 3;
  const shown = badgeItems.slice(0, maxBadges);
  const extra = badgeItems.length - shown.length;
  const badgeBase = 'display:inline-block;border-radius:999px;font-size:12px;padding:2px 8px;line-height:1.3;vertical-align:middle;margin:2px 6px 2px 0;';
  const badgesHtml = [
    ...shown.map((b) => `<span style="${badgeBase}background:${b.color} !important;color:#fff !important;">${escapeHtml(b.label)}</span>`),
    ...(extra > 0 ? [`<span style="${badgeBase}background:#e5e7eb !important;color:#111827 !important;">+${extra}</span>`] : []),
  ].join("");

  const availability = params.accepting_new
    ? `<span style="color:#16a34a !important;font-weight:500">✓ Verfügbar</span>`
    : `<span style="color:#ef4444 !important;font-weight:500">✕ Derzeit keine Kapazität</span>`;

  const action = params.actionButtonHtml ? `<div style="margin-top:12px;">${params.actionButtonHtml}</div>` : "";

  return [
    `<div style="display:flex;align-items:flex-start;">`,
    `  <div style="width:72px;height:72px;border-radius:999px;overflow:hidden;background:${avatarColor} !important;flex:0 0 auto;margin-right:12px;border:1px solid #e5e7eb;">${photo}</div>`,
    `  <div style="flex:1;min-width:0;">`,
    `    <div style="font-weight:600;margin-bottom:4px;color:#0f172a !important;">${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}</div>`,
    `    <div style="margin:0 0 6px 0;">${badgesHtml}</div>`,
    `    <div style="color:#475569 !important;font-size:14px;margin-bottom:4px;">${escapeHtml(params.city || "")}</div>`,
    `    <div style="font-size:14px;color:#334155 !important;margin-bottom:8px;">${escapeHtml(approach)}</div>`,
    `    <div style="font-size:14px;color:#334155 !important;">Neue Klient:innen: ${availability}</div>`,
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
