import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import CtaLink from '@/components/CtaLink';
import {
  HeroNoForm,
  TherapistTeaserSection,
  ProcessTimeline,
  FinalCtaSection,
} from '@/features/landing/components';
import { buildLandingMetadata, buildLocalBusinessJsonLd, buildFaqJsonLd } from '@/lib/seo';
import { Lock, MessageCircle, UserCheck, FileCheck, Shield, Clock, CalendarCheck, TrendingUp, Euro, Brain, Activity, Heart, Sparkles } from 'lucide-react';
import RecognitionChips from './RecognitionChips';

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


  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <HeroNoForm
        title="Traumata lösen sich nicht von Reden allein."
        subtitle="Dein Körper erinnert sich — auch wenn dein Kopf längst verstanden hat. Körperpsychotherapie setzt dort an, wo Gespräche nicht hinkommen."
        ctaLabel="Therapeut:in finden"
        ctaHref="/fragebogen?variant=concierge"
        backgroundSrc="/images/hero-calm3.jpeg"
        valueProps={[
          '✓ Handverlesene Therapeut:innen',
          '✓ Termine innerhalb von 7 Tagen',
          '✓ Körperpsychotherapie',
          '✓ Selbstzahler · €80–120 pro Sitzung',
        ]}
      />

      {/* Recognition Hook - Interactive Chips */}
      <section className="mt-10 sm:mt-14">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-6">
          Kommt dir das bekannt vor?
        </h2>
        <RecognitionChips />
        <p className="mt-6 sm:mt-8 text-center text-gray-700 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">
          <strong className="text-gray-900">Du bist nicht &bdquo;schwierig&ldquo; oder &bdquo;therapieresistent&ldquo;.</strong>{' '}
          Du brauchst einen Ansatz, der dort arbeitet, wo Gespräche nicht hinkommen: in deinem Nervensystem und deinem Körper.
        </p>
      </section>

      {/* Bridge Section - Why patterns repeat */}
      <section className="mt-14 sm:mt-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-6 sm:mb-8">
          Warum sich Muster wiederholen — auch wenn du alles verstanden hast
        </h2>
        <div className="max-w-3xl mx-auto space-y-5 text-gray-700 leading-relaxed text-base sm:text-lg">
          <p>
            Bei Trauma, chronischer Überforderung oder frühen Beziehungserfahrungen reagiert dein Nervensystem automatisch — unabhängig davon, was du denkst oder weißt.
          </p>
          <p>
            Der Körper speichert diese Erfahrungen als Anspannung, Taubheit oder ständige Alarmbereitschaft. Gesprächstherapie erreicht den Verstand. Aber diese Muster sitzen tiefer.
          </p>
          <p>
            Körperpsychotherapie arbeitet genau dort: mit dem autonomen Nervensystem, mit den Reaktionen, die du nicht &bdquo;wegdenken&ldquo; kannst.
          </p>
        </div>
        {/* Visual accent quote */}
        <div className="mt-8 max-w-2xl mx-auto">
          <blockquote className="relative rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/60 p-6 sm:p-8 shadow-sm">
            <div className="absolute -top-3 left-6 bg-white px-2">
              <span className="text-amber-500 text-2xl font-serif">&ldquo;</span>
            </div>
            <p className="text-gray-800 font-medium text-base sm:text-lg leading-relaxed italic">
              Trauma wird nicht nur als Geschichte im Gehirn gespeichert — sondern als körperliche Erfahrung im Nervensystem.
            </p>
          </blockquote>
        </div>
      </section>

      {/* What body-oriented approaches achieve - 4 Cards */}
      <section className="mt-14 sm:mt-20">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-8 sm:mb-10">
          Was körperorientierte Ansätze erreichen können
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Card 1: Nervensystem regulieren */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 mb-4">
              <Brain className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Nervensystem regulieren</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Lerne, dein autonomes Nervensystem direkt zu beeinflussen — nicht durch Analyse, sondern durch körperliche Erfahrung und Präsenz.
            </p>
          </div>
          {/* Card 2: Blockaden lösen */}
          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 mb-4">
              <Activity className="h-6 w-6 text-cyan-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Blockaden lösen</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Festgehaltene Überlebensenergie kann sich entladen. Chronische Anspannung oder Taubheit beginnen sich zu lösen.
            </p>
          </div>
          {/* Card 3: Verbindungen verstehen */}
          <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/80 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 mb-4">
              <Heart className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Verbindungen verstehen</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Erkenne, wie Körperempfindungen, Emotionen und Gedanken zusammenhängen — und wie sie sich gegenseitig beeinflussen.
            </p>
          </div>
          {/* Card 4: Nachhaltige Veränderung */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-4">
              <Sparkles className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-2">Nachhaltige Veränderung</h3>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
              Veränderung, die nicht nur im Kopf stattfindet, sondern körperlich integriert ist. Spürbar. Stabil.
            </p>
          </div>
        </div>
      </section>

      {/* Process - 3 Steps */}
      <ProcessTimeline
        heading="In drei Schritten zur passenden Therapeut:in"
        tagline="Sofort passende Vorschläge basierend auf deinen Angaben. Deine Daten bleiben privat."
        items={[
          {
            icon: <MessageCircle className="h-5 w-5" />,
            title: 'Deine Präferenzen',
            caption: '3 Minuten',
            bullets: ['Du sagst uns, was dir wichtig ist — online oder vor Ort, zeitliche Verfügbarkeit, was dich belastet.'],
          },
          {
            icon: <UserCheck className="h-5 w-5" />,
            title: 'Passende Ergebnisse',
            caption: 'Sofort',
            bullets: ['Wir zeigen dir bis zu 3 passende Profile aus unserem geprüften Netzwerk.'],
          },
          {
            icon: <CalendarCheck className="h-5 w-5" />,
            title: 'Termin buchen',
            caption: 'Direkt online',
            bullets: ['Buche deinen ersten Termin direkt online. Keine Überweisung nötig. Start als Selbstzahler:in.'],
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
          title="Unser Therapeut:innen-Netzwerk"
          subtitle="Persönlich ausgewählte Spezialist:innen für körperorientierte Verfahren"
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
        subtitle="100% kostenlos & unverbindlich. Wir schlagen dir passende Therapeut:innen vor — du entscheidest, mit wem du Kontakt aufnehmen möchtest."
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
