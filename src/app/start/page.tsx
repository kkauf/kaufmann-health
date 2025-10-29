import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import PageAnalytics from '@/components/PageAnalytics';
import CtaLink from '@/components/CtaLink';
import TherapyModalityExplanations from '@/components/TherapyModalityExplanations';
import { HeroNoForm } from '@/features/landing/components/HeroNoForm';
import { ProcessTimeline } from '@/features/landing/components/ProcessTimeline';
import { FoundersValuesSection } from '@/features/landing/components/FoundersValuesSection';
import { TherapistTeaserSection } from '@/features/landing/components/TherapistTeaserSection';
import { FinalCtaSection } from '@/features/landing/components/FinalCtaSection';
import { buildLandingMetadata, buildFaqJsonLd, buildLocalBusinessJsonLd } from '@/lib/seo';
import { MessageCircle, UserCheck, PhoneCall, Shield, Lock, FileCheck, TextSearch, Search } from 'lucide-react';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

type Variant = 'body-oriented' | 'ready-now';

function normalizeVariant(raw?: string | string[]): Variant {
  const v = typeof raw === 'string' ? raw.toLowerCase() : '';
  return v === 'ready-now' ? 'ready-now' : 'body-oriented';
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const params = await searchParams;
  const variant = normalizeVariant(params?.variant);
  
  const title = variant === 'ready-now'
    ? 'Kaufmann Health – Therapie ohne Wartezeit (Termine in 24h)'
    : 'Kaufmann Health – Körperorientierte Therapie (Termine in 24h)';
  const description = variant === 'ready-now'
    ? 'Sofort verfügbare Therapeuten in Berlin und online. Persönlich ausgewählt, keine Wartelisten, keine Kassentherapie.'
    : 'Körperorientierte Traumatherapie in Berlin und online. Handverlesene Spezialist:innen, sofort verfügbar.';
  
  const base = buildLandingMetadata({
    baseUrl,
    path: '/start',
    title,
    description,
  });
  return { ...base, robots: { index: false, follow: false } };
}

