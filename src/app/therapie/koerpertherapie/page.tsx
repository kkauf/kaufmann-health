import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import MethodComparison from "@/features/landing/components/MethodComparison";
import FinalCtaSection from "@/features/landing/components/FinalCtaSection";
import RelatedTreatments from "@/features/therapy/components/RelatedTreatments";
import { Activity, Brain, ShieldCheck, HeartPulse, ArrowLeftRight, Compass } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';
  const title = "Körpertherapie: Körperorientierte Therapie einfach erklärt | Kaufmann Health";
  const description = "Was ist Körpertherapie? Wissenschaftlich fundiert, sanft und alltagsnah erklärt – mit klarer Abgrenzung zur Gesprächstherapie.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/therapie/koerpertherapie` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/therapie/koerpertherapie`,
      type: "website",
      images: [
        { url: `${baseUrl}/images/color-patterns.png`, width: 1200, height: 630, alt: "Kaufmann Health – Körpertherapie" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/images/color-patterns.png`],
    },
  };
};

function WhatIsKoerpertherapie() {
  return (
    <section aria-labelledby="what-kt-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <h2 id="what-kt-heading" className="text-2xl font-semibold">Was ist Körpertherapie?</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
          Körpertherapie (körperorientierte Therapie) bezieht den Körper aktiv in die Begleitung ein: Wahrnehmung, Atmung, Haltung,
          Orientierung im Raum und natürliche Schutzreaktionen. Ziel ist nicht „mehr funktionieren“, sondern echte Regulation und
          mehr Wahlfreiheit im Alltag.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '0ms' }}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Brain className="h-5 w-5" /></div>
              <CardTitle>Körperbasiert</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">Interozeption (inneres Spüren), Erdung, Orientierung. Der Körper zeigt, was sicher ist – Schritt für Schritt.</p>
            </CardContent>
            </Card>
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '60ms' }}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-xl bg-sky-50 p-2 text-sky-600"><Activity className="h-5 w-5" /></div>
              <CardTitle>Regulation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">Sanftes Auf‑ und Abregeln (Titration & Pendulation) statt Überforderung. Keine Retraumatisierung.</p>
            </CardContent>
            </Card>
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '120ms' }}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
              <CardTitle>Sicher & seriös</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">Professionell, medizin‑adjazent. Keine Esoterik – gut erklärbar und alltagsnah.</p>
            </CardContent>
            </Card>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <Compass className="h-5 w-5" />, title: "Orientierung & Ressourcen", desc: "Sichere Basis schaffen: Erdung, Atem, Blick, Halt – ohne zu überfordern." },
    { icon: <ArrowLeftRight className="h-5 w-5" />, title: "Titration & Pendulation", desc: "In kleinen Dosen spüren und entladen – zwischen Aktivierung und Ruhe wechseln." },
    { icon: <HeartPulse className="h-5 w-5" />, title: "Integration", desc: "Neue Regulation verankern – mehr Wahlfreiheit im Alltag." },
  ];
  return (
    <section aria-labelledby="how-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <h2 id="how-heading" className="text-2xl font-semibold">So funktioniert’s (einfach erklärt)</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={i} className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{s.icon}</div>
                <CardTitle>{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{s.desc}</p>
              </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

export default async function KoerpertherapiePage() {
  const faqs = [
    { id: "seriös", question: "Ist das seriös oder esoterisch?", answer: "Körpertherapie arbeitet mit gut erklärbaren, biologischen Mechanismen (Atmung, Orientierung, Schutzreflexe). Wir nutzen eine ruhige, professionelle Gestaltung und verweisen auf Studien (z. B. zu Somatic Experiencing)." },
    { id: "gespraech", question: "Wie unterscheidet sich das von Gesprächstherapie?", answer: "Gespräche helfen zu verstehen. Körpertherapie ergänzt dies um das Spüren und Regulieren im Körper. So wird Veränderung nicht nur gedacht, sondern erlebt." },
    { id: "geeignet", question: "Für wen ist es geeignet?", answer: "Für Menschen, die sich feststeckend, überfordert oder innerlich taub fühlen und einen körpernahen Weg möchten. Wir klären unverbindlich, ob es zu dir passt." },
    { id: "anzahl", question: "Wie viele Sitzungen brauche ich?", answer: "Individuell. Viele spüren Veränderungen nach 6–10 Sitzungen. Tempo und Tiefe bestimmst du – ohne Verpflichtung." },
    { id: "kasse", question: "Kassenleistung?", answer: "Nein. Wir arbeiten bewusst ohne Krankenkasse. Keine Diagnosen in deiner Akte, hohe Vertraulichkeit und Termin‑Flexibilität." },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Körpertherapie (körperorientierte Therapie)",
    url: `${baseUrl}/therapie/koerpertherapie`,
    description: "Körperorientierte Therapie zur Verbesserung der Selbstregulation durch Orientierung, Interozeption, Titration und Pendulation.",
    sameAs: [
      "https://de.wikipedia.org/wiki/K%C3%B6rperpsychotherapie",
      "https://traumahealing.org/se-research-and-articles/"
    ],
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <LandingHero
          title="Körpertherapie – verständlich, seriös, körpernah"
          subtitle={<span>Was Körpertherapie ist – wissenschaftlich fundiert erklärt. Ruhig, professionell, ohne Esoterik.</span>}
          defaultSessionPreference="in_person"
          analyticsQualifier="koerpertherapie"
          formDataCta="koerpertherapie-page-signup"
        />

        <WhatIsKoerpertherapie />

        <section aria-labelledby="diff-heading" className="mt-12 sm:mt-16">
          <RevealContainer>
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
            <h2 id="diff-heading" className="text-2xl font-semibold">Kurz erklärt: Gespräch vs. Körper</h2>
            <MethodComparison
              leftTitle="Gesprächstherapie"
              rightTitle="+ Körperorientierte Verfahren"
              leftItems={[
                "Verstehen & Einordnung",
                "Muster, Gedanken, Biografie",
                "Sprache als Hauptwerkzeug",
              ]}
              rightItems={[
                "Spüren & Regulieren",
                "Körperreaktionen, Haltung, Atem",
                "Erlebte Veränderung im Moment",
              ]}
            />
            </div>
          </RevealContainer>
        </section>

        <HowItWorks />

        <section aria-labelledby="evidence-heading" className="mt-12 sm:mt-16">
          <RevealContainer>
            <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
            <h2 id="evidence-heading" className="text-2xl font-semibold">Seriöse Grundlage & Studien</h2>
            <p className="mt-3 max-w-3xl text-gray-700">Körpertherapie stützt sich u. a. auf evidenzbasiert erforschte Verfahren wie Somatic Experiencing (SE). Zwei aktuelle Übersichts‑/RCT‑Publikationen:</p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>
                Brom, D. et al. (2017): Somatic Experiencing for PTSD – Randomized Controlled Trial. <a className="underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5518443/" target="_blank" rel="noopener noreferrer">Volltext (PMC)</a>
              </li>
              <li>
                Heller, D. P. et al. (2021): Wirksamkeit von Somatic Experiencing – Überblick und Schlüsselfaktoren. <a className="underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8276649/" target="_blank" rel="noopener noreferrer">Volltext (PMC)</a>
              </li>
            </ul>
            </div>
          </RevealContainer>
        </section>

        <PrivacySelfPaySection />

        {/* Related treatments under /therapie (exclude current page if applicable) */}
        <RelatedTreatments currentSlug="koerpertherapie" />

        <section aria-labelledby="faq-heading" className="mt-12 sm:mt-16">
          <RevealContainer>
            <div className="opacity-0 translate-y-2 transition-all duration-500" data-reveal>
              <h2 id="faq-heading" className="text-2xl font-semibold">Häufige Fragen</h2>
              <div className="mt-4">
                <FaqAccordion items={faqs} />
              </div>
            </div>
          </RevealContainer>
        </section>

        <FinalCtaSection heading="Bereit, den Körper mit einzubeziehen?" />
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
