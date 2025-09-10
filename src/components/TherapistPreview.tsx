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
};

export interface TherapistPreviewProps {
  therapist: Therapist;
  actionButton?: React.ReactNode;
  variant?: "email" | "web" | "admin";
  className?: string;
}

export function TherapistPreview({ therapist, actionButton, variant = "web", className }: TherapistPreviewProps) {
  const [imageError, setImageError] = React.useState(false);
  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;

  const initials = React.useMemo(() => getInitials(therapist.first_name, therapist.last_name), [therapist.first_name, therapist.last_name]);
  const avatarColor = React.useMemo(() => `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`, [therapist.id]);
  const primaryModality = therapist.modalities?.[0];

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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ fontWeight: 600 }}>{therapist.first_name} {therapist.last_name}</div>
            {primaryModality ? (
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#0f172a", color: "#fff", fontSize: 12, padding: "2px 8px" }}>{primaryModality}</span>
            ) : null}
          </div>
          <div style={{ color: "#475569", fontSize: 14, marginBottom: 4 }}>{therapist.city}</div>
          <div style={{ fontSize: 14, color: "#334155", marginBottom: 8 }}>{truncateSentences(therapist.approach_text, 3)}</div>
          <div style={{ fontSize: 14 }}>
            Neue Klienten: {therapist.accepting_new ? (
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
            <div className={cn("flex items-center gap-2", isAdmin ? "gap-2" : "gap-3")}> 
              <div className={cn("truncate font-semibold", isAdmin ? "text-sm" : "text-base")}>{therapist.first_name} {therapist.last_name}</div>
              {primaryModality ? (
                <Badge className={cn(isAdmin ? "text-[10px] px-1.5 py-0" : "")}>{primaryModality}</Badge>
              ) : null}
            </div>
            <div className={cn("text-muted-foreground", isAdmin ? "text-xs" : "text-sm")}>{therapist.city}</div>

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
                   aria-label={therapist.accepting_new ? "Neue Klienten: Verfügbar" : "Neue Klienten: Keine Kapazität"}
              >
                Neue Klienten: {therapist.accepting_new ? (
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

export default TherapistPreview;
