import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import MethodComparison from "@/features/landing/components/MethodComparison";
import FinalCtaSection from "@/features/landing/components/FinalCtaSection";
import RelatedTreatments from "@/features/therapy/components/RelatedTreatments";
import { Activity, Brain, ShieldCheck, HeartPulse, ArrowLeftRight, Compass, Users, Sparkles, CheckCircle2 } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';
  const title = "Körpertherapie Berlin | Wissenschaftlich fundierte körperorientierte Therapie";
  const description = "Körpertherapie in Berlin: Wissenschaftlich fundiert, professionell und ohne Esoterik. Erfahren Sie, wie körperorientierte Therapie bei Trauma, Stress und emotionalen Blockaden helfen kann.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/therapie` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/therapie`,
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

function TrustSignals() {
  const signals = [
    { icon: <ShieldCheck className="h-5 w-5" />, text: "Wissenschaftlich fundiert" },
    { icon: <CheckCircle2 className="h-5 w-5" />, text: "Professionell & seriös" },
    { icon: <Brain className="h-5 w-5" />, text: "Keine Esoterik" },
  ];
  return (
    <div className="mt-6 flex flex-wrap gap-4 justify-center sm:justify-start">
      {signals.map((sig, i) => (
        <div key={i} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-2 text-sm font-medium text-slate-700">
          <div className="text-indigo-600">{sig.icon}</div>
          {sig.text}
        </div>
      ))}
    </div>
  );
}

function WhatIsKoerpertherapie() {
  return (
    <section aria-labelledby="what-kt-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <h2 id="what-kt-heading" className="text-2xl font-semibold">Was ist Körpertherapie?</h2>
          <p className="mt-3 max-w-3xl text-gray-700 leading-relaxed">
            Körpertherapie (körperorientierte Therapie) bezieht den Körper aktiv in die therapeutische Arbeit ein: 
            Wahrnehmung, Atmung, Haltung, Orientierung im Raum und natürliche Schutzreaktionen. Das Ziel ist nicht 
            &bdquo;mehr funktionieren&ldquo;, sondern <strong>echte Regulation und mehr Wahlfreiheit im Alltag</strong>.
          </p>
          <p className="mt-3 max-w-3xl text-gray-700 leading-relaxed">
            Anders als reine Gesprächstherapie arbeitet Körpertherapie mit dem, was im Körper spürbar ist – 
            und nutzt dies als direkten Zugang zu unbewussten Mustern und traumatischen Erfahrungen.
          </p>
          
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '0ms' }}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Brain className="h-5 w-5" /></div>
                <CardTitle className="text-base">Körperbasiert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Interozeption (inneres Spüren), Erdung, Orientierung. Der Körper zeigt, was sicher ist – Schritt für Schritt.
                </p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '60ms' }}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-sky-50 p-2 text-sky-600"><Activity className="h-5 w-5" /></div>
                <CardTitle className="text-base">Sanfte Regulation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Sanftes Auf‑ und Abregeln (Titration &amp; Pendulation) statt Überforderung. Keine Retraumatisierung.
                </p>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: '120ms' }}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
                <CardTitle className="text-base">Sicher & evidenzbasiert</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Professionell, medizin-adjazent. Keine Esoterik – gut erklärbar und alltagsnah.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

