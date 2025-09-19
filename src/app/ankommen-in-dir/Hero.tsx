"use client";

import Image from "next/image";
import CtaLink from "@/components/CtaLink";
import { Button } from "@/components/ui/button";
import { EmailEntryForm } from "@/components/EmailEntryForm";
import { ShieldCheck, Lock, UserCheck } from "lucide-react";
import { COOKIES_ENABLED } from "@/lib/config";
import VariantGate from "@/components/VariantGate";

export default function AnkommenHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: copy */}
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              Deutschlandweit • Online
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Keine Warteliste
            </div>
          </div>

          <VariantGate show="A">
            <h1 id="hero-heading" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Der nächste Schritt deiner Heilungsreise
            </h1>
          </VariantGate>
          <VariantGate show="B">
            <h1 id="hero-heading" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Finde deinen Therapeuten – diese Woche noch
            </h1>
          </VariantGate>
          <VariantGate show="C">
            <h1 id="hero-heading" className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Ankommen in dir – Coaching & Begleitung online
            </h1>
          </VariantGate>
          <VariantGate show="C">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientiertes Coaching & Begleitung – persönlich kuratiert und online verfügbar. 80–120€ pro Sitzung.
            </p>
          </VariantGate>
          <VariantGate show="A">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientierte Therapie online – persönlich kuratiert. NARM, Somatic Experiencing, Hakomi, Core Energetics. 80–120€ pro Sitzung.
            </p>
          </VariantGate>
          <VariantGate show="B">
            <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
              Körperorientierte Therapie online – persönlich kuratiert. NARM, Somatic Experiencing, Hakomi, Core Energetics. 80–120€ pro Sitzung.
            </p>
          </VariantGate>

          {/* Trust markers */}
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
            <span className="inline-flex items-center gap-2">
              Sichere therapeutische Räume
            </span>
          </div>

          <VariantGate show="A">
            <p className="mt-2 text-xs text-emerald-700">Starte innerhalb von 7 Tagen</p>
          </VariantGate>
          <VariantGate show="B">
            <p className="mt-2 text-xs text-emerald-700">Diese Woche noch Termine möglich</p>
          </VariantGate>

          {/* Compact modality logos */}
          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
            <Image src="/logos/Modalities/NARM.png" alt="NARM" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Hakomi.png" alt="Hakomi" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
          </div>

          {/* Paired actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild data-cta="hero-primary" className="bg-black text-white hover:bg-black/90">
              <CtaLink href="#top-form" eventType="cta_click" aria-label="Passende Therapeut:innen finden">
                Passende Therapeut:innen finden
              </CtaLink>
            </Button>
            <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
              <CtaLink href="#pricing" eventType="cta_click" aria-label="Preise anzeigen">
                80–120€ pro Sitzung
              </CtaLink>
            </Button>
          </div>
        </div>

        {/* Right: form */}
        <div className="lg:pl-6 scroll-mt-24" id="top-form">
          <EmailEntryForm defaultSessionPreference="online" />
        </div>
      </div>
    </section>
  );
}
