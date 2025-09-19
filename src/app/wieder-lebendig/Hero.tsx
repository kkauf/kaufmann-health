"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ShieldCheck, Lock, UserCheck } from "lucide-react";
import { COOKIES_ENABLED } from "@/lib/config";
import PageAnalytics from "@/components/PageAnalytics";
import CtaLink from "@/components/CtaLink";
import { Button } from "@/components/ui/button";
import { EmailEntryForm } from "@/components/EmailEntryForm";
import VariantGate from "@/components/VariantGate";

export default function WiederLebendigHero() {
  const [variant] = useState<"A" | "B" | "C">(() => {
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
      // Persist variant in URL without navigation to enable server attribution and API forwarding
      try {
        url.searchParams.set('v', assigned);
        window.history.replaceState({}, '', url.toString());
      } catch {}
      return assigned;
    } catch {
      return 'A';
    }
  });

  const heroText = useMemo(
    () => "Wieder spüren statt nur schaffen.",
    []
  );

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
    >
      <PageAnalytics qualifier={variant} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />

      {/* Two-column desktop layout: left copy, right form */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          {/* Urgency badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            5 Therapeut:innen haben diese Woche Zeit für dich
          </div>

          <h1 id="hero-heading" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {heroText}
          </h1>
          <VariantGate show="C">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientiertes Coaching & Begleitung – 80–120€ pro Sitzung. Diese Woche noch verfügbar.
            </p>
          </VariantGate>
          <VariantGate show="A">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientierte Therapie mit handverlesenen Therapeut:innen – diese Woche noch verfügbar
            </p>
          </VariantGate>
          <VariantGate show="B">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientierte Therapie mit handverlesenen Therapeut:innen – diese Woche noch verfügbar
            </p>
          </VariantGate>

          {/* Trust markers to match /therapie-finden */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700" aria-label="Vertrauen">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Geprüfte Profile
            </span>
            {!COOKIES_ENABLED && (
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-700" />
                Keine Tracking‑Cookies
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              Transparente Datenverarbeitung
            </span>
          </div>

          {/* Compact modality logos */}
          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
            <Image src="/logos/Modalities/NARM.png" alt="NARM" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Hakomi.png" alt="Hakomi" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
          </div>

          {/* Paired actions: primary + pricing pill */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
              <CtaLink href="#pricing" eventType="cta_click" aria-label="Preise anzeigen">
                80-120€ pro Sitzung
              </CtaLink>
            </Button>
          </div>
        </div>

        {/* Top-of-page embedded form (right) */}
        <div className="lg:pl-6 scroll-mt-24" id="top-form">
          <EmailEntryForm />
        </div>
      </div>
    </section>
  );
}