function ForWhom() {
  const situations = [
    "Sie fühlen sich innerlich taub oder wie abgeschnitten",
    "Ständige innere Anspannung, die sich nicht durch Gespräche löst",
    "Trauma-Erfahrungen (Unfall, Verlust, Gewalt)",
    "Chronische Schmerzen ohne klare körperliche Ursache",
    "Panikattacken oder überwältigende Emotionen",
    "Das Gefühl, im eigenen Körper nicht zu Hause zu sein",
    "Sie möchten mehr als nur über Probleme sprechen",
  ];

  return (
    <section aria-labelledby="forwho-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 id="forwho-heading" className="text-2xl font-semibold">Für wen ist Körpertherapie geeignet?</h2>
              <p className="mt-2 text-gray-600">Körpertherapie ist besonders hilfreich, wenn:</p>
            </div>
          </div>
          
          <ul className="mt-6 space-y-3 max-w-3xl">
            {situations.map((sit, i) => (
              <li key={i} className="flex items-start gap-3 opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: `${i * 40}ms` }}>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 leading-relaxed">{sit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg bg-white/60 backdrop-blur-sm border border-indigo-100 p-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>Wichtig:</strong> Körpertherapie ersetzt keine medizinische oder psychiatrische Behandlung bei akuten Krisen. 
              Sie ergänzt diese jedoch ideal und arbeitet dort, wo Worte allein nicht ausreichen.
            </p>
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { 
      icon: <Compass className="h-5 w-5" />, 
      title: "Orientierung & Ressourcen", 
      desc: "Sichere Basis schaffen: Erdung, Atem, Blick, Halt – ohne zu überfordern. Sie lernen, im Hier und Jetzt anzukommen." 
    },
    { 
      icon: <ArrowLeftRight className="h-5 w-5" />, 
      title: "Titration & Pendulation", 
      desc: "In kleinen Dosen spüren und entladen – zwischen Aktivierung und Ruhe wechseln. So bleibt der Prozess jederzeit sicher." 
    },
    { 
      icon: <HeartPulse className="h-5 w-5" />, 
      title: "Integration", 
      desc: "Neue Regulation verankern – mehr Wahlfreiheit im Alltag. Veränderung wird nicht nur gedacht, sondern im Körper erlebt." 
    },
  ];
  
  return (
    <section aria-labelledby="how-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <h2 id="how-heading" className="text-2xl font-semibold">So funktioniert Körpertherapie</h2>
          <p className="mt-2 text-gray-600 max-w-3xl">Körpertherapie folgt einem sicheren, erprobten Prozess:</p>
          
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={i} className="shadow-sm opacity-0 translate-y-2 transition-all duration-500" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{s.icon}</div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
            <h3 className="font-medium text-slate-900 mb-2">Was passiert in einer Sitzung?</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Eine typische Sitzung (50–90 Min.) beginnt mit Ankommen und Orientierung, dann arbeiten wir sanft mit dem, 
              was im Körper spürbar ist. Es gibt kein &bdquo;Durcharbeiten&ldquo; von Trauma, sondern ein behutsames Begleiten natürlicher 
              Prozesse. Sie bestimmen das Tempo.
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
      id: "seriös", 
      question: "Ist Körpertherapie seriös oder esoterisch?", 
      answer: "Körpertherapie arbeitet mit gut erklärbaren, biologischen Mechanismen: Atmung, Orientierung, Schutzreflexe, Nervensystem-Regulation. Methoden wie Somatic Experiencing sind wissenschaftlich erforscht (z.B. RCT-Studien zu PTBS-Behandlung). Wir nutzen eine ruhige, professionelle Gestaltung und arbeiten evidenzbasiert – ohne Esoterik." 
    },
    { 
      id: "unterschied", 
      question: "Was ist der Unterschied zur Gesprächstherapie?", 
      answer: "Gespräche helfen zu verstehen und einzuordnen. Körpertherapie ergänzt dies um das direkte Spüren und Regulieren im Körper. So wird Veränderung nicht nur gedacht, sondern im Nervensystem erlebt und verankert. Beide Ansätze können sich hervorragend ergänzen." 
    },
    { 
      id: "wann-geeignet", 
      question: "Wann ist Körpertherapie besonders geeignet?", 
      answer: "Besonders hilfreich bei Trauma, chronischem Stress, Panik, somatischen Beschwerden ohne klare Ursache, emotionalen Blockaden oder wenn Gesprächstherapie allein nicht ausreicht. Auch präventiv zur Stress-Regulation sehr wertvoll." 
    },
    { 
      id: "anzahl", 
      question: "Wie viele Sitzungen brauche ich?", 
      answer: "Sehr individuell. Viele Menschen spüren erste Veränderungen nach 6–10 Sitzungen. Bei komplexen Themen entsprechend länger. Das Tempo und die Tiefe bestimmen Sie – es gibt keine Verpflichtung zu einem bestimmten Umfang." 
    },
    { 
      id: "berührung", 
      question: "Wird man bei Körpertherapie berührt?", 
      answer: "Das ist methodenabhängig und immer optional. Bei manchen Ansätzen kann achtsame, therapeutische Berührung hilfreich sein – aber nur mit Ihrer expliziten Zustimmung. Viele körpertherapeutische Prozesse funktionieren auch komplett ohne Berührung." 
    },
    { 
      id: "kasse", 
      question: "Übernimmt die Krankenkasse die Kosten?", 
      answer: "In der Regel nein. Die meisten körpertherapeutischen Verfahren werden nicht von gesetzlichen Krankenkassen übernommen. Private Kassen erstatten teilweise, abhängig vom Tarif und der Qualifikation der behandelnden Person. Wir arbeiten bewusst ohne Krankenkasse: keine Diagnosen in Ihrer Akte, hohe Vertraulichkeit und flexible Termine." 
    },
    {
      id: "methoden",
      question: "Welche körpertherapeutischen Methoden gibt es?",
      answer: "Zu den bekanntesten gehören Somatic Experiencing (SE), NARM (NeuroAffektives Beziehungsmodell), Hakomi, Core Energetics und sensorimotorische Psychotherapie. Jede hat eigene Schwerpunkte – unsere Therapeut:innen helfen Ihnen, die passende Methode zu finden."
    }
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Körpertherapie (körperorientierte Therapie)",
    url: `${baseUrl}/therapie`,
    description: "Körperorientierte Therapie zur Verbesserung der Selbstregulation durch Orientierung, Interozeption, Titration und Pendulation. Wissenschaftlich fundiert und ohne Esoterik.",
    sameAs: [
      "https://de.wikipedia.org/wiki/K%C3%B6rperpsychotherapie",
      "https://traumahealing.org/se-research-and-articles/"
    ],
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <LandingHero
          title="Körpertherapie – wenn Worte allein nicht reichen"
          subtitle={
            <span>
              Wissenschaftlich fundierte körperorientierte Therapie für Trauma, Stress und emotionale Blockaden. 
              <span className="block mt-2 text-base">Professionell, seriös und ohne Esoterik.</span>
            </span>
          }
          defaultSessionPreference="in_person"
          analyticsQualifier="koerpertherapie"
          formDataCta="koerpertherapie-page-signup"
        />

        <TrustSignals />

        <WhatIsKoerpertherapie />

        <section aria-labelledby="diff-heading" className="mt-12 sm:mt-16">
          <RevealContainer>
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
              <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
              <h2 id="diff-heading" className="text-2xl font-semibold">Gespräch vs. Körper: Der Unterschied</h2>
              <p className="mt-2 text-gray-600 max-w-3xl">
                Beide Ansätze sind wertvoll &ndash; und ergänzen sich ideal:
              </p>
              <MethodComparison
                leftTitle="Gesprächstherapie"
                rightTitle="+ Körperorientierte Verfahren"
                leftItems={[
                  "Verstehen & Einordnung",
                  "Muster, Gedanken, Biografie",
                  "Sprache als Hauptwerkzeug",
                  "Kognitive Umstrukturierung"
                ]}
                rightItems={[
                  "Spüren & Regulieren",
                  "Körperreaktionen, Haltung, Atem",
                  "Erlebte Veränderung im Moment",
                  "Nervensystem-basierte Integration"
                ]}
              />
              <p className="mt-4 text-sm text-gray-600 max-w-3xl">
                Körpertherapie arbeitet dort, wo Trauma und Stress <strong>im Nervensystem gespeichert</strong> sind &ndash; 
                oft jenseits der Reichweite von Worten allein.
              </p>
            </div>
          </RevealContainer>
        </section>

        <ForWhom />

        <HowItWorks />

        <section aria-labelledby="evidence-heading" className="mt-12 sm:mt-16">
          <RevealContainer>
            <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="evidence-heading" className="text-2xl font-semibold">Wissenschaftliche Grundlage</h2>
                  <p className="mt-2 text-gray-600 max-w-3xl">
                    Körpertherapie ist keine &bdquo;Alternativmedizin&ldquo;, sondern stützt sich auf evidenzbasiert erforschte Verfahren.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 mt-6">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Beispiel: Somatic Experiencing (SE)</h3>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">
                    Eine der bekanntesten körpertherapeutischen Methoden, entwickelt von Dr. Peter Levine. 
                    SE wurde in mehreren randomisierten kontrollierten Studien (RCTs) untersucht:
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Brom et al. (2017):</strong> RCT zu PTBS-Behandlung mit SE – signifikante Verbesserung der Symptome. 
                        <a className="ml-1 underline text-indigo-600" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5518443/" target="_blank" rel="noopener noreferrer">Volltext (PMC)</a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Heller et al. (2021):</strong> Übersichtsarbeit zur Wirksamkeit von SE mit Analyse der Schlüsselfaktoren. 
                        <a className="ml-1 underline text-indigo-600" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8276649/" target="_blank" rel="noopener noreferrer">Volltext (PMC)</a>
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Neurowissenschaftliche Basis</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Moderne Hirnforschung zeigt: Traumatische Erfahrungen werden im Nervensystem (limbisches System, Hirnstamm) 
                    gespeichert – oft ohne bewusste Erinnerung. Körpertherapie nutzt diesen direkten Zugang zum autonomen 
                    Nervensystem, um festgehaltene Reaktionen zu lösen.
                  </p>
                </div>
              </div>
            </div>
          </RevealContainer>
        </section>

        <PrivacySelfPaySection />

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

        <FinalCtaSection 
          heading="Bereit für körperorientierte Therapie?" 
          subtitle="Finden Sie eine:n qualifizierte:n Therapeut:in für Körpertherapie in Berlin – wissenschaftlich fundiert und professionell begleitet."
        />
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
