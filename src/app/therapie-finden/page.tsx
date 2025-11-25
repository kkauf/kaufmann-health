import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';
import {
  LandingHero,
  HeroNoForm,
  RecognitionSection,
  MethodComparison,
  TherapistTeaserSection,
  InvestmentSection,
  ProcessTimeline,
  FinalCtaSection,
} from '@/features/landing/components';
import { buildLandingMetadata, buildLocalBusinessJsonLd, buildFaqJsonLd } from '@/lib/seo';
import { Lock, MessageCircle, UserCheck, FileCheck, Shield, Clock, CalendarCheck, TrendingUp, Euro } from 'lucide-react';
import WhyBodyTherapySection from '@/components/WhyBodyTherapySection';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const params = await searchParams;
  const title = 'Therapeut:innen finden – Heilpraktiker:in für Psychotherapie | Kaufmann Health';
  const description = 'Therapeuten finden in 24 Stunden. Persönlich ausgewählt für dich. Online-Psychotherapie oder vor Ort in Berlin. Ohne Wartezeit.';
  const v = (params?.v as string) || undefined;
  return buildLandingMetadata({
    baseUrl: baseUrl,
    path: '/therapie-finden',
    title,
    description,
    searchParams: { v },
  });
}

export default async function TherapieFindenPage() {
  // FAQs (low on page; non-blocking for conversion)
  const faqs = [
    { id: 'prices', question: 'Was kosten die Sitzungen?', answer: 'In der Regel 80–120€ pro 60 Minuten. Den genauen Satz sprichst du direkt mit deiner Therapeut:in ab.' },
    { id: 'speed', question: 'Wie schnell bekomme ich Vorschläge?', answer: 'Du erhältst sofort passende Therapeut:innen-Vorschläge basierend auf deinen Angaben. Termine sind in der Regel noch diese Woche möglich.' },
    { id: 'privacy', question: 'Wird die Psychotherapie bei meiner Krankenkasse dokumentiert?', answer: 'Nein. Es erfolgt keine Kassenabrechnung, kein Eintrag in deiner Krankenakte und keine ICD‑10‑Diagnose bei der Kasse.' },
    { id: 'methods', question: 'Mit welchen Methoden wird gearbeitet?', answer: 'Körperorientierte Verfahren wie NARM, Somatic Experiencing, Hakomi und Core Energetics – passend zu deinem Anliegen.' },
  ];

  const faqSchema = buildFaqJsonLd(faqs.map(({ question, answer }) => ({ question, answer })));
  const businessSchema = buildLocalBusinessJsonLd({ baseUrl, path: '/therapie-finden', areaServed: { type: 'Country', name: 'Deutschland', addressCountry: 'DE' } });

  // Curated therapist IDs (limit display to these)
  const TRUST_IDS = [
    '7402bb04-c8d8-403e-a8d7-6bc32289c87b',
    '58d98a45-21ab-40ea-99b3-f65ba27f6715',
    'e81b560c-7489-4563-be53-1b6cd858f152',
    '25ae2093-6d85-4d34-84bd-08411f713164',
    '84c187fb-a981-442b-8a42-422093a3196b',
  ];
  // Use deterministic selection to avoid hydration mismatch
  const selected = TRUST_IDS.slice(0, 3);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <HeroNoForm
        title="Traumata lösen sich nicht von Reden allein."
        subtitle="Finde schnell und unkompliziert die passende körperorientierte Psychotherapie für dich."
        ctaLabel="Jetzt Therapeut:in finden"
        ctaHref="/fragebogen?variant=concierge"
        backgroundSrc="/images/hero.jpg"
      />

      {/* Recognition Hook */}
      <RecognitionSection
        heading="Kommt dir das bekannt vor?"
        items={[
          'Du hast in der Therapie viel verstanden, aber die Muster wiederholen sich',
          'Der Kopf weiß, was zu tun ist – der Körper macht nicht mit',
          'Nach 25 Sitzungen Verhaltenstherapie fehlt noch etwas',
          'Du spürst: Es braucht einen anderen Ansatz',
        ]}
      />
      <p className="mt-4 sm:mt-5 text-gray-700">
        <strong>Du bist nicht „schwierig“ oder „therapieresistent“.</strong> Körperorientierte Ansätze erreichen, was reine Gesprächstherapie nicht kann: dein Nervensystem und die im Körper gespeicherten Erfahrungen.
      </p>

      {/* Method Bridge - Redesigned */}
      <h2 className="mt-14 sm:mt-20 text-2xl font-semibold tracking-tight text-center mb-8">Was deine bisherige Therapie nicht erreichen konnte</h2>
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-slate-400" />
            Gesprächstherapie
          </h3>
          <ul className="space-y-3 text-slate-600">
            <li className="flex gap-3">
              <span className="text-slate-400">•</span>
              <span>Versteht und analysiert Probleme</span>
            </li>
            <li className="flex gap-3">
              <span className="text-slate-400">•</span>
              <span>Arbeitet vorwiegend mit dem Verstand</span>
            </li>
            <li className="flex gap-3">
              <span className="text-slate-400">•</span>
              <span>Schafft kognitive Einsichten</span>
            </li>
          </ul>
        </div>
        <div className="bg-indigo-50 rounded-2xl p-6 sm:p-8 border border-indigo-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-100 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
          <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2 relative z-10">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            Körperorientierte Verfahren
          </h3>
          <ul className="space-y-3 text-indigo-800 relative z-10">
            <li className="flex gap-3">
              <span className="text-indigo-400 font-bold">✓</span>
              <span>Integriert und verkörpert das Neue</span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-bold">✓</span>
              <span>Erreicht das Nervensystem direkt</span>
            </li>
            <li className="flex gap-3">
              <span className="text-indigo-400 font-bold">✓</span>
              <span>Spürbare, nachhaltige Veränderung</span>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-6 text-center text-gray-500 text-sm">Auf Basis neuester Erkenntnisse der Traumaforschung und Neurobiologie.</p>

      {/* Video Section - COMMENTED OUT FOR NOW
      <section className="mt-14 sm:mt-20 rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-12 shadow-lg shadow-indigo-100/30 relative overflow-hidden">
        ...video content...
      </section>
      */}

      {/* Why Body-Oriented Therapy - Interactive */}
      <WhyBodyTherapySection />

      {/* Process with guarantee - Modern Timeline */}
      <ProcessTimeline
        tagline="Sofort passende Therapeut:innen-Vorschläge basierend auf deinen Angaben. Deine Daten bleiben privat."
        items={[
          {
            icon: <MessageCircle className="h-5 w-5" />,
            title: 'Deine Präferenzen',
            caption: '3 Minuten',
            bullets: ['Du sagst uns, was dir wichtig ist'],
          },
          {
            icon: <UserCheck className="h-5 w-5" />,
            title: 'Passende Ergebnisse',
            caption: 'Sofort',
            bullets: ['Bis zu 3 passende Profile aus unserem geprüften Netzwerk'],
          },
          {
            icon: <CalendarCheck className="h-5 w-5" />,
            title: 'Termin buchen & Starten',
            caption: 'Direkt online',
            bullets: ['Buche deinen ersten Termin direkt online. Keine Überweisung nötig. Start als Selbstzahler.'],
          },
        ]}
      />
      <p className="mt-6 sm:mt-7 text-sm sm:text-base text-gray-700 leading-relaxed flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <span className="inline-flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600" />
          <span>DSGVO-konform</span>
        </span>
        <span className="text-gray-400">•</span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-600" />
          <span>SSL-verschlüsselt</span>
        </span>
        <span className="text-gray-400">•</span>
        <span className="inline-flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-emerald-600" />
          <span>Psychotherapie ohne Krankenkassen-Eintrag</span>
        </span>
      </p>

      {/* Hard Facts / Stats */}
      <section className="mt-10 sm:mt-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Stat 1: Effectiveness */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-indigo-600">80%</div>
            </div>
            <p className="text-sm text-gray-600">
              der Klient:innen berichten von Verbesserungen nach fünf Sitzungen
            </p>
          </div>

          {/* Stat 2: Pricing */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
                <Euro className="h-6 w-6 text-cyan-600" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-cyan-600">€80-120</div>
            </div>
            <p className="text-sm text-gray-600">
              pro Sitzung bei Selbstzahlung
            </p>
          </div>

          {/* Stat 3: Speed */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Clock className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600">7 Tage</div>
            </div>
            <p className="text-sm text-gray-600">
              durchschnittliche Zeit bis zum Ersttermin
            </p>
          </div>
        </div>
      </section>

      {/* Therapist Network */}
      <section className="mt-10 sm:mt-14">
        <TherapistTeaserSection
          title="Unser Therapeuten-Netzwerk"
          subtitle="Persönlich ausgewählte Spezialist:innen"
          limit={3}
        />
        <div className="mt-8 sm:mt-10 text-center">
          <CtaLink
            href="/therapeuten"
            eventType="cta_click"
            eventId="therapie-finden-therapist-teaser-view-all"
            data-cta="view-all-therapists"
            className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-teal-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-teal-700 shadow-md hover:bg-teal-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Alle Therapeut:innen ansehen
            <span className="text-xl">→</span>
          </CtaLink>
        </div>
      </section>

      {/* Final CTA - before FAQ */}
      <FinalCtaSection
        heading="Bereit für den ersten Schritt?"
        subtitle="Fülle unseren 3-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte Therapeuten-Vorschläge."
        buttonLabel="Jetzt Therapeut:in finden"
        targetId="/fragebogen?variant=concierge"
        targetBasePath="/fragebogen?variant=concierge"
        align="center"
        variant="tinted"
        showAvailabilityNote={false}
        withEntryOptions={true}
      />

      {/* FAQ (low on page) */}
      <section aria-labelledby="faq-heading" id="faq" className="mt-10 sm:mt-14">
        <h2 id="faq-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqAccordion items={faqs} />
        </div>
      </section>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </main>
  );
}
