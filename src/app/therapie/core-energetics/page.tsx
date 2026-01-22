import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { Heart, Users, Brain, CheckCircle2, Target } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";
import { MODALITIES } from "@/features/therapies/modalityConfig";
import { HeroNoForm } from "@/features/landing/components/HeroNoForm";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

const modalityConfig = MODALITIES['core-energetics'];

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';
  const title = modalityConfig.metaTitle;
  const description = modalityConfig.metaDescription;
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/therapie/${modalityConfig.slug}` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/therapie/${modalityConfig.slug}`,
      siteName: "Kaufmann Health",
      locale: "de_DE",
      type: "website",
      images: [
        { url: `${baseUrl}/images/hero.jpg`, width: 1200, height: 630, alt: `Kaufmann Health – ${modalityConfig.name}` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}/images/hero.jpg`],
    },
  };
};

function PrinciplesGrid() {
  const items = [
    { icon: <Heart className="h-5 w-5" />, title: "Gegenwartsfokus", desc: "Nicht die Geschichte, sondern wie Sie Ihre Erfahrung jetzt organisieren." },
    { icon: <Users className="h-5 w-5" />, title: "Beziehungsorientiert", desc: "Heilung geschieht in Verbindung – therapeutisch und im Leben." },
    { icon: <Brain className="h-5 w-5" />, title: "Somatisch integriert", desc: "Bottom-up (Körper) und Top-down (Bewusstsein) vereint." },
  ];
  return (
    <section aria-labelledby="principles-heading" className="mt-14 sm:mt-20 lg:mt-24">
      <RevealContainer>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />
          <h2 id="principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Core Energetics Prinzipien</h2>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-3">
            {items.map((it, i) => (
              <Card key={i} className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
                  {it.icon}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{it.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

export default async function CoreEnergeticsPage() {
  const faqs = [
    { id: "difference-bioenergetik", question: "Wie unterscheidet sich Core Energetics von Bioenergetik?", answer: "Core Energetics erweitert Bioenergetik um die spirituelle Dimension und die Arbeit mit dem 'Core' (authentisches Selbst). Beide arbeiten mit Körperpanzerung, aber CE integriert mehr Ebenen." },
    { id: "intensity", question: "Ist Core Energetics sehr intensiv?", answer: "Ja. CE arbeitet aktiv mit Körper und Emotionen. Es kann intensiv sein, wird aber immer an dein Tempo angepasst." },
    { id: "duration", question: "Wie lange dauert eine Core Energetics Therapie?", answer: "CE ist ein Prozess ohne festgelegtes Ende. Viele Klient:innen berichten von spürbaren Veränderungen nach 15-30 Sitzungen, tiefgreifende Charakterarbeit kann länger dauern." },
    { id: "physical", question: "Muss ich körperlich fit sein?", answer: "Nein. Die Übungen werden an deine Möglichkeiten angepasst. Wichtiger ist die Bereitschaft, mit dem Körper zu arbeiten." },
    { id: "kosten", question: "Was kostet eine Core Energetics Sitzung?", answer: "Die meisten CE-Therapeut:innen arbeiten privat. Rechnen mit 80-120€ pro Sitzung. Manche Zusatzversicherungen übernehmen Anteile." },
    { id: "therapeut-finden", question: "Wie finde ich einen qualifizierten Core Energetics Therapeuten?", answer: "Achte auf abgeschlossene Core Energetics Ausbildung. Unsere Therapeut:innen sind alle zertifiziert." },
    { id: "privacy", question: "Wird die Psychotherapie bei meiner Krankenkasse dokumentiert?", answer: "Nein. Es erfolgt keine Kassenabrechnung, kein Eintrag in deiner Krankenakte und keine ICD-10-Diagnose bei der Kasse." },
    { id: "speed", question: "Wie schnell bekomme ich Vorschläge?", answer: "Du erhältst sofort passende Therapeut:innen-Vorschläge basierend auf deinen Angaben. Termine sind in der Regel noch diese Woche möglich." },
    { id: "why-body", question: "Warum Körperpsychotherapie?", answer: "Viele Menschen verstehen ihre Probleme bereits – sie wissen, woher ihre Ängste kommen. Aber Verstehen allein führt nicht zu Veränderung. Trauma und festgefahrene Reaktionen leben im Nervensystem. Körperpsychotherapie arbeitet direkt mit dem Körper, um diese Muster zu lösen." },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Core Energetics Therapie",
    url: `${baseUrl}/therapie/core-energetics`,
    description: "Tiefenpsychologische körperorientierte Therapie nach John Pierrakos zur Charakterarbeit",
    mainEntityOfPage: `${baseUrl}/therapie/core-energetics`,
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <HeroNoForm
          title="Core Energetics"
          subtitle="Tiefenpsychologische Körpertherapie nach John Pierrakos – Körper, Emotionen und spirituelle Dimension integrieren"
          noBackground
          valueProps={[]}
          icon={
            <div className="inline-flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 p-3 sm:p-4 text-fuchsia-600 shadow-sm">
                <Target className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
              </div>
            </div>
          }
        />

        <section aria-labelledby="what-core-energetics-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="what-core-energetics-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Was ist Core Energetics?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              Core Energetics ist eine tiefenpsychologische, körperorientierte Therapiemethode, entwickelt von Dr. John Pierrakos in den 1970er Jahren. Sie integriert Körperarbeit, emotionale Prozessarbeit und spirituelle Dimensionen zu einem ganzheitlichen Ansatz.
            </p>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              <strong>Der ganzheitliche Ansatz:</strong> Core Energetics arbeitet mit Charakterstrukturen, Körperpanzerung und energetischen Blockaden. Ziel ist es, den freien Fluss der Lebensenergie wiederherzustellen und das authentische Selbst (den &bdquo;Core&ldquo;) zu befreien.
            </p>
            <blockquote className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 italic">
                &bdquo;Der Weg zur Freiheit führt durch den Körper.&ldquo; – John Pierrakos
              </p>
            </blockquote>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Mehr bei <a href="https://www.core-energetics.org/" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">Core Energetics Institute</a>.
            </p>
          </div>
        </section>

        {/* Die 5 Charakterstrukturen */}
        <section aria-labelledby="character-structures-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="character-structures-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Die 5 Charakterstrukturen</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              Core Energetics arbeitet mit fünf grundlegenden Charakterstrukturen nach Wilhelm Reich und Alexander Lowen. Jede Struktur zeigt sich in Körperhaltung, Atmung und Energiefluss:
            </p>

            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">1. Schizoide Struktur</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    <strong>Thema:</strong> Existenzrecht<br/>
                    <strong>Körper:</strong> Fragmentiert, schwache Erdung<br/>
                    <strong>Energie:</strong> Zurückgezogen, im Kopf
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">2. Orale Struktur</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    <strong>Thema:</strong> Bedürftigkeit<br/>
                    <strong>Körper:</strong> Unterentwickelt, kollabiert<br/>
                    <strong>Energie:</strong> Mangel, Abhängigkeit
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">3. Masochistische Struktur</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    <strong>Thema:</strong> Autonomie vs. Unterwerfung<br/>
                    <strong>Körper:</strong> Kompakt, gehaltene Spannung<br/>
                    <strong>Energie:</strong> Blockiert, nach innen gerichtet
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">4. Psychopathische Struktur</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    <strong>Thema:</strong> Macht und Kontrolle<br/>
                    <strong>Körper:</strong> Aufgeblasen, Kopf-Körper-Spaltung<br/>
                    <strong>Energie:</strong> Nach oben verschoben
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">5. Rigide Struktur</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    <strong>Thema:</strong> Liebe und Sexualität<br/>
                    <strong>Körper:</strong> Steif, Herz-Becken-Spaltung<br/>
                    <strong>Energie:</strong> Gebunden, kontrolliert
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Wie funktioniert Core Energetics? */}
        <section aria-labelledby="how-ce-works-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="how-ce-works-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wie funktioniert Core Energetics?</h2>
            
            <h3 className="mt-6 sm:mt-8 text-xl font-semibold text-gray-900">Die drei Ebenen der Persönlichkeit</h3>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              Core Energetics arbeitet mit drei Schichten:
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">1. Maske (außen)</h4>
                <p className="text-sm sm:text-base text-gray-700">Soziale Fassade, wie wir uns zeigen</p>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">2. Niederes Selbst (Mitte)</h4>
                <p className="text-sm sm:text-base text-gray-700">Blockierte Emotionen, Wut, Angst, Scham</p>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">3. Core (innen)</h4>
                <p className="text-sm sm:text-base text-gray-700">Authentisches Selbst, Lebenskraft, Liebe</p>
              </div>
            </div>

            <h3 className="mt-8 text-xl font-semibold text-gray-900">Energiearbeit und Körperpanzerung</h3>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Core Energetics löst chronische Muskelverspannungen (&bdquo;Panzerung&ldquo;) durch:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Atemarbeit zur Energetisierung</li>
              <li>Körperübungen zum Ausdruck blockierter Emotionen</li>
              <li>Erdungsarbeit für Stabilität</li>
              <li>Berührung zur Unterstützung des Prozesses</li>
            </ul>
          </div>
        </section>

        {/* Core Energetics Prozess */}
        <section aria-labelledby="process-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="process-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Der Core Energetics Prozess</h2>
            <h3 className="mt-6 text-xl font-semibold text-gray-900">Eine typische Sitzung</h3>
            <ol className="mt-4 ml-4 list-decimal space-y-3 text-sm sm:text-base text-gray-700">
              <li><strong>Ankommen und Erdung</strong> (10 Min.): Körperkontakt herstellen, Atmung vertiefen</li>
              <li><strong>Energetisierung</strong> (15 Min.): Durch Bewegung und Atmung Energie mobilisieren</li>
              <li><strong>Emotionale Prozessarbeit</strong> (20 Min.): Blockierte Gefühle ausdrücken (Wut, Trauer, Angst)</li>
              <li><strong>Integration und Core-Kontakt</strong> (15 Min.): Zum authentischen Selbst durchdringen, neue Erfahrung verankern</li>
            </ol>
            <p className="mt-4 text-sm sm:text-base text-gray-700"><strong>Wichtig:</strong> Core Energetics ist aktiv und intensiv. Sie arbeiten nicht nur verbal, sondern mit dem ganzen Körper.</p>
          </div>
        </section>

        {/* Für wen ist Core Energetics besonders geeignet? */}
        <section aria-labelledby="suitability-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <h2 id="suitability-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Für wen ist Core Energetics besonders geeignet?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">Besonders hilfreich bei:</p>

            <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2">
              {[
                'Chronisch gehaltene Emotionen (Wut, Trauer, Angst)',
                'Körperpanzerung und chronische Verspannungen',
                'Schwierigkeiten mit Selbstausdruck und Authentizität',
                'Charaktermuster, die das Leben einschränken',
                'Wunsch nach tiefgreifender Transformation',
                'Bereitschaft für intensive, aktive Körperarbeit',
              ].map((text, i) => (
                <div key={i} className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 sm:p-4 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 font-medium leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Wissenschaftlicher Hintergrund */}
        <section aria-labelledby="scientific-basis-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="scientific-basis-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wissenschaftlicher Hintergrund</h2>
            
            <h3 className="mt-6 text-xl font-semibold text-gray-900">Theoretische Fundierung</h3>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              Core Energetics integriert verschiedene wissenschaftlich fundierte Ansätze:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li><strong>Charakteranalyse</strong> (Wilhelm Reich): Körperpanzerung und Charakterstrukturen</li>
              <li><strong>Bioenergetik</strong> (Alexander Lowen): Energiefluss und Körperarbeit</li>
              <li><strong>Tiefenpsychologie</strong> (Jung, Freud): Unbewusstes und Persönlichkeitsschichten</li>
              <li><strong>Spirituelle Psychologie</strong> (Pathwork): Integration der spirituellen Dimension</li>
              <li><strong>Emotionsfokussierte Therapie</strong>: Arbeit mit blockierten Gefühlen</li>
            </ul>

            <h3 className="mt-8 text-xl font-semibold text-gray-900">Aktuelle Evidenzlage</h3>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              <strong>Transparenzhinweis:</strong> Core Energetics selbst hat noch keine großen randomisierten Studien. Die Methode basiert auf:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>50+ Jahren klinischer Praxis und Fallstudien</li>
              <li>Integration evidenzbasierter Komponenten (Körperarbeit, Emotionsregulation)</li>
              <li>Systematischer Ausbildung weltweit</li>
              <li>Positiven Erfahrungsberichten aus der Praxis</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Die einzelnen Komponenten (Atemarbeit, Körperarbeit, Emotionsausdruck) sind gut erforscht. Spezifische Core Energetics Forschung ist in Planung.
            </p>
          </div>
        </section>

        {/* Principles grid (visual summary) */}
        <PrinciplesGrid />

        {/* Therapist showcase for this modality */}
        <section className="mt-14 sm:mt-20 lg:mt-24">
          <TherapistTeaserSection
            title={modalityConfig.therapistSectionTitle}
            subtitle={modalityConfig.therapistSectionSubtitle}
            filters={modalityConfig.therapistFilter}
            limit={3}
            showViewAllButton={true}
            viewAllButtonText="Alle Therapeut:innen ansehen"
            viewAllButtonHref={`/therapeuten${modalityConfig.directoryFilterParams}`}
          />
        </section>

        <section aria-labelledby="faq-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <RevealContainer>
            <div className="opacity-0 translate-y-2 transition-all duration-500" data-reveal>
              <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
              <div className="mt-6 sm:mt-8">
                <FaqAccordion items={faqs} />
              </div>
            </div>
          </RevealContainer>
        </section>

        <div className="mt-14 sm:mt-20 lg:mt-24">
          <FinalCtaSection
            heading="Bereit für den ersten Schritt?"
            subtitle="Fülle unseren 5-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte Core Energetics Therapeuten-Vorschläge."
            buttonLabel="Jetzt Therapeut:in finden"
            targetId="/fragebogen"
            align="center"
            variant="tinted"
            showAvailabilityNote={false}
          />
        </div>
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
