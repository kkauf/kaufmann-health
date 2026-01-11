import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import TherapyModalityExplanations from "@/components/TherapyModalityExplanations";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { HeroNoForm } from "@/features/landing/components/HeroNoForm";
import { Brain, Heart, Users, CheckCircle2, Shield, HeartHandshake, Shell, Wind, Target } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";
import CtaLink from "@/components/CtaLink";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata: Metadata = {
  title: "Körperorientierte Psychotherapie (somatische Therapie) Berlin | NARM, SE, Hakomi",
  description: "Körperorientierte Psychotherapie (somatische Therapie) in Berlin & online: NARM, Somatic Experiencing, Hakomi, Core Energetics. Wissenschaftlich fundiert für Trauma, Stress & emotionale Blockaden.",
  alternates: { canonical: `${baseUrl}/therapie` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Körperorientierte Psychotherapie (somatische Therapie) Berlin | NARM, SE, Hakomi",
    description: "Körperorientierte Psychotherapie (somatische Therapie) in Berlin & online: NARM, Somatic Experiencing, Hakomi, Core Energetics. Wissenschaftlich fundiert.",
    url: `${baseUrl}/therapie`,
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
    images: [
      { url: `${baseUrl}/images/hero.jpg`, width: 1200, height: 630, alt: "Kaufmann Health – Körperorientierte Psychotherapie" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Körperorientierte Psychotherapie (somatische Therapie) Berlin | NARM, SE, Hakomi",
    description: "Körperorientierte Psychotherapie (somatische Therapie) in Berlin & online: NARM, Somatic Experiencing, Hakomi, Core Energetics. Wissenschaftlich fundiert.",
    images: [`${baseUrl}/images/hero.jpg`],
  },
};

// Hero is now provided by HeroNoForm with blurred background and modality logos

function WhatIsBodyTherapy() {
  return (
    <section aria-labelledby="what-heading" className="mt-14 sm:mt-20 lg:mt-24">
      <RevealContainer>
        <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
          
          <h2 id="what-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Was ist körperorientierte Psychotherapie?
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
            Körperorientierte Psychotherapie (auch <strong>somatische Therapie</strong> genannt) arbeitet mit dem, was im Körper spürbar ist: 
            Atmung, Haltung, Anspannung, innere Empfindungen. Statt nur über Probleme zu sprechen, wird Veränderung 
            <strong> direkt im Nervensystem erlebt und verankert</strong>.
          </p>
          
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: '0ms' }}>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm w-fit">
                <Heart className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg sm:text-xl font-semibold text-gray-900">Direkt & wirksam</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Veränderung wird im Körper erlebt und im Nervensystem verankert.
              </p>
            </Card>
            
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: '60ms' }}>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
                <Brain className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg sm:text-xl font-semibold text-gray-900">Sanft & sicher</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Behutsames Arbeiten in kleinen Schritten. Sicheres Begleiten natürlicher Prozesse.
              </p>
            </Card>
            
            <Card className="relative bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: '120ms' }}>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3 text-sky-600 shadow-sm w-fit">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg sm:text-xl font-semibold text-gray-900">Wissenschaftlich fundiert</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Evidenzbasierte Methoden. In RCT-Studien untersucht. Keine Esoterik.
              </p>
            </Card>
          </div>

          {/* CTA after explanation */}
          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <CtaLink
              href="/therapeuten"
              eventType="cta_click"
              eventId="therapie-what-is-cta"
              data-cta="what-is-section"
              className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-teal-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-teal-700 shadow-md hover:bg-teal-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
            >
              Therapeut:innen ansehen
            </CtaLink>
            <p className="text-sm sm:text-base text-gray-600">
              Finde passende Spezialist:innen für körperorientierte Therapie.
            </p>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

