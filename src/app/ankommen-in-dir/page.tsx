import type { Metadata } from "next";
import SectionViewTracker from "@/components/SectionViewTracker";
import WhatToExpectSection from "@/components/WhatToExpectSection";
import FaqAccordion from "@/components/FaqAccordion";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import ExitIntentModal from "@/components/ExitIntentModal";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";
import TherapyModalityExplanations from "@/components/TherapyModalityExplanations";
import CheckList from "@/components/CheckList";
import { MessageCircle, UserCheck, PhoneCall, ShieldCheck, Lock } from "lucide-react";
import VariantGate from "@/components/VariantGate";
import { COOKIES_ENABLED } from "@/lib/config";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import { ProcessSteps } from "@/features/landing/components/ProcessSteps";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase() || 'A';
  const isTestVariant = variant === 'B' || variant === 'C';

  return {
    title: "Ankommen in dir – Körperorientierte Therapie online | Kaufmann Health",
    description:
      "Körperorientierte Therapie – handverlesen und online verfügbar, deutschlandweit. Embodiment & Nervensystem‑Regulation.",
    alternates: { canonical: `${baseUrl}/ankommen-in-dir` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: "Ankommen in dir – Körperorientierte Therapie online",
      description: "Handverlesene Empfehlungen für Online-Sitzungen, deutschlandweit.",
      url: `${baseUrl}/ankommen-in-dir`,
      type: "website",
      images: [{ url: `${baseUrl}/images/color-patterns.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Ankommen in dir – Körperorientierte Therapie online",
      description: "Handverlesene Empfehlungen für Online-Sitzungen, deutschlandweit.",
      images: [`${baseUrl}/images/color-patterns.png`],
    },
  };
};

export default async function AnkommenInDirPage() {
  // Curated therapist IDs for trust section (online focus)
  const TRUST_IDS = [
    '7402bb04-c8d8-403e-a8d7-6bc32289c87b',
    '58d98a45-21ab-40ea-99b3-f65ba27f6715',
    'e81b560c-7489-4563-be53-1b6cd858f152',
    '25ae2093-6d85-4d34-84bd-08411f713164',
    '84c187fb-a981-442b-8a42-422093a3196b',
  ];
  const selected = [...TRUST_IDS].sort(() => 0.5 - Math.random()).slice(0, 3);

  const faqs = [
    {
      id: 'online-works',
      question: 'Funktioniert körperorientierte Therapie online?',
      answer: 'Absolut! Wir arbeiten sicher mit Fokus auf Körperwahrnehmung, Regulation und Präsenz – auch online.',
    },
    {
      id: 'coaching',
      question: 'Wie unterscheidet sich das von Coaching/Breathwork?',
      answer: 'Therapie arbeitet tiefer mit Mustern und Bindung. Atem- und Achtsamkeitspraxis fließen unterstützend ein.',
    },
    {
      id: 'frequency',
      question: 'Wie oft soll ich kommen?',
      answer: 'Du kommst ganz nach deinem Wunsch. Empfehlung: 1× pro Woche für 6–10 Sitzungen. Danach Integration im eigenen Rhythmus.',
    },
    {
      id: 'modalities',
      question: 'Kann ich Methoden wählen (Narm/Hakomi/Somatic Experiencing/Core Energetics)?',
      answer: 'Absolut!. Wir empfehlen passend zu deinem Fokus. Du entscheidest, was dich am meisten anspricht.',
    },
    {
      id: 'kk-eintrag',
      question: 'Wird die Therapie bei meiner Krankenkasse dokumentiert?',
      answer: 'Nein. Unsere Therapeut:innen rechnen nicht über die gesetzliche Krankenkasse ab (keine S‑Nummer). Es erfolgt kein Eintrag in deiner Krankenakte und keine ICD‑10‑Diagnose bei der Kasse.',
    },
    {
      id: 'warum-diskret',
      question: 'Warum ist Selbstzahler‑Therapie diskreter?',
      answer: 'Ohne Kassenabrechnung bleibt deine Therapie privat. Das ist besonders relevant für Verbeamtung sowie Lebens‑/Berufsunfähigkeitsversicherung. Viele Menschen in sensiblen Berufen (Pilot:innen, Polizei, Führungskräfte) wählen deshalb bewusst die Selbstzahler‑Option.',
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } as const;

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Kaufmann Health",
    url: `${baseUrl}/ankommen-in-dir`,
    image: `${baseUrl}/images/color-patterns.png`,
    description:
      "Körperorientierte Therapie online – handverlesen. NARM, Somatic Experiencing, Hakomi, Core Energetics.",
    areaServed: {
      "@type": "Country",
      name: "Deutschland",
      address: { "@type": "PostalAddress", addressCountry: "DE" },
    },
    sameAs: ["https://www.kaufmann-health.de"],
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <SectionViewTracker location="hero">
          <LandingHero
            title="Ankommen in dir – Online"
            subtitle={
              <>
                <VariantGate show="C">
                  <span>Körperorientiertes Coaching & Begleitung – handverlesen und online verfügbar. 80–120€ pro Sitzung.</span>
                </VariantGate>
                <VariantGate show="A">
                  <span>Körperorientierte Therapie online – handverlesen. NARM, Somatic Experiencing, Hakomi, Core Energetics. 80–120€ pro Sitzung.</span>
                </VariantGate>
                <VariantGate show="B">
                  <span>Körperorientierte Therapie online – handverlesen. NARM, Somatic Experiencing, Hakomi, Core Energetics. 80–120€ pro Sitzung.</span>
                </VariantGate>
              </>
            }
            showModalityLogos
            defaultSessionPreference="online"
            ctaPill={
              <>
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
              </>
            }
            analyticsQualifier="LP-Ankommen"
          />
        </SectionViewTracker>

        {/* Therapist previews (online focus) */}
        <SectionViewTracker location="therapist-previews">
          <TherapistTeaserSection ids={selected} title="Deine Begleiter:innen" subtitle="Persönlich ausgewählt. Online verfügbar. Durchschnittlich 7+ Jahre Erfahrung." />
        </SectionViewTracker>

        {/* Recognition tailored to wellness seekers */}
        <SectionViewTracker location="recognition">
        <section aria-labelledby="recognition-heading" className="mt-10 sm:mt-14">
          <h2 id="recognition-heading" className="text-2xl font-semibold tracking-tight">Woran du dich wiedererkennst</h2>
          <div className="mt-5">
            <CheckList
              items={[
                "Nervensystem‑Regulation lernen",
                "Embodiment statt nur Gespräch",
                "Therapie für Körper und Seele",
                "Traumasensitive Begleitung (NARM, Somatic Experiencing)",
                "Achtsame Psychotherapie – keine Optimierung",
                "Für Hochsensible geeignet",
              ]}
            />
          </div>
        </section>
        </SectionViewTracker>

        {/* Negative qualifier */}
        <SectionViewTracker location="negative-qualifier">
          <section aria-labelledby="negative-heading" className="mt-10 sm:mt-14 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 sm:p-6">
            <h2 id="negative-heading" className="text-2xl font-semibold tracking-tight">Was wir NICHT anbieten</h2>
            <div className="mt-4">
              <CheckList
                variant="negative"
                items={[
                  "Kassenabrechnung oder Diagnosen",
                  "Schnelle Erfolgs‑Hacks",
                  "Leadership/Performance‑Optimierung",
                ]}
              />
            </div>
          </section>
        </SectionViewTracker>

        {/* EARTH-143: Privacy benefit section */}
        <PrivacySelfPaySection />

        {/* Process flow */}
        <SectionViewTracker location="process">
          <ProcessSteps
            items={[
              { icon: <MessageCircle className="h-5 w-5" />, step: 1, title: "Du schilderst deinen Weg" },
              { icon: <UserCheck className="h-5 w-5" />, step: 2, title: "Wir wählen passend zu deinem Fokus aus" },
              { icon: <PhoneCall className="h-5 w-5" />, step: 3, title: "Direkter Kontakt & erste Online-Session" },
            ]}
          />
        </SectionViewTracker>

        {/* Datenschutz & Vertrauen */}
        <section aria-labelledby="privacy-trust" className="mt-12 sm:mt-16">
          <div className="rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="privacy-trust" className="text-2xl font-semibold">Datenschutz & Vertrauen</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Card className="transition-all duration-200">
                <CardHeader className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-medium">Geprüfte Therapeut:innen</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>Wir verifizieren Qualifikationen und Spezialisierungen manuell.</CardDescription>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200">
                <CardHeader className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Lock className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-medium">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Tracking‑Cookies'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. Verwendung deiner Angaben nur zur Kontaktaufnahme.'} Details in unserer <a className="underline" href="/datenschutz#cookies">Datenschutzerklärung</a>.</CardDescription>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200">
                <CardHeader className="flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-medium">Transparente Prozesse</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>DSGVO‑konforme Verarbeitung. Sichere therapeutische Räume.</CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* What to expect */}
        <WhatToExpectSection />

        {/* Modalities explanation */}
        <section aria-labelledby="modalities-heading" className="mt-10 sm:mt-14">
          <div className="mt-4">
            <TherapyModalityExplanations />
          </div>
        </section>

        {/* Pricing note (no tiers) */}
        <SectionViewTracker location="pricing-note">
          <section id="pricing" className="scroll-mt-24 mt-10 sm:mt-14 rounded-2xl border bg-slate-50/60 p-5 sm:p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Preise</h2>
            <p className="mt-3 max-w-2xl text-gray-700">
              Die Preise legen die Therapeut:innen selbst fest. In der Regel 80–120€ pro 60 Minuten. Du besprichst den genauen Satz direkt mit deiner Therapeut:in.
            </p>
            <ul className="mt-3 list-disc pl-5 text-gray-700 space-y-1">
              <li>Keine Kassenabrechnung, keine Diagnosen</li>
              <li>Direkt starten – keine Warteliste</li>
            </ul>
            <VariantGate show="B">
              <p className="mt-3 text-sm text-gray-600">Antwort in der Regel innerhalb von 24 Stunden.</p>
            </VariantGate>
          </section>
        </SectionViewTracker>

        {/* FAQ */}
        <SectionViewTracker location="faq">
          <section aria-labelledby="faq-heading" id="faq" className="mt-10 sm:mt-14">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">Häufige Fragen</h2>
            <div className="mt-4">
              <FaqAccordion items={faqs} />
            </div>
          </section>
        </SectionViewTracker>

        {/* Final CTA */}
        <SectionViewTracker location="final-cta">
          <section className="mt-12 sm:mt-16 relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Bereit anzukommen?</h2>
            <p className="mt-3 max-w-2xl text-gray-700">Beginne mit einer Empfehlung – handverlesen und online verfügbar.</p>
            <div className="mt-6">
              <Button asChild size="lg" data-cta="final-primary">
                <CtaLink href="#top-form" eventType="cta_click" aria-label="Passende Therapeut:innen finden">
                  Passende Therapeut:innen finden
                </CtaLink>
              </Button>
            </div>
            <VariantGate show="B"><p className="mt-3 text-sm text-gray-600">Noch 3 Therapeut:innen mit freien Terminen diese Woche.</p></VariantGate>
            <p className="mt-4 text-sm text-gray-700">Kostenlos & unverbindlich.</p>
          </section>
        </SectionViewTracker>
      </main>

      {/* JSON-LD Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <FloatingWhatsApp />
      <ExitIntentModal />
    </div>
  );
}
