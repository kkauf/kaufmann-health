import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Clock, Heart, HeartHandshake, Shell, Wind, Target } from "lucide-react";
import PageAnalytics from "@/components/PageAnalytics";
import CtaLink from "@/components/CtaLink";
import { Card } from "@/components/ui/card";
import { HeroNoForm, ProcessTimeline } from "@/features/landing/components";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata: Metadata = {
  title: "Körperpsychotherapie – Therapeut:innen finden | Kaufmann Health",
  description: "Finde handverlesene Therapeut:innen für Körperpsychotherapie. NARM, Somatic Experiencing, Hakomi. Online oder in Berlin. Ohne Wartezeit.",
  alternates: {
    canonical: `${baseUrl}/`,
  },
  openGraph: {
    title: "Körperpsychotherapie – Therapeut:innen finden | Kaufmann Health",
    description: "Finde handverlesene Therapeut:innen für Körperpsychotherapie. Online oder in Berlin. Ohne Wartezeit.",
    url: `${baseUrl}/`,
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: `${baseUrl}/images/session.jpeg`,
        width: 1200,
        height: 630,
        alt: "Kaufmann Health – Körperpsychotherapie",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Körperpsychotherapie – Therapeut:innen finden",
    description: "Finde handverlesene Therapeut:innen für Körperpsychotherapie. Online oder in Berlin. Ohne Wartezeit.",
    images: [`${baseUrl}/images/session.jpeg`],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <PageAnalytics qualifier="Home" />

        {/* Hero with Background Image */}
        <HeroNoForm
          title="Körperpsychotherapie, die wirklich ankommt."
          subtitle="Finde Therapeut:innen, die verstehen, dass Heilung mehr braucht als Worte."
          ctaLabel="Therapeut:in finden"
          ctaHref="/fragebogen"
          backgroundSrc="/images/session.jpeg"
          valueProps={[
            "✓ Handverlesene Therapeut:innen",
            "✓ Ohne Wartezeit",
            "✓ Berlin & Online",
            "✓ 80€–120€ pro Sitzung",
          ]}
        />

        {/* Trust Badges - Compact */}
        <section aria-label="Vertrauen" className="mt-10 sm:mt-14">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm sm:text-base text-gray-600">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Geprüfte Profile
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Termine in 7 Tagen
            </span>
            <span className="inline-flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Persönlich ausgewählt
            </span>
          </div>
        </section>

        {/* Modality Pills */}
        <section aria-labelledby="modalities" className="mt-10 sm:mt-14">
          <h2 id="modalities" className="text-center text-sm sm:text-base font-medium text-gray-600">
            Spezialisiert auf körperorientierte Verfahren
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/60 bg-white px-4 py-2 shadow-sm">
              <div className="rounded-lg bg-gradient-to-br from-teal-50 to-teal-100/60 p-1.5 text-teal-600">
                <HeartHandshake className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-sm font-medium text-gray-700">NARM</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-white px-4 py-2 shadow-sm">
              <div className="rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/60 p-1.5 text-amber-600">
                <Shell className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-sm font-medium text-gray-700">Somatic Experiencing</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-white px-4 py-2 shadow-sm">
              <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-1.5 text-emerald-600">
                <Wind className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-sm font-medium text-gray-700">Hakomi</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/60 bg-white px-4 py-2 shadow-sm">
              <div className="rounded-lg bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 p-1.5 text-fuchsia-600">
                <Target className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-sm font-medium text-gray-700">Core Energetics</span>
            </div>
          </div>
        </section>

        {/* Why Body-Oriented - Brief */}
        <section aria-labelledby="why-body" className="mt-14 sm:mt-20">
          <div className="text-center max-w-3xl mx-auto">
            <h2 id="why-body" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Warum Körperpsychotherapie?
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              Manche Erfahrungen sitzen tiefer als Gedanken. Körperorientierte Verfahren wie NARM, Somatic Experiencing und Hakomi arbeiten mit dem Nervensystem — dort, wo Anspannung, Trauma und alte Muster gespeichert sind.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6 text-center">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-lg font-semibold text-gray-900">Regulierung</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Lerne, dein Nervensystem zu beruhigen — nicht nur zu verstehen, warum es reagiert.
              </p>
            </Card>
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6 text-center">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-lg font-semibold text-gray-900">Verkörperung</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Veränderung, die nicht nur im Kopf stattfindet, sondern im ganzen Körper spürbar wird.
              </p>
            </Card>
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6 text-center">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-lg font-semibold text-gray-900">Nachhaltigkeit</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Tiefgreifende Arbeit, die über kurzfristige Symptomlinderung hinausgeht.
              </p>
            </Card>
          </div>

          {/* Secondary CTA */}
          <div className="mt-10 text-center">
            <CtaLink
              href="/therapie-finden"
              eventType="cta_click"
              eventId="home-why-body-learn-more"
              className="inline-flex items-center gap-2 text-base sm:text-lg font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Mehr erfahren →
            </CtaLink>
          </div>
        </section>

        {/* How It Works */}
        <ProcessTimeline
          variant="minimal"
          heading="So findest du deine Therapeut:in"
          items={[
            { title: "Fragebogen ausfüllen", description: "3 Minuten — damit wir verstehen, was du suchst." },
            { title: "Vorschläge erhalten", description: "Wir zeigen dir 2–3 passende Therapeut:innen." },
            { title: "Kennenlernen buchen", description: "Kostenloses Erstgespräch — du entscheidest." },
          ]}
        />

        {/* Primary CTA */}
        <div className="mt-10 text-center">
          <Button
            size="lg"
            asChild
            className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
          >
            <CtaLink href="/fragebogen" eventType="cta_click" eventId="home-how-it-works-cta">
              Jetzt Therapeut:in finden
            </CtaLink>
          </Button>
        </div>

        {/* Browse Directory CTA */}
        <section aria-labelledby="browse" className="mt-14 sm:mt-20">
          <div className="relative rounded-2xl border border-gray-200/60 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 shadow-md p-8 sm:p-10 text-center">
            <h2 id="browse" className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Oder stöbere direkt im Verzeichnis
            </h2>
            <p className="mt-3 text-base text-gray-600 max-w-xl mx-auto">
              Alle Therapeut:innen in unserem Netzwerk auf einen Blick — mit Profilen, Spezialisierungen und Verfügbarkeit.
            </p>
            <div className="mt-6">
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 px-6 text-base font-semibold border-2 hover:bg-gray-50 transition-all duration-200"
              >
                <CtaLink href="/therapeuten" eventType="cta_click" eventId="home-browse-directory">
                  Alle Therapeut:innen ansehen →
                </CtaLink>
              </Button>
            </div>
          </div>
        </section>

        {/* Therapist Section (Banner) */}
        <section
          aria-labelledby="therapists"
          className="mt-14 sm:mt-20 relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 lg:p-10 shadow-lg shadow-indigo-100/30"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
            <div>
              <h2 id="therapists" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Bewirb dich für unser Therapeuten-Netzwerk
              </h2>
              <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
                Du bist Heilpraktiker:in für Psychotherapie mit Spezialisierung auf körperorientierte Verfahren? Werde Teil unseres kuratierten Netzwerks.
              </p>
            </div>
            <div className="justify-self-start lg:justify-self-end">
              <Button
                size="lg"
                asChild
                className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-700"
              >
                <CtaLink href="/fuer-therapeuten" eventType="cta_click" eventId="home-therapists-cta">
                  Mehr erfahren →
                </CtaLink>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
