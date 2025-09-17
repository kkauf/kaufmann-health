/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type Therapist = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  // Admin-only optional fields
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export interface TherapistPreviewProps {
  therapist: Therapist;
  actionButton?: React.ReactNode;
  variant?: "email" | "web" | "admin";
  className?: string;
}

function normalizeModality(v: string): string {
  return v
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
  // Set 1 — Brand-leaning (solid)
  'narm': { label: 'NARM', color: '#0f766e' },
  'somatic-experiencing': { label: 'Somatic Experiencing', color: '#d97706' },
  'hakomi': { label: 'Hakomi', color: '#047857' },
  'core-energetics': { label: 'Core Energetics', color: '#a21caf' },
};

export function TherapistPreview({ therapist, actionButton, variant = "web", className }: TherapistPreviewProps) {
  const [imageError, setImageError] = React.useState(false);
  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;

  const initials = React.useMemo(() => getInitials(therapist.first_name, therapist.last_name), [therapist.first_name, therapist.last_name]);
  const avatarColor = React.useMemo(() => `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`, [therapist.id]);
  // Build badge items with brand colors and correct casing
  const badgeItems = React.useMemo(() => {
    const list = Array.isArray(therapist.modalities) ? therapist.modalities : [];
    const items = list.map((m, i) => {
      const slug = normalizeModality(String(m));
      const conf = MODALITY_MAP[slug];
      const label = conf ? conf.label : toTitleCase(String(m));
      const color = conf ? conf.color : "#0f172a"; // default deep slate
      return { key: `${slug}-${i}`, label, color };
    });
    // Deduplicate by label to avoid repeats
    const seen = new Set<string>();
    return items.filter((it) => {
      const k = it.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [therapist.modalities]);

  if (variant === "email") {
    // Inline-styled markup suitable for email HTML (no Tailwind)
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "999px", overflow: "hidden", background: avatarColor, flex: "0 0 auto" }}>
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={`${therapist.first_name} ${therapist.last_name}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>
              {initials}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>{therapist.first_name} {therapist.last_name}</div>
            {(() => {
              const max = 3;
              const shown = badgeItems.slice(0, max);
              const extra = badgeItems.length - shown.length;
              return (
                <>
                  {shown.map((b) => (
                    <span key={b.key} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: b.color, color: "#fff", fontSize: 12, padding: "2px 8px" }}>{b.label}</span>
                  ))}
                  {extra > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#e5e7eb", color: "#111827", fontSize: 12, padding: "2px 8px" }}>+{extra}</span>
                  )}
                </>
              );
            })()}
          </div>
          <div style={{ color: "#475569", fontSize: 14, marginBottom: 4 }}>{therapist.city}</div>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>{truncateSentences(therapist.approach_text, 3)}</div>
          <div style={{ fontSize: 14 }}>
            Neue Klient:innen: {therapist.accepting_new ? (
              <span style={{ color: "#16a34a", fontWeight: 500 }}>✓ Verfügbar</span>
            ) : (
              <span style={{ color: "#ef4444", fontWeight: 500 }}>✕ Derzeit keine Kapazität</span>
            )}
          </div>
          {actionButton ? <div style={{ marginTop: 8 }}>{actionButton}</div> : null}
        </div>
      </div>
    );
  }

  const isAdmin = variant === "admin";

  return (
    <Card className={cn(isAdmin ? "p-3" : "p-4", className)}>
      <CardContent className={cn("p-0", isAdmin ? "" : "")}>
        <div className={cn("flex items-start gap-4", isAdmin ? "gap-3" : "")}>
          <Avatar className={cn(isAdmin ? "h-12 w-12" : "h-16 w-16")}
            aria-label={`${therapist.first_name} ${therapist.last_name}`}
          >
            {photoSrc ? (
              <AvatarImage
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                onError={() => setImageError(true)}
              />
            ) : (
              <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-white font-semibold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className={cn("flex items-center gap-2 flex-wrap", isAdmin ? "gap-2" : "gap-3")}> 
              <div className={cn("truncate font-semibold", isAdmin ? "text-sm" : "text-base")}>{therapist.first_name} {therapist.last_name}</div>
              {(() => {
                const max = isAdmin ? 2 : 3;
                const shown = badgeItems.slice(0, max);
                const extra = badgeItems.length - shown.length;
                return (
                  <>
                    {shown.map((b) => (
                      <Badge key={b.key} className={cn(isAdmin ? "text-[10px] px-1.5 py-0" : "px-2.5 py-0.5 text-[11px] tracking-wide", "border-transparent text-white")} style={{ backgroundColor: b.color }}>{b.label}</Badge>
                    ))}
                    {extra > 0 && (
                      <Badge variant="secondary" className={cn(isAdmin ? "text-[10px] px-1.5 py-0" : "px-2.5 py-0.5 text-[11px]")}>+{extra}</Badge>
                    )}
                  </>
                );
              })()}
            </div>
            <div className={cn("text-muted-foreground", isAdmin ? "text-xs" : "text-sm")}>{therapist.city}</div>

            {isAdmin && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                {(() => {
                  const s = (therapist.status || '').toString();
                  if (!s) return null;
                  const { label, cls } = mapStatus(s);
                  return <Badge variant="outline" className={cn("px-1.5 py-0", cls)}>{label}</Badge>;
                })()}
                {typeof therapist.accepting_new === 'boolean' && (
                  therapist.accepting_new ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0">Verfügbar</Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 px-1.5 py-0">Keine Kapazität</Badge>
                  )
                )}
                {therapist.email && (
                  <a className="underline font-mono text-slate-700" href={`mailto:${therapist.email}`}>{therapist.email}</a>
                )}
                {therapist.phone && (
                  <a className="underline font-mono text-slate-700" href={`tel:${therapist.phone}`}>{therapist.phone}</a>
                )}
                {therapist.created_at && (
                  <span className="text-slate-500">Eingang: {formatDate(therapist.created_at)}</span>
                )}
              </div>
            )}

            {therapist.approach_text ? (
              <p
                className={cn("mt-1 text-slate-700", isAdmin ? "text-xs" : "text-sm")}
                style={{ display: "-webkit-box", WebkitLineClamp: isAdmin ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
              >
                {therapist.approach_text}
              </p>
            ) : null}

            {!isAdmin && (
              <div className={cn("mt-2", isAdmin ? "text-xs" : "text-sm")}
                   aria-label={therapist.accepting_new ? "Neue Klient:innen: Verfügbar" : "Neue Klient:innen: Keine Kapazität"}
              >
                Neue Klient:innen: {therapist.accepting_new ? (
                  <span className="text-emerald-600 font-medium">✓ Verfügbar</span>
                ) : (
                  <span className="text-red-500 font-medium">✕ Derzeit keine Kapazität</span>
                )}
              </div>
            )}

            {actionButton ? (
              <div className={cn("mt-3", isAdmin ? "mt-2" : "mt-3")}>{actionButton}</div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getInitials(first?: string, last?: string) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
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
  return out || text;
}

function mapStatus(s: string): { label: string; cls: string } {
  const key = s.toLowerCase();
  switch (key) {
    case 'verified':
      return { label: 'Verifiziert', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    case 'pending_verification':
      return { label: 'In Prüfung', cls: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'rejected':
      return { label: 'Abgelehnt', cls: 'border-red-200 bg-red-50 text-red-700' };
    default:
      return { label: s, cls: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
}

function formatDate(iso?: string | null): string {
  try {
    return iso ? new Date(iso).toLocaleString() : '';
  } catch {
    return iso || '';
  }
}

export default TherapistPreview;
