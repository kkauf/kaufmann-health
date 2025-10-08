import type { Metadata } from 'next';
import FaqAccordion from '@/components/FaqAccordion';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';
import {
  LandingHero,
  RecognitionSection,
  MethodComparison,
  TherapistTeaserSection,
  InvestmentSection,
  ProcessSteps,
  FinalCtaSection,
  PrivacySelfPaySection,
} from '@/features/landing/components';
import { buildLandingMetadata, buildLocalBusinessJsonLd, buildFaqJsonLd } from '@/lib/seo';
import { ShieldCheck, Clock, Lock, MessageCircle, UserCheck, PhoneCall } from 'lucide-react';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const title = 'Therapeut:innen finden – Heilpraktiker:in für Psychotherapie | Kaufmann Health';
  const description = 'Handverlesene Heilpraktiker:innen (Psychotherapie). Termine diese Woche. 80–120€ pro Sitzung. 100% diskret ohne Krankenkasse.';
  const v = (searchParams?.v as string) || undefined;
  return buildLandingMetadata({
    baseUrl: baseUrl,
    path: '/therapie-finden',
    title,
    description,
    searchParams: { v },
  });
};

export default async function TherapieFindenPage() {
  // FAQs (low on page; non-blocking for conversion)
  const faqs = [
    { id: 'prices', question: 'Was kosten die Sitzungen?', answer: 'In der Regel 80–120€ pro 60 Minuten. Den genauen Satz sprichst du direkt mit deiner Therapeut:in ab.' },
    { id: 'speed', question: 'Wie schnell bekomme ich Termine?', answer: 'Du erhältst handverlesene Vorschläge meist innerhalb weniger Stunden – Termine sind in der Regel noch diese Woche möglich.' },
    { id: 'privacy', question: 'Wird die Therapie bei meiner Krankenkasse dokumentiert?', answer: 'Nein. Es erfolgt keine Kassenabrechnung, kein Eintrag in deiner Krankenakte und keine ICD‑10‑Diagnose bei der Kasse.' },
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
  const selected = [...TRUST_IDS].sort(() => 0.5 - Math.random()).slice(0, 3);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <LandingHero
        title="Heilpraktiker:in für Psychotherapie - passend für dich"
        subtitle={<>Wenn Verstehen allein nicht mehr reicht</>}
        trustItems={[
          { icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, label: 'Staatlich geprüfte Heilpraktiker:innen (Psychotherapie)' },
          { icon: <Clock className="h-4 w-4 text-sky-600" />, label: 'Termine diese Woche verfügbar' },
          { icon: <Lock className="h-4 w-4 text-slate-700" />, label: '100% diskret ohne Krankenkasse' },
        ]}
        showModalityLogos
        ctaPill={
          <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
            <CtaLink href="#pricing" eventType="cta_click">80–120€ pro Sitzung</CtaLink>
          </Button>
        }
        analyticsQualifier="LP-Therapie-Finden"
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
      <p className="mt-4 sm:mt-5 max-w-3xl text-gray-700">
        <strong>Du bist nicht „schwierig“ oder „therapieresistent“.</strong> Körperorientierte Ansätze erreichen, was reine Gesprächstherapie nicht kann: dein Nervensystem und die im Körper gespeicherten Erfahrungen.
      </p>

      {/* Method Bridge */}
      <h2 className="mt-10 sm:mt-14 text-2xl font-semibold tracking-tight">Was deine bisherige Therapie nicht erreichen konnte</h2>
      <MethodComparison
        leftTitle="Gesprächstherapie"
        rightTitle="+ Körperorientierte Verfahren"
        leftItems={[
          'Versteht und analysiert',
          'Arbeitet mit dem Bewusstsein',
          'Kognitive Einsichten',
        ]}
        rightItems={[
          'Integriert und verkörpert',
          'Erreicht das Nervensystem',
          'Spürbare Veränderung',
        ]}
      />
      <p className="mt-4 text-gray-700">Auf Basis neuester Erkenntnisse der Traumaforschung und Neurobiologie.</p>

      {/* Therapist previews (curated subset of 5) */}
      <TherapistTeaserSection title="Deine möglichen Therapeut:innen" subtitle="Termine diese Woche verfügbar." ids={selected} limit={3} />

      {/* Investment (note) */}
      <InvestmentSection
        id="pricing"
        heading="Transparente Investition in deine Gesundheit"
        mode="note"
        noteItems={[
          'Sitzungspreise: 80–120€ (je nach Therapeut:in)',
          '✓ Sofort verfügbar (statt 3–9 Monate warten)',
          '✓ Keine Diagnose in deiner Krankenakte',
          '✓ Methodenfreiheit ohne Kassenbeschränkungen',
          '✓ Steuerlich absetzbar als außergewöhnliche Belastung',
        ]}
      />

      {/* Privacy benefit */}
      <PrivacySelfPaySection />

      {/* Process with guarantee */}
      <ProcessSteps
        heading="So funktioniert deine Therapeuten‑Vermittlung"
        items={[
          { step: 1, title: 'Du teilst uns deine Präferenzen mit', icon: <MessageCircle className="h-5 w-5" />, bullets: ['Geschlecht, Ort, Online/Offline, besondere Anliegen'] },
          { step: 2, title: 'Wir senden dir bis zu 3 passende Vorschläge', icon: <UserCheck className="h-5 w-5" />, bullets: ['Handverlesene Therapeut:innen passend zu deinem Fokus'] },
          { step: 3, title: 'Du wählst und erhältst Termine in 24 Stunden', icon: <PhoneCall className="h-5 w-5" />, bullets: ['Direkter Kontakt mit konkreten Terminvorschlägen'] },
        ]}
        footnote={<><strong>Garantie:</strong> Termine diese Woche möglich – statt 3–6 Monate Wartezeit bei der Kassentherapie.</>}
      />

      {/* FAQ (low on page) */}
      <section aria-labelledby="faq-heading" id="faq" className="mt-10 sm:mt-14">
        <h2 id="faq-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqAccordion items={faqs} />
        </div>
      </section>

      {/* Final CTA */}
      <FinalCtaSection
        heading="Starte jetzt diese Woche statt in 6 Monaten"
        subtitle="Du erhältst handverlesene Vorschläge innerhalb weniger Stunden"
        buttonLabel="Jetzt passende Therapeut:innen finden"
      />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </main>
  );
}
