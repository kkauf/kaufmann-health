import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import FinalCtaSection from "@/features/landing/components/FinalCtaSection";
import { Activity, Brain, ShieldCheck } from "lucide-react";
import RelatedTreatments from "@/features/therapy/components/RelatedTreatments";
import RevealContainer from "@/components/RevealContainer";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';
  const title = "Somatic Experiencing (SE)® | Traumatherapie nach Peter Levine | Berlin";
  const description = "Somatic Experiencing löst Trauma über das Nervensystem – sanft, sicher, evidenzbasiert. Finde zertifizierte SE‑Therapeut:innen.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/therapie/somatic-experiencing` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/therapie/somatic-experiencing`,
      siteName: "Kaufmann Health",
      locale: "de_DE",
      type: "website",
      images: [
        { url: `${baseUrl}/images/hero.jpg`, width: 1200, height: 630, alt: "Kaufmann Health – Somatic Experiencing" },
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
    { icon: <ShieldCheck className="h-5 w-5" />, title: "Sicher & sanft", desc: "Kein Nacherleben. Wir arbeiten ressourcenorientiert und dosiert." },
    { icon: <Brain className="h-5 w-5" />, title: "Körperbasiert", desc: "Interozeption, Orientierung, Schutzreflexe – der Körper zeigt den Weg." },
    { icon: <Activity className="h-5 w-5" />, title: "Biologisch vollständig", desc: "Unvollendete Reaktionen (Fight/Flight/Freeze) behutsam abschließen." },
  ];
  return (
    <section aria-labelledby="principles-heading" className="mt-14 sm:mt-20 lg:mt-24">
      <RevealContainer>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />
          <h2 id="principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">SE‑Prinzipien</h2>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-3">
            {items.map((it, i) => (
              <Card key={i} className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm w-fit">
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

export default async function SomaticExperiencingPage() {
  const faqs = [
    { id: "anzahl-sitzungen", question: "Wie viele Sitzungen brauche ich?", answer: "Bei Einzeltrauma oft 5–15 Sitzungen. Bei komplexeren Themen entsprechend länger. SE ist in der Regel kürzer als reine Gesprächstherapie." },
    { id: "muss-erzaehlen", question: "Muss ich mein Trauma erzählen?", answer: "Nein. SE arbeitet mit dem, was im Körper präsent ist (Felt Sense). Details sind häufig nicht nötig." },
    { id: "sicherheit", question: "Kann SE schaden?", answer: "Bei qualifizierten Praktiker:innen ist SE sehr sicher. Durch Titration bleiben wir im tolerierbaren Bereich und vermeiden Überforderung." },
    { id: "unterschied-koerpertherapie", question: "Unterschied zu allgemeiner Körpertherapie?", answer: "SE fokussiert spezifisch auf Trauma und Nervensystem‑Regulation – nicht auf allgemeine Körperarbeit." },
    { id: "beruehrung", question: "Werde ich berührt?", answer: "SE kann mit oder ohne Berührung praktiziert werden. Wenn Berührung, dann ausschließlich mit expliziter Zustimmung." },
    { id: "kostenuebernahme", question: "Kostenübernahme?", answer: "Private Kassen übernehmen teils. Gesetzliche Kassen nur, wenn die behandelnde Person approbiert ist. Viele SE‑Praktiker:innen arbeiten als Heilpraktiker." },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "Somatic Experiencing (SE)",
    url: `${baseUrl}/therapie/somatic-experiencing`,
    description: "Körperorientierte Traumatherapie zur Regulierung des Nervensystems durch Titration und Pendulation.",
    sameAs: ["https://traumahealing.org/"],
    mainEntityOfPage: `${baseUrl}/therapie/somatic-experiencing`,
    study: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC5518443/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC8276649/",
    ],
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <LandingHero
          title="Somatic Experiencing: Trauma lösen über das Nervensystem"
          subtitle={<span>Die wissenschaftlich fundierte Methode von Dr. Peter Levine – sanft, sicher und ohne Retraumatisierung.</span>}
          defaultSessionPreference="in_person"
          analyticsQualifier="se"
          formDataCta="se-page-signup"
        />

        <section aria-labelledby="what-se-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="what-se-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Was ist Somatic Experiencing?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700 max-w-4xl xl:max-w-5xl">
              Somatic Experiencing (SE)® ist eine körperorientierte Methode zur Auflösung von traumatischem Stress, entwickelt von Dr. Peter Levine über Jahrzehnte klinischer Arbeit und Forschung. Die Kernerkenntnis: Trauma ist keine Störung, sondern eine unvollständige biologische Reaktion, die im Nervensystem vollendet werden kann.
            </p>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-4xl xl:max-w-5xl">
              SE basiert auf der Beobachtung, dass wilde Tiere trotz ständiger Bedrohung selten traumatisiert sind. Sie verfügen über angeborene Mechanismen, um hohe Aktivierung zu entladen. Menschen haben diese Fähigkeit auch – sie muss nur wieder aktiviert werden.
            </p>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-4xl xl:max-w-5xl">
              SE‑Therapie arbeitet direkt mit dem <strong>Trauma des Nervensystems</strong>: über Körperwahrnehmung, Schutzreflexe und dosierte Entladung lernt dein System wieder flexible Regulation – sanft und sicher.
            </p>
            <blockquote className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 italic">
                &bdquo;Trauma entsteht nicht durch das Ereignis selbst, sondern wenn die mobilisierte Überlebensenergie nicht entladen werden kann und im Nervensystem gebunden bleibt.&ldquo; – Dr. Peter Levine
              </p>
            </blockquote>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Mehr Informationen bei <a href="https://traumahealing.org/" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">Somatic Experiencing® International</a>.
            </p>
          </div>
        </section>

        {/* SE process: Sicher und selbstreguliert */}
        <section aria-labelledby="process-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="process-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Der SE‑Prozess: Sicher und selbstreguliert</h2>
            <h3 className="mt-6 text-xl font-semibold text-gray-900">Eine typische SE‑Sitzung</h3>
            <ol className="mt-4 ml-4 list-decimal space-y-3 text-sm sm:text-base text-gray-700">
              <li><strong>Ankommen und Orientierung</strong> (5–10 Min.): Sich im Raum orientieren, Kontakt zum Hier und Jetzt.</li>
              <li><strong>Ressourcen etablieren</strong> (10–15 Min.): Sichere Körperempfindungen finden, positive Erinnerungen aktivieren.</li>
              <li><strong>Achtsame Annäherung</strong> (20–30 Min.): Langsames Berühren der Aktivierung, Tracking, Pendeln zwischen Aktivierung und Ressource.</li>
              <li><strong>Entladung und Integration</strong> (10–15 Min.): Natürliche Entladung (z. B. Zittern, Wärme), Neuverhandlung statt Wiederholung.</li>
              <li><strong>Stabilisierung</strong> (5–10 Min.): Zurück zu Ressourcen, Verankerung der neuen Erfahrung.</li>
            </ol>
            <p className="mt-4 text-sm sm:text-base text-gray-700"><strong>Wichtig:</strong> Kein Wiedererleben des Traumas – SE arbeitet mit der gefühlten Gegenwart.</p>
          </div>
        </section>

        {/* Suitability */}
        <section aria-labelledby="suitability-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <h2 id="suitability-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Für wen ist SE geeignet?</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Schocktrauma</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Unfälle (insb. Verkehr)</li>
                  <li>Stürze und Verletzungen</li>
                  <li>Medizinische Eingriffe/Operationen</li>
                  <li>Überfälle und Gewalt</li>
                  <li>Naturkatastrophen</li>
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Entwicklungstrauma</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Frühe Vernachlässigung (ergänzend zu NARM)</li>
                  <li>Geburtstrauma</li>
                  <li>Frühe medizinische Traumata</li>
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900">Symptomkomplexe</h3>
              <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                <li>PTBS, Panikattacken</li>
                <li>Chronische Schmerzen, Fibromyalgie</li>
                <li>Chronisches Erschöpfungssyndrom</li>
                <li>Schlafstörungen, Dissoziation</li>
              </ul>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900">Besondere Stärken von SE</h3>
              <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                <li><strong>Keine Retraumatisierung:</strong> Durch Titration immer im sicheren Bereich</li>
                <li><strong>Ohne Geschichte:</strong> Trauma muss nicht verbal erzählt werden</li>
                <li><strong>Körperliche Symptome:</strong> Besonders wirksam bei somatischen Beschwerden</li>
                <li><strong>Schnelle Stabilisierung:</strong> Oft rasche Verbesserung der Selbstregulation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section aria-labelledby="comparison-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="comparison-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">SE vs. andere Traumatherapien</h2>
            <div className="mt-6 overflow-x-auto">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-4 sm:p-6">
                <table className="w-full text-left text-sm sm:text-base text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="pb-3 pr-4 font-semibold">Methode</th>
                      <th className="pb-3 pr-4 font-semibold">Ansatz</th>
                      <th className="pb-3 font-semibold">Besonders geeignet für</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">SE</td>
                      <td className="py-3 pr-4">Nervensystem‑Regulation</td>
                      <td className="py-3">Schocktrauma, somatische Symptome</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">EMDR</td>
                      <td className="py-3 pr-4">Bilaterale Stimulation</td>
                      <td className="py-3">PTBS mit klaren Erinnerungen</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">Trauma‑VT</td>
                      <td className="py-3 pr-4">Kognitive Umstrukturierung</td>
                      <td className="py-3">Wenn Denkmuster im Vordergrund</td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-medium">NARM</td>
                      <td className="py-3 pr-4">Entwicklungs‑/Beziehungsmuster</td>
                      <td className="py-3">Frühe Bindungstraumata</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base text-gray-700">SE kann hervorragend mit anderen Methoden kombiniert werden.</p>
          </div>
        </section>

        {/* Training */}
        <section aria-labelledby="training-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="training-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Die SE‑Ausbildung: Höchste Standards</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Struktur</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Beginner I–II (je 4 Tage)</li>
                  <li>Intermediate I–III (je 4 Tage)</li>
                  <li>Advanced I–III (je 4 Tage)</li>
                  <li>18 Übungsgruppentreffen</li>
                  <li>12 Einzelsitzungen eigene SE‑Erfahrung</li>
                  <li>6 Supervisionssitzungen</li>
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Anbieter & Zertifizierung</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Somatic Experiencing Deutschland e.V. (<a className="underline text-indigo-600" href="https://somatic-experiencing.de" target="_blank" rel="noopener noreferrer">somatic-experiencing.de</a>)</li>
                  <li>Zertifizierung durch SE International</li>
                  <li>Geschützte Bezeichnung „SEP“ (SE Practitioner)</li>
                  <li>Kontinuierliche Fortbildung erforderlich</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Exercise */}
        <section aria-labelledby="exercise-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-green-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-emerald-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(16,185,129,0.09),transparent_65%)]" />
            <h2 id="exercise-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">SE‑Übung: Orientierung im Raum</h2>
            <ol className="mt-6 ml-4 list-decimal space-y-3 text-sm sm:text-base text-gray-700">
              <li><strong>Lass deinen Blick langsam wandern</strong> – ohne zu suchen, einfach schauen.</li>
              <li><strong>Folge deiner natürlichen Neugier</strong> – was zieht deine Aufmerksamkeit an?</li>
              <li><strong>Bewege dabei sanft den Kopf</strong> – spüre die Nackenbewegung.</li>
              <li><strong>Bemerke Veränderungen</strong> – Atmung? Entspannung? Gähnen?</li>
            </ol>
            <p className="mt-4 text-sm sm:text-base text-gray-700">Diese einfache Übung signalisiert Sicherheit und ist die Basis jeder SE‑Arbeit.</p>
          </div>
        </section>

        

        {/* Core concepts */}
        <section aria-labelledby="core-concepts-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="core-concepts-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Die SE‑Kernkonzepte</h2>

            <h3 className="mt-6 text-xl font-semibold text-gray-900">1. Titration – Die Kunst der Dosierung</h3>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-gray-700">Traumatische Aktivierung wird in kleinsten Einheiten bearbeitet – wie ein Tropfen Essenz in Wasser. Dies verhindert Überflutung und ermöglicht Integration.</p>
            <p className="mt-2 text-sm sm:text-base text-gray-700"><em>Beispiel:</em> Statt die ganze Unfallsituation zu aktivieren, nur die leichte Anspannung im Nacken spüren.</p>

            <h3 className="mt-6 text-xl font-semibold text-gray-900">2. Pendulation – Der natürliche Rhythmus</h3>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Von Aktivierung zu Beruhigung</li>
              <li>Von Kontraktion zu Expansion</li>
              <li>Von Dysregulation zu Regulation</li>
            </ul>

            <h3 className="mt-6 text-xl font-semibold text-gray-900">3. Ressourcenbildung</h3>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Körperliche Ressourcen: Orte der Ruhe im Körper</li>
              <li>Äußere Ressourcen: Positive Erinnerungen, Menschen</li>
              <li>Gegenwärtige Ressourcen: Sicherheit im Hier und Jetzt</li>
            </ul>

            <h3 className="mt-6 text-xl font-semibold text-gray-900">4. Felt Sense – Die Sprache des Körpers</h3>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Kribbeln, Wärme, Enge, Weite</li>
              <li>Bewegungsimpulse</li>
              <li>Subtile Veränderungen</li>
            </ul>
          </div>
        </section>

        {/* SIBAM model */}
        <section aria-labelledby="sibam-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="sibam-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Das SIBAM‑Modell: Integration der Erfahrung</h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-gray-700">Trauma fragmentiert unsere Erfahrung. SE integriert fünf Kanäle:</p>
            <ul className="mt-4 ml-4 list-disc space-y-3 text-sm sm:text-base text-gray-700">
              <li><strong>S – Sensation (Empfindung):</strong> Was spürst du gerade?</li>
              <li><strong>I – Image (Bild):</strong> Innere Bilder, Farben, Formen</li>
              <li><strong>B – Behavior (Verhalten):</strong> Bewegungsimpulse, Gesten, Haltungen</li>
              <li><strong>A – Affect (Affekt):</strong> Emotionen, die auftauchen dürfen</li>
              <li><strong>M – Meaning (Bedeutung):</strong> Gedanken und Interpretationen</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">Integration dieser Elemente = kohärente Erfahrung = Heilung.</p>
          </div>
        </section>

        {/* Principles grid (visual summary) */}
        <PrinciplesGrid />

        <PrivacySelfPaySection />

        {/* Related treatments (exclude current) */}
        <RelatedTreatments currentSlug="somatic-experiencing" />

        {/* Wissenschaftliche Quellen */}
        <section aria-labelledby="sources-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="sources-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wissenschaftliche Quellen</h2>
            <ul className="mt-6 ml-4 list-disc space-y-3 text-sm sm:text-base text-gray-700">
              <li>Brom, D. et al. (2017). Somatic Experiencing for PTSD – randomized controlled outcome study. <em>Journal of Traumatic Stress, 30</em>(3).</li>
              <li>Andersen, T. E. et al. (2017). Brief SE für chronische Rückenschmerzen mit komorbider PTBS. <em>European Journal of Psychotraumatology, 8</em>(1).</li>
              <li>Levine, P. A. (2010). <em>In an Unspoken Voice</em>. North Atlantic Books.</li>
              <li>Porges, S. W. (2011). <em>The Polyvagal Theory</em>. W. W. Norton.</li>
            </ul>
          </div>
        </section>

        {/* Weiterführende Links */}
        <section aria-labelledby="links-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="links-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Weiterführende Links</h2>
            <ul className="mt-6 ml-4 list-disc space-y-3 text-sm sm:text-base text-gray-700">
              <li><a className="underline text-indigo-600" href="https://traumahealing.org" target="_blank" rel="noopener noreferrer">SE International</a></li>
              <li><a className="underline text-indigo-600" href="https://somatic-experiencing.de" target="_blank" rel="noopener noreferrer">Somatic Experiencing Deutschland e.V.</a></li>
              <li><a className="underline text-indigo-600" href="https://www.peterllevine.com" target="_blank" rel="noopener noreferrer">Dr. Peter Levine – Bücher & Ressourcen</a></li>
            </ul>
          </div>
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

        <FinalCtaSection
          heading="Bereit für Nervensystem‑Regulation?"
          subtitle="SE ist die evidenzbasierte Wahl für Traumaheilung über den Körper. Unsere zertifizierten SE‑Praktiker:innen haben die komplette 3‑jährige Ausbildung absolviert."
          buttonLabel="Jetzt Therapeut:in finden"
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