function ForWhom() {
  const situations = [
    "Trauma und belastende Erfahrungen",
    "Chronischer Stress und innere Anspannung",
    "Emotionale Blockaden und Taubheit",
    "Wenn Gesprächstherapie allein nicht ausreicht",
  ];

  return (
    <section aria-labelledby="forwho-heading" className="mt-14 sm:mt-20 lg:mt-24">
      <RevealContainer>
        <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 id="forwho-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Für wen ist körperorientierte Psychotherapie geeignet?</h2>
              <p className="mt-2 text-base sm:text-lg leading-relaxed text-gray-600">Besonders hilfreich bei:</p>
            </div>
          </div>
          
          <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2">
            {situations.map((sit, i) => (
              <div key={i} className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 sm:p-4 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: `${i * 40}ms` }}>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 font-medium leading-relaxed">{sit}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6">
            <p className="text-sm sm:text-base leading-relaxed text-gray-700">
              <strong>Wichtig:</strong> Körperorientierte Therapie ersetzt keine medizinische oder psychiatrische Behandlung bei akuten Krisen. 
              Sie ergänzt diese jedoch ideal.
            </p>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

export default async function KoerpertherapiePage() {
  const faqs = [
    { 
      id: "unterschied", 
      question: "Was ist der Unterschied zur Gesprächstherapie?", 
      answer: "Gespräche helfen zu verstehen und einzuordnen. Körperorientierte Psychotherapie ergänzt dies um das direkte Spüren und Regulieren im Körper. So wird Veränderung nicht nur gedacht, sondern im Nervensystem erlebt und verankert. Beide Ansätze können sich hervorragend ergänzen." 
    },
    { 
      id: "kosten", 
      question: "Was kostet eine Sitzung?", 
      answer: "In der Regel 80–120€ pro 50–60 Minuten, je nach Therapeut:in. Selbstzahlung bedeutet: keine Wartezeit, volle Flexibilität, und deine Daten bleiben privat." 
    },
    { 
      id: "anzahl", 
      question: "Wie viele Sitzungen brauche ich?", 
      answer: "Sehr individuell. Viele Menschen spüren erste Veränderungen nach 6–10 Sitzungen. Bei komplexen Themen entsprechend länger. Das Tempo und die Tiefe bestimmst du – es gibt keine Verpflichtung zu einem bestimmten Umfang." 
    },
    { 
      id: "termine", 
      question: "Wie schnell bekomme ich Termine?", 
      answer: "Du erhältst handverlesene Vorschläge meist innerhalb weniger Stunden – Termine sind in der Regel noch diese Woche möglich." 
    },
    { 
      id: "kasse", 
      question: "Übernimmt die Krankenkasse die Kosten?", 
      answer: "In der Regel nein. Die meisten körpertherapeutischen Verfahren werden nicht von gesetzlichen Krankenkassen übernommen. Wir arbeiten bewusst ohne Krankenkasse: keine Diagnosen in Ihrer Akte, hohe Vertraulichkeit und flexible Termine." 
    },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Körperorientierte Psychotherapie (somatische Therapie)",
    url: `${baseUrl}/therapie`,
    description: "Körperorientierte Psychotherapie (somatische Therapie) mit Methoden wie NARM, Somatic Experiencing, Hakomi und Core Energetics zur Behandlung von Trauma, Stress und emotionalen Blockaden. Wissenschaftlich fundiert und ohne Esoterik.",
    sameAs: [
      "https://de.wikipedia.org/wiki/K%C3%B6rperpsychotherapie",
      "https://traumahealing.org/se-research-and-articles/"
    ],
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        
        <HeroNoForm
          title="Körperorientierte Psychotherapie"
          subtitle="Körperorientierte Psychotherapie (auch somatische Therapie genannt) arbeitet dort, wo Trauma und Stress im Nervensystem gespeichert sind – wissenschaftlich fundiert, professionell und ohne Esoterik."
          backgroundSrc="/images/hero-calm.jpeg"
          ctaLabel="Therapeut:in finden"
          ctaHref="/therapeuten"
          valueProps={[
            '✓ Handverlesene Therapeut:innen',
            '✓ NARM, SE, Hakomi & Core Energetics',
            '✓ Berlin & Online · 80€–120€',
          ]}
          icon={
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/60 p-3 sm:p-4 text-teal-600 shadow-sm">
                <HeartHandshake className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/60 p-3 sm:p-4 text-amber-600 shadow-sm">
                <Shell className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 sm:p-4 text-emerald-600 shadow-sm">
                <Wind className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 p-3 sm:p-4 text-fuchsia-600 shadow-sm">
                <Target className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
              </div>
            </div>
          }
        />

        <WhatIsBodyTherapy />

        {/* Modality explanations */}
        <TherapyModalityExplanations />

        {/* Mid-page CTA */}
        <div className="mt-10 sm:mt-12 text-center">
          <CtaLink
            href="/therapeuten"
            eventType="cta_click"
            eventId="therapie-mid-page-cta"
            data-cta="after-modalities"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
          >
            Jetzt passende Therapeut:in finden
          </CtaLink>
        </div>

        {/* Therapist showcase - SEO + trust */}
        <section className="mt-14 sm:mt-20 lg:mt-24">
          <TherapistTeaserSection
            title="Unsere Therapeut:innen für körperorientierte Therapie"
            subtitle="Spezialist:innen für NARM, Somatic Experiencing, Hakomi & Core Energetics"
            limit={3}
            showViewAllButton={true}
            viewAllButtonText="Alle Therapeut:innen ansehen"
            viewAllButtonHref="/therapeuten"
          />
        </section>

        {/* For whom section */}
        <ForWhom />

        {/* CTA - moved before FAQ */}
        <div className="mt-14 sm:mt-20 lg:mt-24">
          <FinalCtaSection 
            heading="Bereit für den ersten Schritt?" 
            subtitle="Entdecke unsere handverlesenen Therapeut:innen für körperorientierte Psychotherapie. Online oder vor Ort in Berlin."
            buttonLabel="Alle Therapeut:innen ansehen"
            targetId="/therapeuten"
            align="center"
            variant="tinted"
            showAvailabilityNote={false}
            withEntryOptions={false}
          />
        </div>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <RevealContainer>
            <div className="opacity-0 translate-y-2 transition-all duration-500" data-reveal>
              <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
              <div className="mt-6 sm:mt-8">
                <FaqAccordion items={faqs} />
              </div>
            </div>
          </RevealContainer>
        </section>
      </main>

      {/* JSON-LD Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(therapySchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
        }) }}
      />
    </div>
  );
}
