"use client";

import { useParams, notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Users, ShieldCheck, ArrowRight } from "lucide-react";
import CtaLink from "@/components/CtaLink";
import { MODALITIES, type ModalityId } from "@/features/therapies/modalityConfig";

// Campaign landing page - minimal, conversion-focused
// URL: /lp/narm, /lp/somatic-experiencing, etc.
// Use: Google Ads campaigns targeting specific modalities

const MODALITY_COPY: Record<ModalityId, {
  headline: string;
  subheadline: string;
  benefits: string[];
}> = {
  'narm': {
    headline: "NARM Therapeut:in finden",
    subheadline: "Körperorientierte Therapie für Entwicklungstrauma — ohne Retraumatisierung",
    benefits: [
      "Geprüfte NARM-zertifizierte Therapeut:innen",
      "Online oder vor Ort in deiner Nähe",
      "Kostenlose Vermittlung in unter 24h",
    ],
  },
  'somatic-experiencing': {
    headline: "Somatic Experiencing Therapeut:in finden",
    subheadline: "Traumatherapie nach Dr. Peter Levine — sanft und körperbasiert",
    benefits: [
      "Zertifizierte SE-Praktiker:innen (SEP)",
      "Online oder vor Ort in deiner Nähe",
      "Kostenlose Vermittlung in unter 24h",
    ],
  },
  'hakomi': {
    headline: "Hakomi Therapeut:in finden",
    subheadline: "Achtsamkeitsbasierte Körpertherapie — sanft und transformativ",
    benefits: [
      "Zertifizierte Hakomi-Therapeut:innen",
      "Online oder vor Ort in deiner Nähe",
      "Kostenlose Vermittlung in unter 24h",
    ],
  },
  'core-energetics': {
    headline: "Core Energetics Therapeut:in finden",
    subheadline: "Körperorientierte Charakterarbeit — tiefgreifend und befreiend",
    benefits: [
      "Zertifizierte Core Energetics Therapeut:innen",
      "Online oder vor Ort in deiner Nähe",
      "Kostenlose Vermittlung in unter 24h",
    ],
  },
};

export default function CampaignLandingPage() {
  const params = useParams();
  const modalitySlug = params.modality as string;

  // Validate modality
  const modalityConfig = Object.values(MODALITIES).find(m => m.slug === modalitySlug);
  if (!modalityConfig) {
    notFound();
  }

  const copy = MODALITY_COPY[modalityConfig.id];
  const fragebogenHref = `/fragebogen?variant=self-service&modality=${modalityConfig.id}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50/30 to-white">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16 lg:py-20">
        {/* Trust bar */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600 mb-8">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Geprüfte Therapeut:innen</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-emerald-600" />
            <span>Antwort in &lt;24h</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>100% kostenlos</span>
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            {copy.headline}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto">
            {copy.subheadline}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="flex justify-center mb-12">
          <Button
            asChild
            size="lg"
            className="h-14 px-8 text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
          >
            <CtaLink
              href={fragebogenHref}
              eventType="cta_click"
              eventId={`lp-${modalityConfig.id}-hero-cta`}
            >
              Jetzt Therapeut:in finden
              <ArrowRight className="ml-2 h-5 w-5" />
            </CtaLink>
          </Button>
        </div>

        {/* Benefits */}
        <div className="rounded-2xl border border-emerald-100 bg-white/80 backdrop-blur-sm p-6 sm:p-8 shadow-sm">
          <ul className="space-y-4">
            {copy.benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium">
                  ✓
                </span>
                <span className="text-gray-700">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Secondary CTA */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 mb-4">
            3-Minuten Fragebogen • Unverbindlich • DSGVO-konform
          </p>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 px-6 font-medium"
          >
            <CtaLink
              href={fragebogenHref}
              eventType="cta_click"
              eventId={`lp-${modalityConfig.id}-secondary-cta`}
            >
              Kostenlos starten →
            </CtaLink>
          </Button>
        </div>

        {/* Escape hatch */}
        <div className="mt-12 text-center">
          <CtaLink
            href={`/therapeuten${modalityConfig.directoryFilterParams}`}
            eventType="cta_click"
            eventId={`lp-${modalityConfig.id}-browse-all`}
            className="text-sm text-gray-500 hover:text-emerald-700 underline underline-offset-2 transition-colors"
          >
            Oder: Alle {modalityConfig.name}-Therapeut:innen direkt ansehen →
          </CtaLink>
        </div>
      </div>
    </main>
  );
}
