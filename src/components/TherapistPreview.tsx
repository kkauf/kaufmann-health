/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck2, HeartHandshake, Shell, Wind, Target, Video, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from "@/lib/schwerpunkte";

export type Therapist = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  schwerpunkte?: string[];
  session_preferences?: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  metadata?: {
    profile?: {
      who_comes_to_me?: string;
      session_focus?: string;
      about_me?: string;
      practice_address?: string;
    };
  };
  // Cal.com integration fields
  cal_username?: string | null;
  cal_enabled?: boolean | null;
  cal_bookings_live?: boolean | null;
  // Admin-only optional fields
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export interface TherapistPreviewProps {
  therapist: Therapist;
  actionButton?: React.ReactNode;
  variant?: "web" | "admin";
  className?: string;
  /** When true, show schwerpunkte badges instead of modality badges */
  showSchwerpunkte?: boolean;
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

const MODALITY_MAP: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  'narm': { label: 'NARM', cls: 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100', Icon: HeartHandshake },
  'somatic-experiencing': { label: 'Somatic Experiencing', cls: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100', Icon: Shell },
  'hakomi': { label: 'Hakomi', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100', Icon: Wind },
  'core-energetics': { label: 'Core Energetics', cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:border-fuchsia-300 hover:bg-fuchsia-100', Icon: Target },
};

export function TherapistPreview({ therapist, actionButton, variant = "web", className, showSchwerpunkte = false }: TherapistPreviewProps) {
  const [imageError, setImageError] = React.useState(false);
  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;

  const initials = React.useMemo(() => getInitials(therapist.first_name, therapist.last_name), [therapist.first_name, therapist.last_name]);
  const avatarColor = React.useMemo(() => `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`, [therapist.id]);
  // Build badge items with shared classes and icons
  const badgeItems = React.useMemo(() => {
    // Show schwerpunkte if requested and available, otherwise modalities
    if (showSchwerpunkte && Array.isArray(therapist.schwerpunkte) && therapist.schwerpunkte.length > 0) {
      return therapist.schwerpunkte.map((id, i) => {
        const label = getSchwerpunktLabel(id);
        const cls = getSchwerpunktColorClasses(id) + ' hover:shadow-sm';
        // No icon for schwerpunkte - matches TherapistCard design
        return { key: `schwerpunkt-${id}-${i}`, label, cls, Icon: null, modalityId: `schwerpunkt-${id}` };
      });
    }
    // Default: show modalities
    const list = Array.isArray(therapist.modalities) ? therapist.modalities : [];
    const items = list.map((m, i) => {
      const slug = normalizeModality(String(m));
      const conf = MODALITY_MAP[slug];
      const label = conf ? conf.label : toTitleCase(String(m));
      const cls = conf ? conf.cls : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100';
      const Icon = conf ? conf.Icon : Target;
      return { key: `${slug}-${i}`, label, cls, Icon, modalityId: `modality-${slug}` };
    });
    // Deduplicate by label to avoid repeats
    const seen = new Set<string>();
    return items.filter((it) => {
      const k = it.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [therapist.modalities, therapist.schwerpunkte, showSchwerpunkte]);

  const isAdmin = variant === "admin";

  return (
    <Card className={cn(isAdmin ? "p-3" : "p-4", "h-full", className)}>
      <CardContent className={cn("p-0 h-full", isAdmin ? "" : "")}>
        <div className={cn("flex items-start gap-4 h-full", isAdmin ? "gap-3" : "")}>
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

          <div className="min-w-0 flex-1 flex flex-col">
            {/* Name */}
            <div className={cn("truncate font-semibold", isAdmin ? "text-sm" : "text-base")}>{therapist.first_name} {therapist.last_name}</div>
            <div className={cn("mt-1")}> 
              {(() => {
                const max = isAdmin ? 2 : 3;
                const shown = badgeItems.slice(0, max);
                const extra = badgeItems.length - shown.length;
                return (
                  <div className="relative -mx-1">
                    <div className="min-h-[24px] overflow-x-auto whitespace-nowrap px-1 [scrollbar-width:none] [-ms-overflow-style:none]" aria-label="Modalitäten">
                      <div className="inline-flex gap-2">
                        {shown.map((b) => (
                          <Badge
                            key={b.key}
                            variant="outline"
                            data-modality-id={b.modalityId}
                            className={cn(
                              isAdmin ? "text-[10px] px-1.5 py-0" : "px-2 py-0.5 text-[11px]",
                              "rounded-full gap-1.5 shadow-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md active:shadow-sm active:translate-y-0",
                              b.cls,
                            )}
                          >
                            {b.Icon && <b.Icon className={cn(isAdmin ? "h-2.5 w-2.5" : "h-3 w-3", "opacity-90")} />}
                            {b.label}
                          </Badge>
                        ))}
                        {extra > 0 && (
                          <Badge variant="secondary" className={cn(isAdmin ? "text-[10px] px-1.5 py-0" : "px-2 py-0.5 text-[11px]")}>+{extra}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-4 bg-gradient-to-r from-white to-transparent"></div>
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-white to-transparent"></div>
                  </div>
                );
              })()}
            </div>
            {/* Format badges (Online/Vor Ort) */}
            {!isAdmin && (() => {
              const prefs = Array.isArray(therapist.session_preferences) ? therapist.session_preferences : [];
              const normalized = new Set(prefs.map(v => String(v).toLowerCase().replace(/[\s-]+/g, '_')));
              const hasEither = normalized.has('either') || normalized.has('both');
              const offersOnline = normalized.has('online') || hasEither;
              const offersInPerson = normalized.has('in_person') || normalized.has('inperson') || hasEither;
              if (!offersOnline && !offersInPerson) return null;
              return (
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {offersOnline && (
                    <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700 hover:bg-sky-100 text-[11px] px-2 py-0.5">
                      <Video className="h-3 w-3" />
                      Online
                    </Badge>
                  )}
                  {offersInPerson && (
                    <Badge variant="secondary" className="gap-1 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] px-2 py-0.5">
                      <User className="h-3 w-3" />
                      Vor Ort
                    </Badge>
                  )}
                </div>
              );
            })()}
            {/* City - admin only */}
            {isAdmin && <div className={cn("text-muted-foreground", "text-xs")}>{therapist.city}</div>}

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

            {/* Profile text - prefer new structured fields, fallback to legacy */}
            {(() => {
              const profile = therapist.metadata?.profile;
              // Prefer who_comes_to_me with prefix for context
              if (profile?.who_comes_to_me) {
                return (
                  <p
                    className={cn("mt-1 text-slate-700", isAdmin ? "text-xs" : "text-sm")}
                    style={{ display: "-webkit-box", WebkitLineClamp: isAdmin ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    <span className="font-medium">Zu mir kommen Menschen, die </span>
                    {profile.who_comes_to_me}
                  </p>
                );
              }
              // Fallback to session_focus or legacy approach_text
              const fallbackText = profile?.session_focus || profile?.about_me || therapist.approach_text;
              if (!fallbackText) return null;
              return (
                <p
                  className={cn("mt-1 text-slate-700", isAdmin ? "text-xs" : "text-sm")}
                  style={{ display: "-webkit-box", WebkitLineClamp: isAdmin ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {fallbackText}
                </p>
              );
            })()}

            {/* Bottom area pinned: availability + optional action */}
            <div className="mt-auto pt-2">
              {!isAdmin && (
                <div>
                  {therapist.accepting_new ? (
                    <Badge className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Verfügbar</span>
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Keine Kapazität</Badge>
                  )}
                </div>
              )}
              {actionButton ? (
                <div className={cn("mt-3", isAdmin ? "mt-2" : "mt-3")}>{actionButton}</div>
              ) : null}
            </div>
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
