import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import FaqAccordion from "@/components/FaqAccordion";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { PrivacySelfPaySection } from "@/features/landing/components/PrivacySelfPaySection";
import FinalCtaSection from "@/features/landing/components/FinalCtaSection";
import { Heart, Users, Brain } from "lucide-react";
import RelatedTreatments from "@/features/therapy/components/RelatedTreatments";
import RevealContainer from "@/components/RevealContainer";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const variant = (searchParams?.v as string)?.toUpperCase();
  const isTestVariant = variant === 'B' || variant === 'C';
  const title = "NARM Therapie | Entwicklungstrauma heilen | NeuroAffektives Beziehungsmodell";
  const description = "NARM (NeuroAffektives Beziehungsmodell) für Entwicklungstrauma nach Dr. Laurence Heller. Ohne Retraumatisierung zu mehr Selbstregulation.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/therapie/narm` },
    robots: isTestVariant ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/therapie/narm`,
      type: "website",
      images: [
        { url: `${baseUrl}/images/color-patterns.png`, width: 1200, height: 630, alt: "Kaufmann Health – NARM Therapie" },
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

function PrinciplesGrid() {
  const items = [
    { icon: <Heart className="h-5 w-5" />, title: "Gegenwartsfokus", desc: "Nicht die Geschichte, sondern wie Sie Ihre Erfahrung jetzt organisieren." },
    { icon: <Users className="h-5 w-5" />, title: "Beziehungsorientiert", desc: "Heilung geschieht in Verbindung – therapeutisch und im Leben." },
    { icon: <Brain className="h-5 w-5" />, title: "Somatisch integriert", desc: "Bottom-up (Körper) und Top-down (Bewusstsein) vereint." },
  ];
  return (
    <section aria-labelledby="principles-heading" className="mt-12 sm:mt-16">
      <RevealContainer>
        <div className="relative rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500" data-reveal>
          <h2 id="principles-heading" className="text-2xl font-semibold">NARM-Prinzipien</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {items.map((it, i) => (
              <Card key={i} className="transition-all duration-200 opacity-0 translate-y-2" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{it.icon}</div>
                <CardTitle>{it.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{it.desc}</p>
              </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </RevealContainer>
    </section>
  );
}

export default async function NarmPage() {
  const faqs = [
    { id: "difference-se", question: "Was ist der Unterschied zwischen NARM und Somatic Experiencing?", answer: "SE fokussiert primär auf Schocktrauma und Nervensystem-Regulation. NARM spezialisiert sich auf Entwicklungstrauma und frühe Beziehungsprägungen. SE ist eher bottom-up (Körper → Bewusstsein), NARM integriert bottom-up und top-down (Bewusstsein → Körper) gleichwertig." },
    { id: "duration", question: "Wie lange dauert eine NARM-Therapie?", answer: "Entwicklungstrauma-Arbeit ist ein Prozess, kein Quick-Fix. Typische Therapien dauern 1–3 Jahre mit wöchentlichen oder zweiwöchentlichen Sitzungen. Erste Veränderungen sind oft schon nach Wochen spürbar – etwa mehr Erdung, weniger Selbstkritik." },
    { id: "childhood-memory", question: "Muss ich mich an meine Kindheit erinnern können?", answer: "Nein! Das ist das Revolutionäre an NARM: Sie müssen Ihre Geschichte nicht detailliert aufarbeiten. NARM arbeitet mit dem, was jetzt lebendig ist – Ihre Körperempfindungen, Beziehungsmuster, limitierende Überzeugungen." },
    { id: "retraumatisierung", question: "Ist NARM retraumatisierend?", answer: "NARM ist explizit nicht-retraumatisierend. Sie müssen Ihr Trauma nicht erneut durchleben. Der Fokus liegt auf dem Hier-und-Jetzt: Was spüren Sie gerade? Sie bleiben im Toleranzfenster Ihres Nervensystems." },
    { id: "vs-psychoanalyse", question: "Unterschied zur klassischen Psychoanalyse?", answer: "Psychoanalyse ist eher kognitiv und vergangenheitsorientiert. NARM integriert den Körper, arbeitet mit Ihrem Nervensystem im Moment und fokussiert auf gegenwärtige Beziehungs- und Selbstregulationsmuster." },
  ];

  const therapySchema = {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name: "NARM Therapie (NeuroAffektives Beziehungsmodell)",
    alternateName: "NARM",
    url: `${baseUrl}/therapie/narm`,
    description: "Ressourcenorientierter, körperbasierter Ansatz zur Heilung von Entwicklungstrauma",
    mainEntityOfPage: `${baseUrl}/therapie/narm`,
  } as const;

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">
        <LandingHero
          title="NARM Therapie"
          subtitle={<span>Entwicklungstrauma heilen – ressourcenorientiert, ohne Retraumatisierung. Das NeuroAffektive Beziehungsmodell (NARM™) nach Dr. Laurence Heller.</span>}
          formDataCta="narm-page-signup"
        />

        <section aria-labelledby="what-narm-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="what-narm-heading" className="text-2xl font-semibold">Was ist NARM?</h2>
            <p className="mt-3 text-gray-700 leading-7 max-w-4xl xl:max-w-5xl">
              Das NeuroAffektive Beziehungsmodell (NARM™) ist ein ressourcenorientierter, körperbasierter Ansatz zur Heilung von Entwicklungstrauma, entwickelt von Dr. Laurence Heller. Als ehemaliger Gestalt-Therapeut und Somatic Experiencing Trainer vereinte Heller somatische und psychodynamische Ansätze zu einer einzigartigen Methode.
            </p>
            <p className="mt-3 text-gray-700 leading-7 max-w-4xl xl:max-w-5xl">
              <strong>Der revolutionäre Ansatz:</strong> NARM arbeitet nicht mit der Trauma-Geschichte, sondern mit den gegenwärtigen Auswirkungen auf Ihre Selbstregulation und Identität. Statt zu fragen &ldquo;Was ist Ihnen passiert?&rdquo;, fragt NARM: &ldquo;Wie organisieren Sie Ihre Erfahrung jetzt?&rdquo;
            </p>
            <blockquote className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
              &bdquo;Es geht nicht darum, die Vergangenheit zu verändern – es geht darum, wie die Vergangenheit Ihre Gegenwart formt.&ldquo; – Dr. Laurence Heller
            </blockquote>
            <p className="mt-3 text-sm text-gray-700">
              Mehr Informationen bei <a href="https://drlaurenceheller.com/de/" className="underline" target="_blank" rel="noopener noreferrer">Dr. Laurence Heller</a>.
            </p>
          </div>
        </section>

        {/* SE process: Sicher und selbstreguliert */}
        <section aria-labelledby="process-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="process-heading" className="text-2xl font-semibold">Der SE‑Prozess: Sicher und selbstreguliert</h2>
            <h3 className="mt-4 text-xl font-semibold">Eine typische SE‑Sitzung</h3>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-700">
              <li><strong>Ankommen und Orientierung</strong> (5–10 Min.): Sich im Raum orientieren, Kontakt zum Hier und Jetzt.</li>
              <li><strong>Ressourcen etablieren</strong> (10–15 Min.): Sichere Körperempfindungen finden, positive Erinnerungen aktivieren.</li>
              <li><strong>Achtsame Annäherung</strong> (20–30 Min.): Langsames Berühren der Aktivierung, Tracking, Pendeln zwischen Aktivierung und Ressource.</li>
              <li><strong>Entladung und Integration</strong> (10–15 Min.): Natürliche Entladung (z. B. Zittern, Wärme), Neuverhandlung statt Wiederholung.</li>
              <li><strong>Stabilisierung</strong> (5–10 Min.): Zurück zu Ressourcen, Verankerung der neuen Erfahrung.</li>
            </ol>
            <p className="mt-2 text-sm text-gray-700"><strong>Wichtig:</strong> Kein Wiedererleben des Traumas – SE arbeitet mit der gefühlten Gegenwart.</p>
          </div>
        </section>

        {/* Suitability */}
        <section aria-labelledby="suitability-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="suitability-heading" className="text-2xl font-semibold">Für wen ist SE geeignet?</h2>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">Schocktrauma</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Unfälle (insb. Verkehr)</li>
                  <li>Stürze und Verletzungen</li>
                  <li>Medizinische Eingriffe/Operationen</li>
                  <li>Überfälle und Gewalt</li>
                  <li>Naturkatastrophen</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium">Entwicklungstrauma</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Frühe Vernachlässigung (ergänzend zu NARM)</li>
                  <li>Geburtstrauma</li>
                  <li>Frühe medizinische Traumata</li>
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-medium">Symptomkomplexe</h3>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                <li>PTBS, Panikattacken</li>
                <li>Chronische Schmerzen, Fibromyalgie</li>
                <li>Chronisches Erschöpfungssyndrom</li>
                <li>Schlafstörungen, Dissoziation</li>
              </ul>
            </div>
            <div className="mt-6">
              <h3 className="font-medium">Besondere Stärken von SE</h3>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                <li><strong>Keine Retraumatisierung:</strong> Durch Titration immer im sicheren Bereich</li>
                <li><strong>Ohne Geschichte:</strong> Trauma muss nicht verbal erzählt werden</li>
                <li><strong>Körperliche Symptome:</strong> Besonders wirksam bei somatischen Beschwerden</li>
                <li><strong>Schnelle Stabilisierung:</strong> Oft rasche Verbesserung der Selbstregulation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section aria-labelledby="comparison-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="comparison-heading" className="text-2xl font-semibold">SE vs. andere Traumatherapien</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="py-2 pr-4">Methode</th>
                    <th className="py-2 pr-4">Ansatz</th>
                    <th className="py-2">Besonders geeignet für</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">SE</td>
                    <td className="py-2 pr-4">Nervensystem‑Regulation</td>
                    <td className="py-2">Schocktrauma, somatische Symptome</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">EMDR</td>
                    <td className="py-2 pr-4">Bilaterale Stimulation</td>
                    <td className="py-2">PTBS mit klaren Erinnerungen</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">Trauma‑VT</td>
                    <td className="py-2 pr-4">Kognitive Umstrukturierung</td>
                    <td className="py-2">Wenn Denkmuster im Vordergrund</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">NARM</td>
                    <td className="py-2 pr-4">Entwicklungs‑/Beziehungsmuster</td>
                    <td className="py-2">Frühe Bindungstraumata</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm text-gray-700">SE kann hervorragend mit anderen Methoden kombiniert werden.</p>
          </div>
        </section>

        {/* Training */}
        <section aria-labelledby="training-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="training-heading" className="text-2xl font-semibold">Die SE‑Ausbildung: Höchste Standards</h2>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">Struktur</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Beginner I–II (je 4 Tage)</li>
                  <li>Intermediate I–III (je 4 Tage)</li>
                  <li>Advanced I–III (je 4 Tage)</li>
                  <li>18 Übungsgruppentreffen</li>
                  <li>12 Einzelsitzungen eigene SE‑Erfahrung</li>
                  <li>6 Supervisionssitzungen</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium">Anbieter & Zertifizierung</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Somatic Experiencing Deutschland e.V. (<a className="underline" href="https://somatic-experiencing.de" target="_blank" rel="noopener noreferrer">somatic-experiencing.de</a>)</li>
                  <li>Zertifizierung durch SE International</li>
                  <li>Geschützte Bezeichnung „SEP“ (SE Practitioner)</li>
                  <li>Kontinuierliche Fortbildung erforderlich</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Exercise */}
        <section aria-labelledby="exercise-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="exercise-heading" className="text-2xl font-semibold">SE‑Übung: Orientierung im Raum</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-700">
              <li><strong>Lass deinen Blick langsam wandern</strong> – ohne zu suchen, einfach schauen.</li>
              <li><strong>Folge deiner natürlichen Neugier</strong> – was zieht deine Aufmerksamkeit an?</li>
              <li><strong>Bewege dabei sanft den Kopf</strong> – spüre die Nackenbewegung.</li>
              <li><strong>Bemerke Veränderungen</strong> – Atmung? Entspannung? Gähnen?</li>
            </ol>
            <p className="mt-2 text-sm text-gray-700">Diese einfache Übung signalisiert Sicherheit und ist die Basis jeder SE‑Arbeit.</p>
          </div>
        </section>

        

        {/* Core concepts */}
        <section aria-labelledby="core-concepts-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="core-concepts-heading" className="text-2xl font-semibold">Die SE‑Kernkonzepte</h2>

            <h3 className="mt-4 text-xl font-semibold">1. Titration – Die Kunst der Dosierung</h3>
            <p className="mt-2 text-sm text-gray-700">Traumatische Aktivierung wird in kleinsten Einheiten bearbeitet – wie ein Tropfen Essenz in Wasser. Dies verhindert Überflutung und ermöglicht Integration.</p>
            <p className="mt-1 text-sm text-gray-700"><em>Beispiel:</em> Statt die ganze Unfallsituation zu aktivieren, nur die leichte Anspannung im Nacken spüren.</p>

            <h3 className="mt-5 text-xl font-semibold">2. Pendulation – Der natürliche Rhythmus</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>Von Aktivierung zu Beruhigung</li>
              <li>Von Kontraktion zu Expansion</li>
              <li>Von Dysregulation zu Regulation</li>
            </ul>

            <h3 className="mt-5 text-xl font-semibold">3. Ressourcenbildung</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>Körperliche Ressourcen: Orte der Ruhe im Körper</li>
              <li>Äußere Ressourcen: Positive Erinnerungen, Menschen</li>
              <li>Gegenwärtige Ressourcen: Sicherheit im Hier und Jetzt</li>
            </ul>

            <h3 className="mt-5 text-xl font-semibold">4. Felt Sense – Die Sprache des Körpers</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>Kribbeln, Wärme, Enge, Weite</li>
              <li>Bewegungsimpulse</li>
              <li>Subtile Veränderungen</li>
            </ul>
          </div>
        </section>

        {/* SIBAM model */}
        <section aria-labelledby="sibam-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="sibam-heading" className="text-2xl font-semibold">Das SIBAM‑Modell: Integration der Erfahrung</h2>
            <p className="mt-2 text-sm text-gray-700">Trauma fragmentiert unsere Erfahrung. SE integriert fünf Kanäle:</p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm text-gray-700">
              <li><strong>S – Sensation (Empfindung):</strong> Was spürst du gerade?</li>
              <li><strong>I – Image (Bild):</strong> Innere Bilder, Farben, Formen</li>
              <li><strong>B – Behavior (Verhalten):</strong> Bewegungsimpulse, Gesten, Haltungen</li>
              <li><strong>A – Affect (Affekt):</strong> Emotionen, die auftauchen dürfen</li>
              <li><strong>M – Meaning (Bedeutung):</strong> Gedanken und Interpretationen</li>
            </ul>
            <p className="mt-2 text-sm text-gray-700">Integration dieser Elemente = kohärente Erfahrung = Heilung.</p>
          </div>
        </section>

        {/* Principles grid (visual summary) */}
        <PrinciplesGrid />

        <PrivacySelfPaySection />

        {/* Related treatments (exclude current) */}
        <RelatedTreatments currentSlug="narm" />

        {/* Wissenschaftliche Quellen */}
        <section aria-labelledby="sources-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="sources-heading" className="text-2xl font-semibold">Wissenschaftliche Quellen</h2>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm text-gray-700">
              <li>Brom, D. et al. (2017). Somatic Experiencing for PTSD – randomized controlled outcome study. <em>Journal of Traumatic Stress, 30</em>(3).</li>
              <li>Andersen, T. E. et al. (2017). Brief SE für chronische Rückenschmerzen mit komorbider PTBS. <em>European Journal of Psychotraumatology, 8</em>(1).</li>
              <li>Levine, P. A. (2010). <em>In an Unspoken Voice</em>. North Atlantic Books.</li>
              <li>Porges, S. W. (2011). <em>The Polyvagal Theory</em>. W. W. Norton.</li>
            </ul>
          </div>
        </section>

        {/* Weiterführende Links */}
        <section aria-labelledby="links-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="links-heading" className="text-2xl font-semibold">Weiterführende Links</h2>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm text-gray-700">
              <li><a className="underline" href="https://traumahealing.org" target="_blank" rel="noopener noreferrer">SE International</a></li>
              <li><a className="underline" href="https://somatic-experiencing.de" target="_blank" rel="noopener noreferrer">Somatic Experiencing Deutschland e.V.</a></li>
              <li><a className="underline" href="https://www.peterllevine.com" target="_blank" rel="noopener noreferrer">Dr. Peter Levine – Bücher & Ressourcen</a></li>
            </ul>
          </div>
        </section>

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
          heading="Bereit, aus alten Mustern auszusteigen?"
          subtitle="NARM hilft Ihnen, von einem Leben des Überlebens zu einem Leben der Lebendigkeit zu finden. Unsere zertifizierten NARM-Therapeuten begleiten Sie dabei."
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
