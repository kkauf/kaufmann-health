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
  const title = "NARM Therapie | Entwicklungstrauma sanft heilen";
  const description = "NARM (NeuroAffektives Beziehungsmodell) für Entwicklungstrauma nach Dr. Laurence Heller. Ohne Retraumatisierung zu mehr Selbstregulation. Therapeuten finden.";
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
    { id: "difference-se", question: "Wie unterscheidet sich NARM von Somatic Experiencing?", answer: "Während SE primär Schocktrauma behandelt, fokussiert NARM auf Entwicklungstrauma. SE arbeitet mit Entladung, NARM mit Organisation und Identität." },
    { id: "childhood-memory", question: "Muss ich über meine Kindheit sprechen?", answer: "Nein. NARM interessiert sich für Ihre gegenwärtigen Muster, nicht für detaillierte Geschichten." },
    { id: "duration", question: "Wie lange dauert eine NARM-Therapie?", answer: "NARM ist ein Prozess ohne festgelegtes Ende. Viele Klient:innen berichten von spürbaren Veränderungen nach 10-20 Sitzungen, die Arbeit kann aber auch länger dauern." },
    { id: "schocktrauma", question: "Ist NARM auch bei Schocktrauma wirksam?", answer: "NARM fokussiert auf Entwicklungstrauma. Bei PTBS von Einzelereignissen sind andere Methoden wie Somatic Experiencing oft geeigneter." },
    { id: "kosten", question: "Was kostet eine NARM-Sitzung?", answer: "Die meisten NARM-Therapeut:innen arbeiten privat. Rechnen Sie mit 80-120€ pro Sitzung. Manche Zusatzversicherungen übernehmen Anteile." },
    { id: "therapeut-finden", question: "Wie finde ich einen qualifizierten NARM-Therapeuten?", answer: "Achten Sie auf abgeschlossene NARM-Ausbildung (mind. 2 Jahre). Unsere Therapeut:innen sind alle zertifiziert." },
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
          title="NARM: Entwicklungstrauma heilen, ohne in die Vergangenheit zu gehen"
          subtitle={<span>Das NeuroAffektive Beziehungsmodell arbeitet mit dem, was jetzt ist – für Menschen, die funktionieren, aber nicht wirklich leben</span>}
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

        {/* Die 5 biologischen Überlebensstrategien */}
        <section aria-labelledby="survival-strategies-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="survival-strategies-heading" className="text-2xl font-semibold">Die 5 biologischen Überlebensstrategien</h2>
            <p className="mt-3 text-gray-700 leading-7">
              NARM identifiziert fünf Kernbedürfnisse, die für gesunde Entwicklung essentiell sind. Werden diese früh frustriert, entwickeln wir adaptive Überlebensstrategien, die uns später einschränken:
            </p>
            
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">1. Kontakt (Prä- und perinatal)</h3>
                <p className="mt-2 text-sm text-gray-700"><strong>Kernbedürfnis:</strong> In Kontakt sein mit sich selbst und anderen</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Wenn frustriert:</strong> &bdquo;Ich existiere nicht wirklich&ldquo;</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Adaptive Strategie:</strong> Rückzug, Dissoziation, Leben im Kopf</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Körperlich:</strong> Schwache Erdung, fragmentiertes Körpergefühl</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">2. Einstimmung (0-6 Monate)</h3>
                <p className="mt-2 text-sm text-gray-700"><strong>Kernbedürfnis:</strong> Physische und emotionale Bedürfnisse erfüllt bekommen</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Wenn frustriert:</strong> &bdquo;Meine Bedürfnisse zählen nicht&ldquo;</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Adaptive Strategie:</strong> Bedürfnislosigkeit, Abhängigkeit oder extreme Unabhängigkeit</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Körperlich:</strong> Probleme mit Hunger, Sättigung, Selbstfürsorge</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">3. Vertrauen (6-18 Monate)</h3>
                <p className="mt-2 text-sm text-gray-700"><strong>Kernbedürfnis:</strong> Gesunde Abhängigkeit und Vertrauen</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Wenn frustriert:</strong> &bdquo;Ich kann niemandem trauen&ldquo;</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Adaptive Strategie:</strong> Kontrolle, Manipulation oder Unterwerfung</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Körperlich:</strong> Chronische Muskelspannung, Hypervigilanz</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">4. Autonomie (18 Monate - 3 Jahre)</h3>
                <p className="mt-2 text-sm text-gray-700"><strong>Kernbedürfnis:</strong> Eigenen Willen ausdrücken ohne Liebesverlust</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Wenn frustriert:</strong> &bdquo;Ich darf nicht ich selbst sein&ldquo;</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Adaptive Strategie:</strong> Überanpassung, passive Aggression</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Körperlich:</strong> Gehaltene Wut im Körper, chronische Verspannungen</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">5. Liebe/Sexualität (3-6 Jahre und Pubertät)</h3>
                <p className="mt-2 text-sm text-gray-700"><strong>Kernbedürfnis:</strong> Offenes, liebevolles Herz mit integrierter Sexualität</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Wenn frustriert:</strong> &bdquo;Ich kann nicht gleichzeitig lieben und begehren&ldquo;</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Adaptive Strategie:</strong> Spaltung zwischen Herz und Sexualität</p>
                <p className="mt-1 text-sm text-gray-700"><strong>Körperlich:</strong> Trennung zwischen oberem und unterem Körper</p>
              </div>
            </div>
          </div>
        </section>

        {/* Wie funktioniert NARM? */}
        <section aria-labelledby="how-narm-works-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="how-narm-works-heading" className="text-2xl font-semibold">Wie funktioniert NARM?</h2>
            
            <h3 className="mt-6 text-xl font-semibold">Das Dual-Bewusstsein: Hier und Jetzt</h3>
            <p className="mt-3 text-gray-700 leading-7">
              NARM kultiviert ein &bdquo;duales Bewusstsein&ldquo; – die Fähigkeit, gleichzeitig wahrzunehmen:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>Was Sie gerade erleben (somatische Achtsamkeit)</li>
              <li>Wie Sie diese Erfahrung organisieren (Selbstbeobachtung)</li>
            </ul>
            <p className="mt-3 text-sm text-gray-700">
              <strong>Beispiel:</strong> Sie spüren Enge in der Brust (somatisch) und bemerken gleichzeitig: &bdquo;Ah, ich ziehe mich gerade zurück, wie immer wenn jemand mir nahekommt&ldquo; (Organisation).
            </p>

            <h3 className="mt-6 text-xl font-semibold">Top-Down und Bottom-Up Integration</h3>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <h4 className="font-semibold text-gray-900">Bottom-Up (Körper → Bewusstsein):</h4>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Somatische Achtsamkeit für Körperempfindungen</li>
                  <li>Verfolgung von Impulsen und Bewegungen</li>
                  <li>Nervensystem-Regulation durch Atmung und Erdung</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Top-Down (Bewusstsein → Körper):</h4>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Erkennen limitierender Identifikationen (&bdquo;Ich bin halt so&ldquo;)</li>
                  <li>Arbeit mit Scham und Selbsthass</li>
                  <li>Infragestellen alter Überzeugungen</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* NARM-Prozess */}
        <section aria-labelledby="process-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="process-heading" className="text-2xl font-semibold">Der NARM-Prozess: Sanft und tiefgreifend</h2>
            <h3 className="mt-4 text-xl font-semibold">Eine typische NARM-Sitzung</h3>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-700">
              <li><strong>Ankommen im Jetzt</strong> (5–10 Min.): Was ist gerade präsent? Körperliche Empfindungen wahrnehmen</li>
              <li><strong>Erkundung der Organisation</strong> (20–30 Min.): Wie organisieren Sie diese Erfahrung? Welche alten Muster werden sichtbar?</li>
              <li><strong>Somatische Begleitung</strong> (10–15 Min.): Verfolgen von Körperempfindungen, Unterstützung der Selbstregulation</li>
              <li><strong>Reflexion und Integration</strong> (10–15 Min.): Was wird möglich, wenn das alte Muster sich löst? Verankerung neuer Erfahrungen</li>
            </ol>
            <p className="mt-3 text-sm text-gray-700"><strong>Wichtig:</strong> Sie müssen Ihre Kindheit nicht detailliert aufarbeiten. NARM arbeitet mit dem, was jetzt lebendig ist.</p>
          </div>
        </section>

        {/* Für wen ist NARM besonders geeignet? */}
        <section aria-labelledby="suitability-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="suitability-heading" className="text-2xl font-semibold">Für wen ist NARM besonders geeignet?</h2>
            <p className="mt-3 text-gray-700 leading-7">
              NARM ist ideal für &bdquo;hochfunktionale&ldquo; Menschen mit Entwicklungstrauma:
            </p>
            <ul className="mt-3 ml-4 space-y-2 text-sm text-gray-700">
              <li>✓ Sie sind nach außen erfolgreich, fühlen sich innerlich aber leer</li>
              <li>✓ Beziehungen sind schwierig – zu nah oder zu distanziert</li>
              <li>✓ Chronische Selbstkritik und das Gefühl &bdquo;nicht gut genug&ldquo; zu sein</li>
              <li>✓ Das Leben fühlt sich an wie eine Performance, nicht authentisch</li>
              <li>✓ Emotionale Dysregulation trotz kognitiven Verstehens</li>
              <li>✓ Psychosomatische Beschwerden ohne medizinische Ursache</li>
            </ul>
          </div>
        </section>

        {/* Wissenschaftlicher Hintergrund */}
        <section aria-labelledby="scientific-basis-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="scientific-basis-heading" className="text-2xl font-semibold">Wissenschaftlicher Hintergrund</h2>
            
            <h3 className="mt-4 text-xl font-semibold">Theoretische Fundierung</h3>
            <p className="mt-3 text-gray-700 leading-7">
              NARM integriert verschiedene wissenschaftlich fundierte Ansätze:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li><strong>Bindungstheorie</strong> (Bowlby, Ainsworth): Frühe Beziehungsmuster prägen</li>
              <li><strong>Interpersonelle Neurobiologie</strong> (Siegel): Beziehungen formen das Gehirn</li>
              <li><strong>Polyvagal-Theorie</strong> (Porges): Nervensystem und soziale Verbindung</li>
              <li><strong>Affektregulationstheorie</strong> (Schore): Rechte Gehirnhälfte und Emotionsregulation</li>
              <li><strong>Somatische Therapieansätze</strong>: Körper als Ressource für Heilung</li>
            </ul>

            <h3 className="mt-6 text-xl font-semibold">Aktuelle Evidenzlage</h3>
            <p className="mt-3 text-sm text-gray-700">
              <strong>Transparenzhinweis:</strong> NARM selbst hat noch keine randomisierten kontrollierten Studien. Die Methode basiert auf:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
              <li>15+ Jahren klinischer Praxis und Fallstudien</li>
              <li>Integration evidenzbasierter Komponenten (Achtsamkeit, somatische Ansätze)</li>
              <li>Systematischer Ausbildung mit über 2000 Therapeut:innen weltweit</li>
              <li>Positiven Erfahrungsberichten aus der Praxis</li>
            </ul>
            <p className="mt-3 text-sm text-gray-700">
              Die einzelnen Komponenten von NARM (somatische Achtsamkeit, Bindungsarbeit) sind gut erforscht. Spezifische NARM-Forschung ist in Planung.
            </p>
          </div>
        </section>

        {/* NARM-Ausbildung */}
        <section aria-labelledby="training-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="training-heading" className="text-2xl font-semibold">NARM-Ausbildung in Deutschland</h2>
            <p className="mt-3 text-gray-700 leading-7">
              Die 3-jährige NARM-Ausbildung (720 Stunden) wird angeboten von:
            </p>
            
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">UTA Akademie Köln</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>4 Module à 5 Tage pro Jahr</li>
                  <li>Direkte Supervision durch Senior-Trainer</li>
                  <li><a href="https://uta-akademie.de" className="underline" target="_blank" rel="noopener noreferrer">www.uta-akademie.de</a></li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">NARM Training Institute</h3>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm text-gray-700">
                  <li>Internationale Ausbildungen</li>
                  <li>Online- und Präsenzmodule</li>
                  <li><a href="https://narmtraining.com" className="underline" target="_blank" rel="noopener noreferrer">www.narmtraining.com</a></li>
                </ul>
              </div>
            </div>
            
            <p className="mt-4 text-sm text-gray-700">
              <strong>Voraussetzung:</strong> Psychotherapeutische oder beratende Grundausbildung
            </p>
          </div>
        </section>

        {/* Principles grid (visual summary) */}
        <PrinciplesGrid />

        <PrivacySelfPaySection />

        {/* Related treatments (exclude current) */}
        <RelatedTreatments currentSlug="narm" />


        {/* Weiterführende Links */}
        <section aria-labelledby="links-heading" className="mt-12 sm:mt-16">
          <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
            <h2 id="links-heading" className="text-2xl font-semibold">Weiterführende Links</h2>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm text-gray-700">
              <li><a className="underline" href="https://drlaurenceheller.com/de/" target="_blank" rel="noopener noreferrer">NARM auf Deutsch – Laurence Heller</a></li>
              <li><a className="underline" href="https://www.kosel.de/buecher/entwicklungstrauma-heilen" target="_blank" rel="noopener noreferrer">Buch: „Entwicklungstrauma heilen“ – Heller & LaPierre</a></li>
              <li>Andere Methoden: <a className="underline" href="/therapie/somatic-experiencing">Somatic Experiencing</a></li>
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
          subtitle="NARM hilft Ihnen, von einem Leben des Überlebens zu einem Leben der Lebendigkeit zu finden. Unsere zertifizierten NARM-Therapeut:innen begleiten Sie dabei."
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
