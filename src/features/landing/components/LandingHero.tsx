"use client";

import React from "react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ShieldCheck, Lock, UserCheck } from "lucide-react";
import { COOKIES_ENABLED } from "@/lib/config";
import PageAnalytics from "@/components/PageAnalytics";
import { EmailEntryForm } from "@/components/EmailEntryForm";
import ModalityLogoStrip from "./ModalityLogoStrip";

export type TrustItem = { icon?: ReactNode; label: ReactNode };

export function LandingHero({
  title,
  subtitle,
  trustItems,
  showModalityLogos,
  defaultSessionPreference,
  badge,
  ctaPill,
  analyticsQualifier,
  assignVariantParam,
  formDataCta,
}: {
  title: string;
  subtitle?: ReactNode;
  trustItems?: TrustItem[];
  showModalityLogos?: boolean;
  defaultSessionPreference?: "online" | "in_person";
  badge?: ReactNode;
  ctaPill?: ReactNode; // e.g., <Button variant="outline" size="lg" asChild>...</Button>
  analyticsQualifier?: string;
  assignVariantParam?: boolean;
  formDataCta?: string;
}) {
  const [variant] = useState<"A" | "B" | "C" | undefined>(() => {
    if (!assignVariantParam) return undefined;
    try {
      if (typeof window === 'undefined') return 'A';
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      if (v) {
        const up = v.toUpperCase();
        if (up === 'B') return 'B';
        if (up === 'C') return 'C';
        return 'A';
      }
      const assigned: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
      try {
        url.searchParams.set('v', assigned);
        window.history.replaceState({}, '', url.toString());
      } catch {}
      return assigned;
    } catch {
      return 'A';
    }
  });

  const analyticsQ = analyticsQualifier ?? (assignVariantParam ? variant : undefined);
  const computedTrustItems = useMemo<TrustItem[]>(() => {
    if (trustItems && trustItems.length > 0) return trustItems;
    const items: TrustItem[] = [
      { icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, label: "Geprüfte Profile" },
      { icon: <UserCheck className="h-4 w-4 text-indigo-600" />, label: "Transparente Datenverarbeitung" },
    ];
    if (!COOKIES_ENABLED) {
      items.splice(1, 0, { icon: <Lock className="h-4 w-4 text-slate-700" />, label: "Keine Tracking‑Cookies" });
    }
    return items;
  }, [trustItems]);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
    >
      {analyticsQ ? <PageAnalytics qualifier={String(analyticsQ)} /> : null}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />

      {/* Two-column desktop layout: left copy, right form */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          {/* Optional badge */}
          {badge ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {badge}
            </div>
          ) : null}

          <h1 id="hero-heading" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {title}
          </h1>

          {subtitle ? (
            <div className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">{subtitle}</div>
          ) : null}

          {/* Trust markers */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-gray-700" aria-label="Vertrauen">
            {computedTrustItems.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                {t.icon}
                {t.label}
              </span>
            ))}
          </div>

          {/* Optional modality logos */}
          {showModalityLogos ? <ModalityLogoStrip /> : null}

          {/* Optional paired actions: custom CTA pill */}
          {ctaPill ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {ctaPill}
            </div>
          ) : null}
        </div>

        {/* Top-of-page embedded form (right) */}
        <div className="lg:pl-6 scroll-mt-24" id="top-form" {...(formDataCta ? { 'data-cta': formDataCta } : {})}>
          <EmailEntryForm defaultSessionPreference={defaultSessionPreference} dataCta={formDataCta} />
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