export default async function StartPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const variant = normalizeVariant(params?.variant);
  // Test 1 (Browse vs Submit): decide CTA routing from raw variant param without changing copy
  const rawVariant = typeof (params?.variant) === 'string' ? (params!.variant as string).toLowerCase() : '';
  const isBrowse = rawVariant === 'browse';
  // Preserve variant when moving into the questionnaire so downstream attribution can detect origin
  const fragebogenHref = `/fragebogen${rawVariant ? `?variant=${encodeURIComponent(rawVariant)}` : ''}`;
  // Preserve variant when navigating to the directory so the variant survives into /therapeuten
  const therapeutenHref = `/therapeuten${rawVariant ? `?variant=${encodeURIComponent(rawVariant)}` : ''}`;
  
  // Variant A: Body-Oriented Specialist
  const bodyOrientedCopy = {
    hero: {
      title: 'Wenn der Kopf nicht weiterkommt, hilft der Körper',
      subtitle: 'Erfahrene Körpertherapeut:innen, die wirklich verfügbar sind. Handverlesen, somatisch orientiert, in Berlin oder online.',
    },
    process: {
      tagline: 'Keine Wartelisten. Persönlich ausgewählte Vorschläge in <24h. Deine Daten bleiben privat.',
    },
    faqs: [
      {
        id: 'why-body',
        question: 'Warum körperorientierte Therapie?',
        answer: 'Viele Menschen verstehen ihre Probleme bereits – sie wissen, woher ihre Ängste kommen, welche Muster sie haben. Aber Verstehen allein führt nicht zu Veränderung. Trauma und festgefahrene Reaktionen leben in deinem Nervensystem. Körperorientierte Therapie arbeitet direkt mit deinem Körper, um diese Muster zu lösen. Das Ergebnis: Nachhaltige Veränderung, nicht nur Einsicht.',
      },
      {
        id: 'how-it-works',
        question: 'Wie funktioniert die Vermittlung genau?',
        answer: 'Du füllst einen kurzen Fragebogen aus (5 Minuten). Wir senden dir innerhalb von 24 Stunden bis zu 3 passende Profile – du entscheidest und buchst direkt.',
      },
      {
        id: 'prices',
        question: 'Was kostet eine Sitzung?',
        answer: 'In der Regel 80–120€ pro 50–60 Minuten – flexibel nach Therapeut:in. Keine Kassenabrechnung, dafür sofort verfügbar und ohne Diagnose in der Kassenakte.',
      },
    ],
  };
  
  // Variant B: Ready Now / Urgency-Driven
  const readyNowCopy = {
    hero: {
      title: 'Therapie ohne Wartezeit – Termine in 24 Stunden',
      subtitle: 'Kein monatelanges Warten. Keine Kassentherapie. Nur handverlesene Therapeut:innen, die sofort verfügbar sind – in Berlin oder online.',
    },
    process: {
      tagline: 'Keine Wartelisten. Vorschläge in <24h. Deine Daten bleiben privat.',
    },
    faqs: [
      {
        id: 'why-no-wait',
        question: 'Warum keine Wartezeit?',
        answer: 'Wir arbeiten ausschließlich mit Selbstzahlenden Therapeut:innen, die aktiv neue Klient:innen aufnehmen. Keine Kassenzulassung bedeutet: keine Wartelisten, kein Antragsprozess, keine Diagnose in deiner Kassenakte.',
      },
      {
        id: 'how-it-works',
        question: 'Wie funktioniert die Vermittlung?',
        answer: 'Du füllst einen 5-Minuten-Fragebogen aus. Innerhalb von 24 Stunden senden wir dir bis zu 3 passende Therapeut:innen-Profile. Du wählst deinen Favoriten und buchst direkt einen Termin.',
      },
      {
        id: 'prices',
        question: 'Was kostet eine Sitzung?',
        answer: 'In der Regel 80–120€ pro 50–60 Minuten, je nach Therapeut:in. Selbstzahlung bedeutet: keine Wartezeit, volle Flexibilität, und deine Daten bleiben privat.',
      },
    ],
  };
  
  const copy = variant === 'ready-now' ? readyNowCopy : bodyOrientedCopy;
  const faqs = copy.faqs;
  const faqSchema = buildFaqJsonLd(faqs.map(({ question, answer }) => ({ question, answer })));
  const businessSchema = buildLocalBusinessJsonLd({ baseUrl, path: '/start', areaServed: { type: 'Country', name: 'Deutschland', addressCountry: 'DE' } });

  // Variant-specific timeline ("So funktioniert") for Test 1
  const timelineTagline = isBrowse
    ? 'Verzeichnis durchsuchen. Profil ansehen. Direkt Kontakt aufnehmen – privat und ohne Wartezeit.'
    : 'Bis zu 3 passende Therapeut:innen-Vorschläge in <24h. Deine Daten bleiben privat. Du entscheidest, wie du kontaktiert werden möchtest.';
  const timelineItems = isBrowse
    ? [
        {
          icon: <Search className="h-5 w-5" />,
          title: 'Therapeut:innen entdecken',
          caption: 'Filtern & stöbern',
          bullets: ['Verzeichnis nach Stadt, Online-Format und Modalität filtern'],
        },
        {
          icon: <UserCheck className="h-5 w-5" />,
          title: 'Profil ansehen',
          caption: 'Details & Passung',
          bullets: ['Verfügbarkeit, Modalitäten und Ansatz prüfen'],
        },
        {
          icon: <MessageCircle className="h-5 w-5" />,
          title: 'Kontakt aufnehmen',
          caption: 'Direkter Kontakt',
          bullets: ['Kurz verifizieren, Nachricht senden', 'Antwort in <24h'],
        },
      ]
    : [
        {
          icon: <MessageCircle className="h-5 w-5" />,
          title: 'Deine Präferenzen',
          caption: '5 Minuten',
          bullets: [' Du sagst uns, was dir wichtig ist'],
        },
        {
          icon: <UserCheck className="h-5 w-5" />,
          title: 'Unsere persönliche Auswahl',
          caption: '24 Stunden',
          bullets: ['Bis zu 3 passende Profile, von uns handverlesen'],
        },
        {
          icon: <PhoneCall className="h-5 w-5" />,
          title: 'Du entscheidest',
          caption: 'Direkter Kontakt',
          bullets: ['Wunschtherapeut:in wählen und direkt Termin vereinbaren', 'Vorschläge per E‑Mail oder SMS – du entscheidest'],
        },
      ];

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <PageAnalytics qualifier={`LP-Start-${variant}`} />

      {/* HERO (no form) */}
      <HeroNoForm
        title={copy.hero.title}
        subtitle={copy.hero.subtitle}
        ctaLabel={isBrowse ? 'Therapeut:innen ansehen' : 'Jetzt Therapeut:in finden'}
        ctaHref={isBrowse ? therapeutenHref : fragebogenHref}
        backgroundSrc="/images/hero.jpg"
      />

      {/* Process timeline (mobile‑first) */}
      <ProcessTimeline tagline={timelineTagline} items={timelineItems} />
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
          <span>Therapie ohne Krankenkassen-Eintrag</span>
        </span>
      </p>

      {/* Therapist network teaser - MOVED UP for trust-first flow */}
      <section className="mt-10 sm:mt-14">
        <TherapistTeaserSection
          title="Unser Therapeuten-Netzwerk"
          subtitle="Persönlich ausgewählte Spezialist:innen"
          limit={3}
        />
        <div className="mt-8 sm:mt-10 text-center">
          <CtaLink
            href={therapeutenHref}
            eventType="cta_click"
            eventId="start-therapist-teaser-view-all"
            data-cta="view-all-therapists"
            className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-teal-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-teal-700 shadow-md hover:bg-teal-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Alle Therapeut:innen ansehen
            <span className="text-xl">→</span>
          </CtaLink>
        </div>
      </section>

      {/* Modality explanations */}
      <TherapyModalityExplanations />

      {/* Founders + values - MOVED UP for credibility before conversion */}
      <FoundersValuesSection imageSrc="/profile-pictures/katherine and konstantin.PNG" />

      <FinalCtaSection
        heading="Bereit für den ersten Schritt?"
        subtitle={isBrowse
          ? 'Stöbere im Verzeichnis. Profil ansehen und direkt Kontakt aufnehmen.'
          : 'Fülle unseren 5-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte Therapeuten-Vorschläge.'}
        buttonLabel={isBrowse ? 'Therapeut:innen ansehen' : 'Jetzt Therapeut:in finden'}
        targetId={isBrowse ? therapeutenHref : fragebogenHref}
        align="center"
        variant="tinted"
        showAvailabilityNote={false}
        withEntryOptions={true}
        targetBasePath={isBrowse ? therapeutenHref : fragebogenHref}
      />

      {/* FAQ */}
      <section aria-labelledby="faq-heading" id="faq" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
        <div className="mt-6 sm:mt-8">
          <FaqAccordion items={faqs} />
        </div>
      </section>
      {/* JSON‑LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </main>
  );
}
