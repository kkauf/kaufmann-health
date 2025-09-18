import type { Metadata } from "next";
import SectionViewTracker from "@/components/SectionViewTracker";
import WhatToExpectSection from "@/components/WhatToExpectSection";
import FaqAccordion from "@/components/FaqAccordion";
import AnkommenHero from "./Hero";
import TherapistPreview from "@/components/TherapistPreview";
import { supabaseServer } from "@/lib/supabase-server";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import ExitIntentModal from "@/components/ExitIntentModal";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, UserCheck, PhoneCall } from "lucide-react";
import VariantGate from "@/components/VariantGate";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata: Metadata = {
  title: "Ankommen in dir – Körperorientierte Therapie online | Kaufmann Health",
  description:
    "Körperorientierte Therapie – persönlich kuratiert und online verfügbar, deutschlandweit. Passend zu deinem Weg.",
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
      answer: 'Ja. Wir arbeiten sicher mit Fokus auf Körperwahrnehmung, Regulation und Präsenz – auch online.',
    },
    {
      id: 'coaching',
      question: 'Wie unterscheidet sich das von Coaching/Breathwork?',
      answer: 'Therapie arbeitet tiefer mit Mustern und Bindung. Atem- und Achtsamkeitspraxis fließen unterstützend ein.',
    },
    {
      id: 'frequency',
      question: 'Wie oft soll ich kommen?',
      answer: 'Empfehlung: 1× pro Woche für 6–10 Sitzungen. Danach Integration im eigenen Rhythmus.',
    },
    {
      id: 'modalities',
      question: 'Kann ich Methoden wählen (NARM/Hakomi/SE)?',
      answer: 'Ja. Wir empfehlen passend zu deinem Fokus. Du entscheidest, was dich am meisten anspricht.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <AnkommenHero />

        {/* Therapist previews (online focus) */}
        <section aria-labelledby="trust-previews" className="mt-10 sm:mt-14">
          <h2 id="trust-previews" className="text-2xl font-semibold tracking-tight">Deine Begleiter:innen</h2>
          <p className="mt-2 max-w-2xl text-gray-700">Persönlich ausgewählt. Online verfügbar.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((t) => (
              <TherapistPreview key={t.id} therapist={t} />
            ))}
          </div>
        </section>

        {/* Process flow */}
        <section aria-labelledby="process-heading" className="mt-10 sm:mt-14">
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

        {/* What to expect */}
        <WhatToExpectSection />

        {/* Pricing note (no tiers) */}
        <SectionViewTracker location="pricing-note">
          <section id="pricing" className="scroll-mt-24 mt-10 sm:mt-14 rounded-2xl border bg-slate-50/60 p-5 sm:p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Preise</h2>
            <p className="mt-3 max-w-2xl text-gray-700">
              Die Preise legen die Therapeut:innen selbst fest. In der Regel 80–120€ pro 60 Minuten. Du besprichst den genauen Satz direkt mit deiner Therapeut:in.
            </p>
            <VariantGate show="B">
              <p className="mt-3 text-sm text-gray-600">Antwort in der Regel innerhalb von 24 Stunden.</p>
            </VariantGate>
          </section>
        </SectionViewTracker>

        {/* FAQ */}
        <SectionViewTracker location="faq">
          <section aria-labelledby="faq-heading" className="mt-10 sm:mt-14">
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
              <a href="#top-form" className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white">Passende Therapeut:innen finden</a>
            </div>
            <p className="mt-4 text-sm text-gray-700">Kostenlos & unverbindlich.</p>
          </section>
        </SectionViewTracker>
      </main>

      <FloatingWhatsApp />
      <ExitIntentModal />
    </div>
  );
}
