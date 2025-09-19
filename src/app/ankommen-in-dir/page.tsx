import type { Metadata } from "next";
import SectionViewTracker from "@/components/SectionViewTracker";
import WhatToExpectSection from "@/components/WhatToExpectSection";
import FaqAccordion from "@/components/FaqAccordion";
import AnkommenHero from "./Hero";
import TherapistPreview from "@/components/TherapistPreview";
import { supabaseServer } from "@/lib/supabase-server";
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

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata: Metadata = {
  title: "Ankommen in dir – Körperorientierte Therapie online | Kaufmann Health",
  description:
    "Körperorientierte Therapie – persönlich kuratiert und online verfügbar, deutschlandweit. Embodiment & Nervensystem‑Regulation.",
  alternates: { canonical: `${baseUrl}/ankommen-in-dir` },
  openGraph: {
    title: "Ankommen in dir – Körperorientierte Therapie online",
    description: "Persönlich kuratierte Empfehlungen für Online-Sitzungen, deutschlandweit.",
    url: `${baseUrl}/ankommen-in-dir`,
    type: "website",
    images: [{ url: `${baseUrl}/images/color-patterns.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ankommen in dir – Körperorientierte Therapie online",
    description: "Persönlich kuratierte Empfehlungen für Online-Sitzungen, deutschlandweit.",
    images: [`${baseUrl}/images/color-patterns.png`],
  },
};

export default async function AnkommenInDirPage() {
  // Fetch therapists (placeholder: sample list; later filter by online capability)
  const TRUST_IDS = [
    '7402bb04-c8d8-403e-a8d7-6bc32289c87b',
    '58d98a45-21ab-40ea-99b3-f65ba27f6715',
    'e81b560c-7489-4563-be53-1b6cd858f152',
    '25ae2093-6d85-4d34-84bd-08411f713164',
    '84c187fb-a981-442b-8a42-422093a3196b',
  ];
  const selected = [...TRUST_IDS].sort(() => 0.5 - Math.random()).slice(0, 3);
  const { data: rows } = await supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, city, modalities, accepting_new, photo_url, metadata')
    .in('id', selected);

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    city: string | null;
    modalities: string[] | null;
    accepting_new: boolean | null;
    photo_url: string | null;
    metadata?: Record<string, unknown> | null;
  };

  const therapists = ((rows as Row[] | null) || []).map((r) => {
    const mdObj: Record<string, unknown> = r?.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {};
    const profileUnknown = mdObj['profile'];
    const profile: Record<string, unknown> = profileUnknown && typeof profileUnknown === 'object' ? (profileUnknown as Record<string, unknown>) : {};
    const approach_text = typeof profile['approach_text'] === 'string' ? (profile['approach_text'] as string) : '';
    return {
      id: r.id as string,
      first_name: String(r.first_name || ''),
      last_name: String(r.last_name || ''),
      city: String(r.city || ''),
      modalities: Array.isArray(r.modalities) ? (r.modalities as string[]) : [],
      accepting_new: Boolean(r.accepting_new),
      photo_url: r.photo_url || undefined,
      approach_text,
    };
  });

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
      "Körperorientierte Therapie online – persönlich kuratiert. NARM, Somatic Experiencing, Hakomi, Core Energetics.",
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
          <AnkommenHero />
        </SectionViewTracker>

        {/* Therapist previews (online focus) */}
        <SectionViewTracker location="therapist-previews">
        <section aria-labelledby="trust-previews" className="mt-10 sm:mt-14">
          <h2 id="trust-previews" className="text-2xl font-semibold tracking-tight">Deine Begleiter:innen</h2>
          <p className="mt-2 max-w-2xl text-gray-700">Persönlich ausgewählt. Online verfügbar. Durchschnittlich 7+ Jahre Erfahrung. Termine innerhalb von 7 Tagen.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((t) => (
              <TherapistPreview key={t.id} therapist={t} />
            ))}
          </div>
        </section>
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
        <section aria-labelledby="privacy-benefit" className="mt-10 sm:mt-14 rounded-2xl border bg-white p-5 sm:p-6">
          <VariantGate show="C">
            <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">Coaching & Begleitung – ohne Krankenkasseneintrag</h2>
          </VariantGate>
          <VariantGate show="A">
            <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">Therapie ohne Krankenkasseneintrag</h2>
          </VariantGate>
          <VariantGate show="B">
            <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">Therapie ohne Krankenkasseneintrag</h2>
          </VariantGate>
          <p className="mt-2 max-w-2xl text-gray-700">Deine mentale Gesundheit, deine Privatsphäre.</p>
          <div className="mt-4">
            <CheckList
              items={[
                "Keine S‑Nummer: kein Eintrag bei der Krankenkasse, keine ICD‑10‑Diagnose in der Kassenakte",
                "Karrierefreundlich: relevant für Verbeamtung sowie Lebens‑/Berufsunfähigkeitsversicherung",
                "Sofort starten: keine 3–9 Monate Wartezeit, kein Gutachterverfahren",
              ]}
            />
          </div>
        </section>

        {/* Process flow */}
        <SectionViewTracker location="process">
        <section aria-labelledby="process-heading" id="process" className="mt-10 sm:mt-14">
          <h2 id="process-heading" className="text-2xl font-semibold tracking-tight">So funktioniert&#39;s</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <Card className="group relative overflow-hidden transition-all duration-200">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">1</div>
                </div>
                <CardTitle className="mt-2 text-lg">Du schilderst deinen Weg</CardTitle>
              </CardHeader>
            </Card>
            <Card className="group relative overflow-hidden transition-all duration-200">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">2</div>
                </div>
                <CardTitle className="mt-2 text-lg">Wir kuratieren passend zu deinem Fokus</CardTitle>
              </CardHeader>
            </Card>
            <Card className="group relative overflow-hidden transition-all duration-200">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">3</div>
                </div>
                <CardTitle className="mt-2 text-lg">Direkter Kontakt & erste Online-Session</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </section>
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
            <p className="mt-3 max-w-2xl text-gray-700">Beginne mit einer Empfehlung – persönlich kuratiert und online verfügbar.</p>
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
