import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { Heart, Users, Brain, CheckCircle2, Wind } from "lucide-react";
import RevealContainer from "@/components/RevealContainer";
import { MODALITIES } from "@/features/therapies/modalityConfig";
import { HeroNoForm } from "@/features/landing/components/HeroNoForm";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

const modalityConfig = MODALITIES.hakomi;

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
          <h2 id="principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Hakomi-Prinzipien</h2>
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

export default async function HakomiPage() {
  const faqs = [
    { id: "difference-se", question: "Wie unterscheidet sich Hakomi von Somatic Experiencing?", answer: "SE fokussiert auf Trauma-Entladung im Nervensystem, Hakomi auf Erforschung unbewusster Überzeugungen durch Achtsamkeit. Beide sind körperorientiert, aber mit unterschiedlichem Fokus." },
    { id: "childhood-memory", question: "Muss ich über meine Kindheit sprechen?", answer: "Nein. Hakomi arbeitet mit dem, was jetzt im Körper präsent ist. Erinnerungen können auftauchen, müssen aber nicht verbal erzählt werden." },
    { id: "duration", question: "Wie lange dauert eine Hakomi-Therapie?", answer: "Hakomi ist ein Prozess ohne festgelegtes Ende. Viele Klient:innen berichten von spürbaren Veränderungen nach 10-20 Sitzungen, die Arbeit kann aber auch länger dauern." },
    { id: "achtsamkeit", question: "Muss ich Achtsamkeit können?", answer: "Nein. Der Therapeut führt Sie sanft in den Achtsamkeitszustand. Es ist ein natürlicher Zustand, den jeder Mensch kennt." },
    { id: "kosten", question: "Was kostet eine Hakomi-Sitzung?", answer: "Die meisten Hakomi-Therapeut:innen arbeiten privat. Rechnen Sie mit 80-120€ pro Sitzung. Manche Zusatzversicherungen übernehmen Anteile." },
    { id: "therapeut-finden", question: "Wie finde ich einen qualifizierten Hakomi-Therapeuten?", answer: "Achten Sie auf abgeschlossene Hakomi-Ausbildung. Unsere Therapeut:innen sind alle zertifiziert." },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Hakomi Therapie",
    alternateName: "Hakomi-Methode",
    url: `${baseUrl}/therapie/hakomi`,
    description: "Achtsamkeitsbasierte körperorientierte Psychotherapie zur Transformation unbewusster Überzeugungen",
    mainEntityOfPage: `${baseUrl}/therapie/hakomi`,
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <HeroNoForm
          title="Hakomi: Achtsamkeitsbasierte Körpertherapie"
          subtitle="Unbewusste Überzeugungen sanft erkunden und transformieren – mit Achtsamkeit, Gewaltlosigkeit und Loving Presence"
        />

        {/* Prominent Logo */}
        <div className="mt-8 sm:mt-12 flex justify-center">
          <div className="inline-flex items-center gap-4 rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 px-6 sm:px-8 py-4 sm:py-5 shadow-lg">
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 sm:p-4 text-emerald-600 shadow-sm">
              <Wind className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Hakomi</h1>
              <p className="text-sm sm:text-base text-emerald-700 font-medium">Achtsamkeitsbasierte Körpertherapie</p>
            </div>
          </div>
        </div>

        <section aria-labelledby="what-narm-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="what-hakomi-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Was ist Hakomi?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              Die Hakomi-Methode ist eine achtsamkeitsbasierte, körperorientierte Psychotherapie, entwickelt von Ron Kurtz in den 1970er Jahren. Der Name „Hakomi“ stammt aus der Hopi-Sprache und bedeutet: „Wie stehst du in Beziehung zu diesen vielen Welten?“
            </p>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              <strong>Der einzigartige Ansatz:</strong> Hakomi nutzt Achtsamkeit als Forschungswerkzeug. In einem Zustand entspannter innerer Aufmerksamkeit werden unbewusste Überzeugungen direkt erfahrbar – oft in Form von Körperempfindungen, Bildern oder spontanen Erinnerungen.
            </p>
            <blockquote className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 italic">
                &bdquo;Verändere das Bild, und du veränderst das Gefühl. Verändere das Gefühl, und du veränderst das Verhalten.&ldquo; – Ron Kurtz
              </p>
            </blockquote>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Mehr bei <a href="https://hakomi.de/" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">Hakomi Deutschland</a>.
            </p>
          </div>
        </section>

        {/* Die 5 Hakomi-Prinzipien */}
        <section aria-labelledby="core-principles-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="core-principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Die 5 Hakomi-Prinzipien</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              Hakomi basiert auf fünf ethischen und methodischen Grundprinzipien, die jede Sitzung prägen:
            </p>

            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">1. Achtsamkeit</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    Innere Aufmerksamkeit als Forschungswerkzeug – nicht analysieren, sondern beobachten, was auftaucht.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">2. Gewaltlosigkeit</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    Sanftes Erkunden ohne Druck – das System zeigt, was bereit ist, sich zu zeigen.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">3. Körper-Geist-Einheit</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    Überzeugungen leben im Körper – Veränderung geschieht durch verkörperte Erfahrung.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">4. Organische Prozesse</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    Vertrauen in die Selbstheilungskräfte – der Organismus weiß, was er braucht.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative bg-white/80 backdrop-blur-sm shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">5. Loving Presence</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-700">
                    Heilende Beziehung durch mitfühlende, nicht-wertende Präsenz des Therapeuten.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Wie funktioniert Hakomi? */}
        <section aria-labelledby="how-hakomi-works-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="how-hakomi-works-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wie funktioniert Hakomi?</h2>
            
            <h3 className="mt-6 sm:mt-8 text-xl font-semibold text-gray-900">Achtsamkeit als Forschungswerkzeug</h3>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              In Hakomi nutzen wir Achtsamkeit, um unbewusste Überzeugungen direkt zu erforschen. Im Zustand entspannter innerer Aufmerksamkeit werden kleine Experimente durchgeführt – &bdquo;Probes&ldquo; genannt:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Der Therapeut bietet eine Geste, einen Satz oder eine Berührung an</li>
              <li>Sie beobachten achtsam, was in Ihrem Körper geschieht</li>
              <li>Spontane Reaktionen zeigen unbewusste Überzeugungen</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              <strong>Beispiel:</strong> Der Therapeut sagt sanft: &bdquo;Du darfst hier sein.&ldquo; Sie spüren plötzlich Enge im Hals und Tränen. Die Überzeugung &bdquo;Ich bin eine Last&ldquo; wird spürbar.
            </p>

            <h3 className="mt-6 sm:mt-8 text-xl font-semibold text-gray-900">Der Hakomi-Prozess</h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">1. Kontakt herstellen</h4>
                <p className="text-sm sm:text-base text-gray-700">Sichere therapeutische Beziehung aufbauen</p>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">2. In Achtsamkeit gehen</h4>
                <p className="text-sm sm:text-base text-gray-700">Innere Aufmerksamkeit kultivieren</p>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">3. Experimente (Probes)</h4>
                <p className="text-sm sm:text-base text-gray-700">Unbewusste Überzeugungen erforschen</p>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">4. Transformation</h4>
                <p className="text-sm sm:text-base text-gray-700">Neue, heilende Erfahrungen verankern</p>
              </div>
            </div>
          </div>
        </section>

        {/* Für wen ist Hakomi besonders geeignet? */}
        <section aria-labelledby="suitability-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <h2 id="suitability-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Für wen ist Hakomi besonders geeignet?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">Besonders hilfreich bei:</p>

            <div className="mt-6 sm:mt-8 grid gap-3 sm:gap-4 sm:grid-cols-2">
              {[
                'Unbewusste Überzeugungen, die das Leben einschränken',
                'Wiederkehrende Beziehungsmuster',
                'Chronische Selbstkritik und Perfektionismus',
                'Schwierigkeiten mit Nähe und Intimität',
                'Psychosomatische Beschwerden',
                'Wunsch nach tiefem Selbstverständnis',
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
              Hakomi integriert verschiedene wissenschaftlich fundierte Ansätze:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li><strong>Achtsamkeitsforschung</strong>: Achtsamkeit als Werkzeug zur Selbsterkenntnis</li>
              <li><strong>Körperpsychotherapie</strong> (Reich, Lowen): Überzeugungen sind im Körper gespeichert</li>
              <li><strong>Systemtheorie</strong>: Selbstorganisierende Systeme und organische Prozesse</li>
              <li><strong>Bindungstheorie</strong>: Frühe Beziehungserfahrungen prägen Überzeugungen</li>
              <li><strong>Buddhistische Psychologie</strong>: Gewaltlosigkeit und mitfühlendes Gewahrsein</li>
            </ul>

            <h3 className="mt-8 text-xl font-semibold text-gray-900">Aktuelle Evidenzlage</h3>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              <strong>Transparenzhinweis:</strong> Hakomi selbst hat noch keine großen randomisierten Studien. Die Methode basiert auf:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>40+ Jahren klinischer Praxis und Fallstudien</li>
              <li>Integration evidenzbasierter Komponenten (Achtsamkeit, somatische Ansätze)</li>
              <li>Systematischer Ausbildung weltweit</li>
              <li>Positiven Erfahrungsberichten aus der Praxis</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Die einzelnen Komponenten von Hakomi (Achtsamkeit, Körperarbeit) sind gut erforscht. Spezifische Hakomi-Forschung ist in Planung.
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
            subtitle="Fülle unseren 5-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3 persönlich ausgewählte Hakomi-Therapeuten-Vorschläge."
            buttonLabel="Jetzt Therapeut:in finden"
            targetId="/fragebogen"
            align="center"
            variant="tinted"
            showAvailabilityNote={false}
            withEntryOptions={true}
            targetBasePath="/fragebogen"
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
