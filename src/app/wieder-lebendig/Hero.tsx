"use client";

import { useMemo, useState } from "react";
import PageAnalytics from "@/components/PageAnalytics";
import CtaLink from "@/components/CtaLink";
import { Button } from "@/components/ui/button";
import { EmailEntryForm } from "@/components/EmailEntryForm";

export default function WiederLebendigHero() {
  const [variant] = useState<"A" | "B">(() => {
    try {
      if (typeof window === 'undefined') return 'A';
      const url = new URL(window.location.href);
      const v = url.searchParams.get('v');
      if (v) return v.toUpperCase() === 'B' ? 'B' : 'A';
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
    () =>
      variant === "A"
        ? "Begib dich auf den Weg vom getriebenen Machen zum verkörperten Sein."
        : "Wage einen ehrlichen Blick in deine Innenwelt.",
    [variant]
  );

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-10"
    >
      <PageAnalytics qualifier={variant} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />

      <h1 id="hero-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
        {heroText}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-gray-700 sm:text-lg">
        Körperorientierte Therapie für Menschen, die wieder lebendig sein wollen – nicht noch erfolgreicher.
      </p>

      {/* Urgency */}
      <p className="mt-2 text-sm text-gray-700">5 Therapeut:innen haben diese Woche Zeit für dich</p>

      {/* Qualifier */}
      <div
        className="mt-4 rounded-xl border bg-amber-50/70 p-4 text-sm text-amber-900 sm:text-base"
        role="note"
        aria-label="Wichtiger Hinweis"
      >
        Dies ist kein Executive Coaching. Es ist tiefe therapeutische Arbeit für Menschen, die bereit sind, langsamer zu werden und wieder zu fühlen. Keine Kassenleistung – eine bewusste Investition in deine Lebendigkeit.
      </div>

      {/* CTAs */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" asChild data-cta="hero-primary">
          <CtaLink href="#top-form" eventType="cta_click" aria-label="Passende Therapeut:innen finden">
            Passende Therapeut:innen finden
          </CtaLink>
        </Button>
        <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
          <CtaLink href="/therapie-finden" eventType="cta_click" aria-label="Weitere Informationen">
            Weitere Informationen
          </CtaLink>
        </Button>
      </div>

      {/* Top-of-page embedded form */}
      <div className="mt-8" id="top-form">
        <EmailEntryForm />
      </div>
    </section>
  );
}
