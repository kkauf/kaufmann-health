import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import PageAnalytics from '@/components/PageAnalytics';
import CtaLink from '@/components/CtaLink';
import { HeroNoForm } from '@/features/landing/components/HeroNoForm';
import { ProcessTimeline } from '@/features/landing/components/ProcessTimeline';
import { MidPageConversion } from '@/features/landing/components/MidPageConversion';
import { FoundersValuesSection } from '@/features/landing/components/FoundersValuesSection';
import { TherapistTeaserSection } from '@/features/landing/components/TherapistTeaserSection';
import { FinalCtaSection } from '@/features/landing/components/FinalCtaSection';
import { buildLandingMetadata, buildFaqJsonLd, buildLocalBusinessJsonLd } from '@/lib/seo';
import { MessageCircle, UserCheck, PhoneCall } from 'lucide-react';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }): Promise<Metadata> {
  const title = 'Kaufmann Health – Handverlesene Therapeut:innen (Termine in 24h)';
  const description = 'Therapeuten finden in 24 Stunden. Persönlich ausgewählt für dich. Online oder vor Ort. Ohne Wartezeit.';
  const params = await searchParams;
  const v = (params?.v as string) || undefined;
  const base = buildLandingMetadata({
    baseUrl,
    path: '/start',
    title,
    description,
    searchParams: { v },
  });
  return { ...base, robots: { index: false, follow: false } };
}

export default async function StartPage() {
  const faqs = [
    {
      id: 'why-body',
      question: 'Warum körperorientierte Therapie?',
      answer:
        'Verstehen allein reicht oft nicht. Körperorientierte Ansätze arbeiten mit deinem Nervensystem und lösen festgefahrene Muster – für echte, spürbare Veränderung.',
    },
    {
      id: 'how-it-works',
      question: 'Wie funktioniert die Vermittlung genau?',
      answer:
        'Du füllst einen kurzen Fragebogen aus (5 Minuten). Wir senden dir innerhalb von 24 Stunden bis zu 3 passende Profile – du entscheidest und buchst direkt.',
    },
    {
      id: 'prices',
      question: 'Was kostet eine Sitzung?',
      answer:
        'In der Regel 80–120€ pro 50–60 Minuten – flexibel nach Therapeut:in. Keine Kassenabrechnung, dafür sofort verfügbar und ohne Diagnose in der Kassenakte.',
    },
  ];
  const faqSchema = buildFaqJsonLd(faqs.map(({ question, answer }) => ({ question, answer })));
  const businessSchema = buildLocalBusinessJsonLd({ baseUrl, path: '/start', areaServed: { type: 'Country', name: 'Deutschland', addressCountry: 'DE' } });

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <PageAnalytics qualifier="LP-Start" />

      {/* HERO (no form) */}
      <HeroNoForm
        title="Wenn der Kopf nicht weiterkommt, hilft der Körper"
        subtitle={
          'Erfahrene Körpertherapeut:innen, die wirklich verfügbar sind. Handverlesen, traumasensibel, in Berlin oder online.'
        }
        ctaLabel="Jetzt Therapeut:in finden"
        ctaHref="/fragebogen"
        backgroundSrc="/images/hero.jpg"
      />

      {/* Process timeline (mobile‑first) */}
      <ProcessTimeline
        tagline="Keine Algorithmen. Keine Wartelisten. Nur persönliche Empfehlungen."
        items={[
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
            bullets: ['Wunschtherapeut:in wählen und direkt Termin vereinbaren'],
          },
        ]}
      />

      {/* Therapist network teaser - MOVED UP for trust-first flow */}
      <section className="mt-10 sm:mt-14">
        <TherapistTeaserSection
          title="Unser Therapeuten–Netzwerk"
          subtitle="Persönlich ausgewählte Spezialist:innen"
          limit={3}
        />
        <div className="mt-8 sm:mt-10 text-center">
          <CtaLink
            href="/therapeuten"
            eventType="cta_click"
            data-cta="view-all-therapists"
            className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-teal-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-teal-700 shadow-md hover:bg-teal-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Alle Therapeut:innen ansehen
            <span className="text-xl">→</span>
          </CtaLink>
        </div>
      </section>

      {/* Founders + values - MOVED UP for credibility before conversion */}
      <FoundersValuesSection imageSrc="/profile-pictures/katherine and konstantin.PNG" />

      {/* Mid-page conversion: simplified matching path only - EARTH-209 */}
      <MidPageConversion />

      <FinalCtaSection
        heading="Bereit für den ersten Schritt?"
        subtitle="Fülle unseren 5–Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte Therapeuten–Vorschläge."
        buttonLabel="Jetzt Therapeut:in finden"
        targetId="/fragebogen"
        align="center"
        variant="tinted"
        showAvailabilityNote={false}
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
