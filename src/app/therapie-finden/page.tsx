import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import CtaLink from '@/components/CtaLink';
import PageAnalytics from '@/components/PageAnalytics';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  HeroNoForm,
  TherapistTeaserSection,
  ProcessTimeline,
  FinalCtaSection,
} from '@/features/landing/components';
import { buildLandingMetadata, buildLocalBusinessJsonLd, buildFaqJsonLd } from '@/lib/seo';
import { Lock, MessageCircle, UserCheck, FileCheck, Shield, Clock, CalendarCheck, TrendingUp, Euro, Brain, Activity, Heart, Sparkles } from 'lucide-react';
import Image from 'next/image';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const params = await searchParams;
  const title = 'Deutschlands erste Plattform für Körperpsychotherapie –  | Kaufmann Health';
  const description = 'Sorgfältig ausgewählte Therapeut:innen für dich. Online oder vor Ort in Berlin. Ohne Wartezeit.';
  const v = (params?.v as string) || undefined;
  return buildLandingMetadata({
    baseUrl: baseUrl,
    path: '/therapie-finden',
    title,
    description,
    searchParams: { v },
  });
}

export default async function TherapieFindenPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  // Test 4: Read variant from URL params (from Google Ads) - defaults to concierge for backward compatibility
  const rawVariant = params?.variant || params?.v;
  const variant = typeof rawVariant === 'string' ? rawVariant : 'concierge';
  const fragebogenHref = `/fragebogen?variant=${encodeURIComponent(variant)}`;
  
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
      <PageAnalytics qualifier="concierge" />
      <HeroNoForm
        title="Traumata lösen sich nicht von Reden allein."
        // subtitle="Dein Körper erinnert sich — auch wenn dein Kopf längst verstanden hat. Körperpsychotherapie setzt dort an, wo Gespräche nicht hinkommen."
        ctaLabel="Therapeut:in finden"
        ctaHref={fragebogenHref}
        backgroundSrc="/images/hero-calm.jpeg"
        valueProps={[
          '✓ Handverlesene Therapeut:innen',
          '✓ Ohne Warteliste',
          '✓ Körperpsychotherapie Berlin',
          '✓ Berlin & Online · 80€–120€',
        ]}
      />

      {/* Recognition Hook */}
      <section
        aria-labelledby="recognition-heading"
        className="relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12"
      >
        {/* Enhanced gradient overlays */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_30%_0%,rgba(99,102,241,0.08),transparent_70%),radial-gradient(30rem_16rem_at_100%_80%,rgba(14,165,233,0.06),transparent_65%)]" />
        {/* Decorative blur */}
        <div className="pointer-events-none absolute -top-12 -left-12 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 items-center">
          {/* Text content - takes 3/5 on large screens */}
          <div className="lg:col-span-3">
            <h2
              id="recognition-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 leading-tight"
            >
              Du hast vieles verstanden — und trägst es trotzdem noch mit dir.
            </h2>

            <p className="mt-6 text-base sm:text-lg lg:text-xl leading-relaxed text-gray-700">
              Fühlst du dich oft überwältigt, abgeschnitten von dir selbst — als ob die Last der Vergangenheit dich daran hindert, wirklich im Jetzt anzukommen?
            </p>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-gray-700">
              Hier findest du Therapeut:innen, die verstehen, was du durchmachst — sorgfältig ausgewählt für deine Situation. Online oder vor Ort. Ohne Wartezeit. Ohne Eintrag in deine Krankenakte.
            </p>

            {/* CTA area */}
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <CtaLink
                href={fragebogenHref}
                eventType="cta_click"
                eventId="therapie-finden-recognition-cta"
                data-cta="recognition-hook"
                className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-indigo-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-indigo-700 shadow-md hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Unverbindlich anfragen
              </CtaLink>
              <p className="text-sm sm:text-base text-gray-600">
                Wir helfen dir, die richtige Begleitung zu finden.
              </p>
            </div>
          </div>

          {/* Visual - takes 2/5 on large screens */}
          <div className="hidden lg:flex lg:col-span-2 items-center justify-center">
            <div className="relative w-full aspect-[4/5] max-w-xs rounded-2xl overflow-hidden shadow-xl border border-slate-200/60">

              <Image
                src="/images/body-remembers.jpeg"
                alt="Handverlesene Therapeut:innen"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 280px, 0px"
              />
              {/* Subtle gradient overlay for depth */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Bridge Section - Why patterns repeat */}
      <section
        aria-labelledby="bridge-heading"
        className="relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12"
      >
        {/* Enhanced gradient overlays */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.08),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.06),transparent_65%)]" />
        {/* Decorative blur */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/15 to-transparent blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12 items-center">
          {/* Visual - LEFT on desktop (order-first) */}
          <div className="hidden lg:flex lg:col-span-2 lg:order-first items-center justify-center">
            <div className="relative w-full aspect-[4/3] max-w-sm rounded-2xl overflow-hidden shadow-xl border border-slate-200/60">
              <Image
                src="/images/session.jpeg"
                alt="Körperpsychotherapie-Sitzung"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 340px, 0px"
              />
              {/* Subtle gradient overlay for depth */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 via-transparent to-transparent" />
            </div>
          </div>

          {/* Text content - RIGHT on desktop */}
          <div className="lg:col-span-3">
            <h2 id="bridge-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Dein Körper erinnert sich.
            </h2>
            <div className="mt-6 space-y-4 text-gray-700 leading-relaxed text-base sm:text-lg">
              <p>
                Bei Trauma, chronischer Überforderung oder frühen Beziehungserfahrungen reagiert dein Nervensystem automatisch — unabhängig davon, was du denkst oder weißt.
              </p>
              <p>
                Der Körper speichert diese Erfahrungen als Anspannung, Taubheit oder ständige Alarmbereitschaft. Gesprächstherapie erreicht den Verstand. Aber diese Muster sitzen tiefer.
              </p>
              <p>
                <strong className="text-gray-900">Körperpsychotherapie arbeitet genau dort:</strong> mit dem autonomen Nervensystem, mit den Reaktionen, die du nicht &bdquo;wegdenken&ldquo; kannst.
              </p>
            </div>

            {/* Mid-bridge CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <CtaLink
                href={fragebogenHref}
                eventType="cta_click"
                eventId="therapie-finden-bridge-cta"
                data-cta="bridge-section"
                className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-teal-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-teal-700 shadow-md hover:bg-teal-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
              >
                Fragebogen starten
              </CtaLink>
              <p className="text-sm sm:text-base text-gray-600">
                3 Minuten · Unverbindlich
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What body-oriented approaches achieve - 4 Cards */}
      <section
        aria-labelledby="approaches-heading"
        className="relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12"
      >
        {/* Enhanced gradient overlays */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(16,185,129,0.06),transparent_70%),radial-gradient(30rem_16rem_at_0%_100%,rgba(99,102,241,0.06),transparent_65%)]" />
        {/* Decorative blur */}
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-200/15 to-transparent blur-3xl" />

        <div className="text-center">
          <h2 id="approaches-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Körpertherapie Berlin: Was somatische Ansätze erreichen
          </h2>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-2xl mx-auto">
            Körperpsychotherapie & Körperorientierte Therapie wirken dort, wo kognitive Methoden an Grenzen stoßen.
          </p>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* Card 1: Nervensystem regulieren */}
          <Card className="group relative border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/80 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <CardHeader>
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 w-fit">
                <Brain className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-lg text-gray-900">Nervensystem regulieren</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Lerne, dein autonomes Nervensystem direkt zu beeinflussen — nicht durch Analyse, sondern durch körperliche Erfahrung und Präsenz.
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Blockaden lösen */}
          <Card className="group relative border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/80 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <CardHeader>
              <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3 text-sky-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 w-fit">
                <Activity className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-lg text-gray-900">Trauma im Körper lösen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Festgehaltene Überlebensenergie kann sich entladen. Chronische Anspannung, Blockaden und Taubheit beginnen sich zu lösen.
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Verbindungen verstehen */}
          <Card className="group relative border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/80 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <CardHeader>
              <div className="rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/60 p-3 text-rose-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 w-fit">
                <Heart className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-lg text-gray-900">Verbindungen verstehen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Erkenne, wie Körperempfindungen, Emotionen und Gedanken zusammenhängen — und wie sie sich gegenseitig beeinflussen.
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Nachhaltige Veränderung */}
          <Card className="group relative border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/80 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <CardHeader>
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 w-fit">
                <Sparkles className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-lg text-gray-900">Nachhaltige Veränderung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Veränderung, die nicht nur im Kopf stattfindet, sondern körperlich integriert ist. Spürbar. Stabil.
              </p>
            </CardContent>
          </Card>
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

      {/* Mid-page CTA - after process, before stats */}
      <div className="mt-10 sm:mt-12 text-center">
        <CtaLink
          href={fragebogenHref}
          eventType="cta_click"
          eventId="therapie-finden-process-cta"
          data-cta="after-process"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          Jetzt passende Therapeut:in finden
        </CtaLink>
      </div>

      {/* Hard Facts / Stats */}
      <section aria-labelledby="stats-heading" className="mt-10 sm:mt-14">
        <h2 id="stats-heading" className="sr-only">Fakten auf einen Blick</h2>
        <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-6 sm:p-8">
          {/* Subtle overlay for depth */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30 rounded-2xl" />

          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {/* Stat 1: Effectiveness */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-2.5 text-indigo-600 shadow-sm">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  80%
                </span>
              </div>
              <p className="text-sm text-gray-600">
                der Klient:innen berichten von Verbesserungen nach fünf Sitzungen
              </p>
            </div>

            {/* Divider (mobile: horizontal, desktop: vertical) */}
            <div className="hidden sm:block absolute left-1/3 top-6 bottom-6 w-px bg-gradient-to-b from-gray-200/50 via-gray-300/50 to-gray-200/50" />
            <div className="hidden sm:block absolute left-2/3 top-6 bottom-6 w-px bg-gradient-to-b from-gray-200/50 via-gray-300/50 to-gray-200/50" />
            <div className="sm:hidden h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

            {/* Stat 2: Pricing */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-2.5 text-sky-600 shadow-sm">
                  <Euro className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  €80–120
                </span>
              </div>
              <p className="text-sm text-gray-600">
                pro Sitzung bei Selbstzahlung
              </p>
            </div>

            {/* Mobile divider */}
            <div className="sm:hidden h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

            {/* Stat 3: Speed */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-2.5 text-emerald-600 shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  7 Tage
                </span>
              </div>
              <p className="text-sm text-gray-600">
                durchschnittliche Zeit bis zum Ersttermin
              </p>
            </div>
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
        targetId={fragebogenHref}
        targetBasePath={fragebogenHref}
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
