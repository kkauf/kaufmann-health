import type { Metadata } from "next";
import CtaLink from "@/components/CtaLink";
import CheckList from "@/components/CheckList";
import SectionViewTracker from "@/components/SectionViewTracker";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import WhatToExpectSection from "@/components/WhatToExpectSection";
import RevealContainer from "@/components/RevealContainer";
import FaqAccordion from "@/components/FaqAccordion";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import ExitIntentModal from "@/components/ExitIntentModal";
import { Activity, Euro, Clock, UserCheck, MessageCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import VariantGate from "@/components/VariantGate";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import { ProcessSteps } from "@/features/landing/components/ProcessSteps";
import { LandingHero } from "@/features/landing/components/LandingHero";

export const revalidate = 3600;


const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase() || 'A';
  const isTestVariant = variant === 'B' || variant === 'C';

  return {
    title: "Körpertherapie Berlin | Wenn Erfolg nicht reicht | Kaufmann Health",
    description:
      "Erfolgreich aber leer? Körperorientierte Therapie für Menschen, die mehr wollen als nur funktionieren. Keine Kasse, keine Optimierung – echte Tiefe.",
    alternates: {
      canonical: `${baseUrl}/wieder-lebendig`,
    },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: "Du hast alles erreicht. Warum fühlt es sich so leer an?",
      description:
        "Körperorientierte Therapie für Menschen, die wieder lebendig sein wollen.",
      url: `${baseUrl}/wieder-lebendig`,
      type: "website",
      images: [
        {
          url: `${baseUrl}/images/color-patterns.png`,
          width: 1200,
          height: 630,
          alt: "Kaufmann Health – Körpertherapie Berlin",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Du hast alles erreicht. Warum fühlt es sich so leer an?",
      description: "Körperorientierte Therapie für Menschen, die wieder lebendig sein wollen.",
      images: [`${baseUrl}/images/color-patterns.png`],
    },
  };
};

export default async function WiederLebendigPage() {
  // Fetch real therapists for trust section (random 3 from provided 5 ids)
  const TRUST_IDS = [
    '7402bb04-c8d8-403e-a8d7-6bc32289c87b',
    '58d98a45-21ab-40ea-99b3-f65ba27f6715',
    'e81b560c-7489-4563-be53-1b6cd858f152',
    '25ae2093-6d85-4d34-84bd-08411f713164',
    '84c187fb-a981-442b-8a42-422093a3196b',
  ];
  const selected = [...TRUST_IDS].sort(() => 0.5 - Math.random()).slice(0, 3);
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Kaufmann Health",
    url: `${baseUrl}/wieder-lebendig`,
    image: `${baseUrl}/images/color-patterns.png`,
    description:
      "Körperorientierte Therapie für Menschen, die wieder lebendig sein wollen – nicht noch erfolgreicher.",
    areaServed: {
      "@type": "City",
      name: "Berlin",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Berlin",
        addressCountry: "DE",
      },
    },
    sameAs: ["https://www.kaufmann-health.de"],
  } as const;

  const faqs: { id: string; question: string; answer: string }[] = [
    {
      id: "differs",
      question: "Wie unterscheidet sich das von normaler Psychotherapie?",
      answer:
        "Wir arbeiten körperorientiert und ganzheitlich. Statt nur zu reden, beziehen wir deinen Körper als Wegweiser ein. Keine Diagnosen, keine Pathologisierung – nur du und dein Weg zurück zu dir selbst.",
    },
    {
      id: "unzufrieden",
      question: "Ist das was für mich, wenn ich 'nur' unzufrieden bin?",
      answer:
        "Gerade dann. Du musst nicht krank sein, um dir Unterstützung zu holen. Innere Leere trotz äußerem Erfolg ist ein wichtiges Signal – und genau darauf sind wir spezialisiert.",
    },
    {
      id: "sessions",
      question: "Wie viele Sitzungen brauche ich?",
      answer:
        "Das ist sehr individuell. Die meisten unserer Klient:innen kommen für 10 oder 20 Sitzungen, viele verwenden die Begleitung danach ad-hoc, wenn sie sie brauchen. Es geht nicht um schnelle Lösungen, sondern nachhaltige Veränderung. Du bestimmst Tempo und Tiefe.",
    },
    {
      id: "kassenabrechnung",
      question: "Warum keine Kassenabrechnung?",
      answer:
        "Bewusste Entscheidung. Keine Diagnosen in deiner Akte, keine Anträge, keine Rechtfertigung. Volle Diskretion und Freiheit in der Gestaltung deiner Therapie.",
    },
    {
      id: "kk-eintrag",
      question: "Wird die Therapie bei meiner Krankenkasse dokumentiert?",
      answer:
        "Nein. Unsere Therapeut:innen rechnen nicht über die gesetzliche Krankenkasse ab (keine S‑Nummer). Es erfolgt kein Eintrag in deiner Krankenakte und keine ICD‑10‑Diagnose bei der Kasse.",
    },
    {
      id: "warum-diskret",
      question: "Warum ist Selbstzahler‑Therapie diskreter?",
      answer:
        "Ohne Kassenabrechnung bleibt deine Therapie privat. Das ist besonders relevant bei Verbeamtung sowie Anträgen für Lebens‑ und Berufsunfähigkeits­versicherung. Viele Menschen in sensiblen Berufen (Pilot:innen, Polizei, Führungskräfte) wählen deshalb bewusst die Selbstzahler‑Option.",
    },
    {
      id: "termin",
      question: "Wie schnell bekomme ich einen Termin?",
      answer:
        "In der Regel innerhalb einer Woche. Wir melden uns innerhalb von 24 Stunden mit passenden Therapeut:innen und deren Kontaktdaten.",
    },
    {
      id: "kontakt-mehrere",
      question: "Kann ich selbst verschiedene Therapeut:innen kontaktieren?",
      answer:
        "Ja. Du entscheidest eigenverantwortlich, mit wem du sprechen möchtest. Wir stellen dir eine handverlesene Auswahl und die Kontaktdaten bereit.",
    },
    {
      id: "not-for-me",
      question: "Was ist, wenn ich merke, dass es doch nichts für mich ist?",
      answer:
        "Das Erstgespräch ist kostenlos und unverbindlich. Danach kannst du jederzeit pausieren oder aufhören. Keine Mindestlaufzeit, keine Verpflichtungen.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        {/* Hero Section with A/B and embedded form */}
        <LandingHero
          title="Wieder spüren statt nur schaffen."
          subtitle={
            <>
              <VariantGate show="C">
                <span>Körperorientiertes Coaching & Begleitung – 80–120€ pro Sitzung. Diese Woche noch verfügbar.</span>
              </VariantGate>
              <VariantGate show="A">
                <span>Körperorientierte Therapie mit handverlesenen Therapeut:innen – diese Woche noch verfügbar</span>
              </VariantGate>
              <VariantGate show="B">
                <span>Körperorientierte Therapie mit handverlesenen Therapeut:innen – diese Woche noch verfügbar</span>
              </VariantGate>
            </>
          }
          showModalityLogos
          badge={
            <>
              5 Therapeut:innen haben diese Woche Zeit für dich
            </>
          }
          ctaPill={
            <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
              <CtaLink href="#pricing" eventType="cta_click" aria-label="Preise anzeigen">
                80-120€ pro Sitzung
              </CtaLink>
            </Button>
          }
          assignVariantParam
        />

        {/* Trust section: real therapist previews */}
        <TherapistTeaserSection ids={selected} title="Deine Expert:innen" subtitle="Durchschnittlich 7+ Jahre Erfahrung" />

        {/* Credibility metrics (data-driven proof points) */}
        <section aria-labelledby="metrics-heading" className="mt-10 sm:mt-14">
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
            <h2 id="metrics-heading" className="text-2xl font-semibold">Erkennst du dich wieder?</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card className="transition-all duration-200">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">80%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">der Klient:innen berichten von Verbesserungen nach nur 6 Sitzungen</p>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-xl bg-sky-50 p-2 text-sky-600">
                    <Euro className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-3xl bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">€80–120</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">pro Sitzung bei Selbstzahlern</p>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-3xl bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">Schnell</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">Meist Termine innerhalb einer Woche</p>
                </CardContent>
              </Card>
            </div>
            <VariantGate show="B">
              <p className="mt-4 text-xs text-emerald-700">🟢 2 Plätze heute bereits vergeben</p>
            </VariantGate>
          </div>
        </section>

        {/* Self-Recognition / Pain Points */}
        <section
          aria-labelledby="recognition-heading"
          className="mt-10 sm:mt-14"
        >
          <h2 id="recognition-heading" className="text-2xl font-semibold tracking-tight">Woran du dich wiedererkennst</h2>
          <div className="mt-5">
            <CheckList
              items={[
                "Beruflich erfolgreich, innerlich taub",
                "Die nächste Beförderung interessiert dich nicht mehr",
                "Du funktionierst perfekt, aber spürst dich kaum",
                "Nachts fragst du dich: \"War das alles?\"",
                "Dein Körper sendet Signale: Verspannung, Erschöpfung, Leere",
                "Beziehungen fühlen sich oberflächlich an",
                "Du sehnst dich nach Echtheit, weißt aber nicht wo anfangen",
              ]}
            />
          </div>
        </section>

        {/* Negative Qualifier */}
        <SectionViewTracker location="negative-qualifier">
          <section
            aria-labelledby="negative-heading"
            className="mt-10 sm:mt-14 rounded-2xl border border-rose-100 bg-rose-50/60 p-5 sm:p-6"
          >
            <h2 id="negative-heading" className="text-2xl font-semibold tracking-tight">
              Was wir NICHT anbieten
            </h2>
            <div className="mt-4">
              <CheckList
                variant="negative"
                items={[
                  "Performance-Optimierung für noch mehr Erfolg",
                  "Schnelle Erfolgs-Hacks oder 5-Schritte-Pläne",
                  "Executive Coaching oder Leadership Training",
                  "Kassenabrechnung oder Diagnosen für Krankschreibungen",
                  "Noch eine Methode zum \"besser funktionieren\"",
                  "Therapie \"nebenbei\" zwischen Meetings",
                ]}
              />
            </div>
          </section>
        </SectionViewTracker>

        {/* EARTH-143: Privacy benefit section */}
        <PrivacySelfPaySection />

        {/* What to Expect */}
        <WhatToExpectSection />

        {/* Process flow */}
        <ProcessSteps
          items={[
            { icon: <MessageCircle className="h-5 w-5" />, step: 1, title: "Du schilderst uns deine Situation", description: "Schreib uns kurz, worum es geht und was dir wichtig ist." },
            { icon: <UserCheck className="h-5 w-5" />, step: 2, title: "Wir wählen passende Therapeut:innen aus", description: "Aus unserer handverlesenen Liste – passend zu deinem Anliegen und deiner Stadt." },
            { icon: <PhoneCall className="h-5 w-5" />, step: 3, title: "Direkter Kontakt", description: "Du erhältst direkte Kontaktdaten und kannst sofort einen Termin vereinbaren." },
          ]}
        />

        {/* Investment & Pricing */}
        <SectionViewTracker location="pricing">
          <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-24 mt-10 sm:mt-14">
            <h2 id="pricing-heading" className="text-2xl font-semibold tracking-tight">
              Deine Investition in Lebendigkeit
            </h2>
            <p className="mt-3 max-w-2xl text-gray-700">
              Therapie bei uns ist eine bewusste Entscheidung. Keine Kassenleistung, keine Diagnosen – dafür volle
              Diskretion und echte Veränderung.
            </p>

            <RevealContainer>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Single session */}
                <Card
                  data-reveal
                  className="opacity-0 translate-y-2 transition-all duration-500 hover:shadow-md"
                  style={{ transitionDelay: '0ms' }}
                >
                  <CardHeader>
                    <CardTitle>Einzelsitzung</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">120€</div>
                    <div className="text-sm text-gray-600">pro Sitzung (60 Minuten)</div>
                    <VariantGate show="B"><div className="mt-1 text-xs text-emerald-700">Noch 2 Plätze verfügbar</div></VariantGate>
                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                      <li>Flexibel buchbar</li>
                      <li>Ideal zum Kennenlernen</li>
                    </ul>
                    <div className="mt-5">
                      <Button asChild size="lg" data-cta="pricing-single">
                        <CtaLink href="#top-form" eventType="cta_click">
                          Passende Therapeut:innen finden
                        </CtaLink>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 10 sessions - highlighted */}
                <Card
                  data-reveal
                  className="opacity-0 translate-y-2 transition-all duration-500 hover:shadow-md border-emerald-200"
                  style={{ transitionDelay: '60ms' }}
                >
                  <CardHeader>
                    <div className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Beliebt
                      </span>
                      <CardTitle>Paket „Zurück ins Spüren“</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">1.000€</div>
                    <div className="text-sm text-gray-600">10 Sitzungen</div>
                    <VariantGate show="B"><div className="mt-1 text-xs text-emerald-700">Noch 1 Platz verfügbar</div></VariantGate>
                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                      <li>200€ Ersparnis</li>
                      <li>Für nachhaltige Veränderung</li>
                    </ul>
                    <div className="mt-5">
                      <Button asChild size="lg" data-cta="pricing-10">
                        <CtaLink href="#top-form" eventType="cta_click">
                          Passende Therapeut:innen finden
                        </CtaLink>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 20 sessions */}
                <Card
                  data-reveal
                  className="opacity-0 translate-y-2 transition-all duration-500 hover:shadow-md"
                  style={{ transitionDelay: '120ms' }}
                >
                  <CardHeader>
                    <CardTitle>Intensivbegleitung</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">1.800€</div>
                    <div className="text-sm text-gray-600">20 Sitzungen</div>
                    <div className="mt-1 text-xs text-emerald-700">Noch 1 Platz verfügbar</div>
                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                      <li>600€ Ersparnis</li>
                      <li>Tiefgreifende Transformation</li>
                    </ul>
                    <div className="mt-5">
                      <Button asChild size="lg" data-cta="pricing-20">
                        <CtaLink href="#top-form" eventType="cta_click">
                          Passende Therapeut:innen finden
                        </CtaLink>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </RevealContainer>

            <p className="mt-4 text-sm text-gray-600">
              Alle Preise inkl. MwSt. | Termine flexibel vereinbar | Absagen bis 24h vorher kostenfrei
            </p>
          </section>
        </SectionViewTracker>

        {/* FAQ */}
        <SectionViewTracker location="faq">
          <section aria-labelledby="faq-heading" className="mt-10 sm:mt-14">
            <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
              Häufige Fragen
            </h2>
            <div className="mt-4">
              <FaqAccordion items={faqs} />
            </div>
          </section>
        </SectionViewTracker>

        {/* Final CTA */}
        <SectionViewTracker location="final-cta">
          <section
            aria-labelledby="final-cta-heading"
            className="mt-12 sm:mt-16 relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
          >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
            <h2 id="final-cta-heading" className="text-2xl font-semibold tracking-tight">Der erste Schritt zurück zu dir</h2>
            <p className="mt-3 max-w-2xl text-gray-700">Du hast bis hier gelesen. Das ist kein Zufall. Dein System sucht nach Veränderung.</p>
            <div className="mt-3 rounded-lg border bg-white/60 p-4 text-sm text-slate-700">
              „Nach drei Wochen habe ich mich zum ersten Mal seit Jahren wieder wirklich gespürt. Nicht schneller, sondern echter.“
            </div>

            <div className="mt-6">
              <Button asChild size="lg" data-cta="final-primary">
                <CtaLink href="#top-form" eventType="cta_click" aria-label="Passende Therapeut:innen finden">
                  Passende Therapeut:innen finden
                </CtaLink>
              </Button>
              <VariantGate show="B"><p className="mt-3 text-sm text-gray-600">Noch 3 Therapeut:innen mit freien Terminen diese Woche.</p></VariantGate>
            </div>

            <p className="mt-4 text-sm text-gray-700">Kostenlos &amp; unverbindlich. Antwort innerhalb von 24 Stunden.</p>
          </section>
        </SectionViewTracker>
      </main>

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FloatingWhatsApp />
      <ExitIntentModal />
    </div>
  );
}
