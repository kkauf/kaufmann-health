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
      siteName: "Kaufmann Health",
      locale: "de_DE",
      type: "website",
      images: [
        { url: `${baseUrl}/images/hero.jpg`, width: 1200, height: 630, alt: "Kaufmann Health – NARM Therapie" },
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
          <h2 id="principles-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">NARM-Prinzipien</h2>
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

        <section aria-labelledby="what-narm-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="what-narm-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Was ist NARM?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700 max-w-4xl xl:max-w-5xl">
              Das NeuroAffektive Beziehungsmodell (NARM™) ist ein ressourcenorientierter, körperbasierter Ansatz zur Heilung von Entwicklungstrauma, entwickelt von Dr. Laurence Heller. Als ehemaliger Gestalt-Therapeut und Somatic Experiencing Trainer vereinte Heller somatische und psychodynamische Ansätze zu einer einzigartigen Methode.
            </p>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-4xl xl:max-w-5xl">
              <strong>Der revolutionäre Ansatz:</strong> NARM arbeitet nicht mit der Trauma-Geschichte, sondern mit den gegenwärtigen Auswirkungen auf Ihre Selbstregulation und Identität. Statt zu fragen &ldquo;Was ist Ihnen passiert?&rdquo;, fragt NARM: &ldquo;Wie organisieren Sie Ihre Erfahrung jetzt?&rdquo;
            </p>
            <blockquote className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
              <p className="text-sm sm:text-base leading-relaxed text-gray-700 italic">
                &bdquo;Es geht nicht darum, die Vergangenheit zu verändern – es geht darum, wie die Vergangenheit Ihre Gegenwart formt.&ldquo; – Dr. Laurence Heller
              </p>
            </blockquote>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Mehr Informationen bei <a href="https://drlaurenceheller.com/de/" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">Dr. Laurence Heller</a>.
            </p>
          </div>
        </section>

        {/* Die 5 biologischen Überlebensstrategien */}
        <section aria-labelledby="survival-strategies-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="survival-strategies-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Die 5 biologischen Überlebensstrategien</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              NARM identifiziert fünf Kernbedürfnisse, die für gesunde Entwicklung essentiell sind. Werden diese früh frustriert, entwickeln wir adaptive Überlebensstrategien, die uns später einschränken:
            </p>
            
            <div className="mt-8 sm:mt-10 space-y-6 sm:space-y-8">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">1. Kontakt (Prä- und perinatal)</h3>
                <div className="mt-3 sm:mt-4 space-y-2 text-sm sm:text-base text-gray-700">
                  <p><strong>Kernbedürfnis:</strong> In Kontakt sein mit sich selbst und anderen</p>
                  <p><strong>Wenn frustriert:</strong> &bdquo;Ich existiere nicht wirklich&ldquo;</p>
                  <p><strong>Adaptive Strategie:</strong> Rückzug, Dissoziation, Leben im Kopf</p>
                  <p><strong>Körperlich:</strong> Schwache Erdung, fragmentiertes Körpergefühl</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">2. Einstimmung (0-6 Monate)</h3>
                <div className="mt-3 sm:mt-4 space-y-2 text-sm sm:text-base text-gray-700">
                  <p><strong>Kernbedürfnis:</strong> Physische und emotionale Bedürfnisse erfüllt bekommen</p>
                  <p><strong>Wenn frustriert:</strong> &bdquo;Meine Bedürfnisse zählen nicht&ldquo;</p>
                  <p><strong>Adaptive Strategie:</strong> Bedürfnislosigkeit, Abhängigkeit oder extreme Unabhängigkeit</p>
                  <p><strong>Körperlich:</strong> Probleme mit Hunger, Sättigung, Selbstfürsorge</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">3. Vertrauen (6-18 Monate)</h3>
                <div className="mt-3 sm:mt-4 space-y-2 text-sm sm:text-base text-gray-700">
                  <p><strong>Kernbedürfnis:</strong> Gesunde Abhängigkeit und Vertrauen</p>
                  <p><strong>Wenn frustriert:</strong> &bdquo;Ich kann niemandem trauen&ldquo;</p>
                  <p><strong>Adaptive Strategie:</strong> Kontrolle, Manipulation oder Unterwerfung</p>
                  <p><strong>Körperlich:</strong> Chronische Muskelspannung, Hypervigilanz</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">4. Autonomie (18 Monate - 3 Jahre)</h3>
                <div className="mt-3 sm:mt-4 space-y-2 text-sm sm:text-base text-gray-700">
                  <p><strong>Kernbedürfnis:</strong> Eigenen Willen ausdrücken ohne Liebesverlust</p>
                  <p><strong>Wenn frustriert:</strong> &bdquo;Ich darf nicht ich selbst sein&ldquo;</p>
                  <p><strong>Adaptive Strategie:</strong> Überanpassung, passive Aggression</p>
                  <p><strong>Körperlich:</strong> Gehaltene Wut im Körper, chronische Verspannungen</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">5. Liebe/Sexualität (3-6 Jahre und Pubertät)</h3>
                <div className="mt-3 sm:mt-4 space-y-2 text-sm sm:text-base text-gray-700">
                  <p><strong>Kernbedürfnis:</strong> Offenes, liebevolles Herz mit integrierter Sexualität</p>
                  <p><strong>Wenn frustriert:</strong> &bdquo;Ich kann nicht gleichzeitig lieben und begehren&ldquo;</p>
                  <p><strong>Adaptive Strategie:</strong> Spaltung zwischen Herz und Sexualität</p>
                  <p><strong>Körperlich:</strong> Trennung zwischen oberem und unterem Körper</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Wie funktioniert NARM? */}
        <section aria-labelledby="how-narm-works-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="how-narm-works-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wie funktioniert NARM?</h2>
            
            <h3 className="mt-6 sm:mt-8 text-xl font-semibold text-gray-900">Das Dual-Bewusstsein: Hier und Jetzt</h3>
            <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              NARM kultiviert ein &bdquo;duales Bewusstsein&ldquo; – die Fähigkeit, gleichzeitig wahrzunehmen:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>Was Sie gerade erleben (somatische Achtsamkeit)</li>
              <li>Wie Sie diese Erfahrung organisieren (Selbstbeobachtung)</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              <strong>Beispiel:</strong> Sie spüren Enge in der Brust (somatisch) und bemerken gleichzeitig: &bdquo;Ah, ich ziehe mich gerade zurück, wie immer wenn jemand mir nahekommt&bdquo; (Organisation).
            </p>

            <h3 className="mt-6 sm:mt-8 text-xl font-semibold text-gray-900">Top-Down und Bottom-Up Integration</h3>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">Bottom-Up (Körper → Bewusstsein):</h4>
                <ul className="ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Somatische Achtsamkeit für Körperempfindungen</li>
                  <li>Verfolgung von Impulsen und Bewegungen</li>
                  <li>Nervensystem-Regulation durch Atmung und Erdung</li>
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h4 className="font-semibold text-gray-900 mb-3">Top-Down (Bewusstsein → Körper):</h4>
                <ul className="ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Erkennen limitierender Identifikationen (&bdquo;Ich bin halt so&ldquo;)</li>
                  <li>Arbeit mit Scham und Selbsthass</li>
                  <li>Infragestellen alter Überzeugungen</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* NARM-Prozess */}
        <section aria-labelledby="process-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="process-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Der NARM-Prozess: Sanft und tiefgreifend</h2>
            <h3 className="mt-6 text-xl font-semibold text-gray-900">Eine typische NARM-Sitzung</h3>
            <ol className="mt-4 ml-4 list-decimal space-y-3 text-sm sm:text-base text-gray-700">
              <li><strong>Ankommen im Jetzt</strong> (5–10 Min.): Was ist gerade präsent? Körperliche Empfindungen wahrnehmen</li>
              <li><strong>Erkundung der Organisation</strong> (20–30 Min.): Wie organisieren Sie diese Erfahrung? Welche alten Muster werden sichtbar?</li>
              <li><strong>Somatische Begleitung</strong> (10–15 Min.): Verfolgen von Körperempfindungen, Unterstützung der Selbstregulation</li>
              <li><strong>Reflexion und Integration</strong> (10–15 Min.): Was wird möglich, wenn das alte Muster sich löst? Verankerung neuer Erfahrungen</li>
            </ol>
            <p className="mt-4 text-sm sm:text-base text-gray-700"><strong>Wichtig:</strong> Sie müssen Ihre Kindheit nicht detailliert aufarbeiten. NARM arbeitet mit dem, was jetzt lebendig ist.</p>
          </div>
        </section>

        {/* Für wen ist NARM besonders geeignet? */}
        <section aria-labelledby="suitability-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <h2 id="suitability-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Für wen ist NARM besonders geeignet?</h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
              NARM ist ideal für &bdquo;hochfunktionale&ldquo; Menschen mit Entwicklungstrauma:
            </p>
            <ul className="mt-6 ml-4 space-y-3 text-sm sm:text-base text-gray-700">
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
        <section aria-labelledby="scientific-basis-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="scientific-basis-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Wissenschaftlicher Hintergrund</h2>
            
            <h3 className="mt-6 text-xl font-semibold text-gray-900">Theoretische Fundierung</h3>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              NARM integriert verschiedene wissenschaftlich fundierte Ansätze:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li><strong>Bindungstheorie</strong> (Bowlby, Ainsworth): Frühe Beziehungsmuster prägen</li>
              <li><strong>Interpersonelle Neurobiologie</strong> (Siegel): Beziehungen formen das Gehirn</li>
              <li><strong>Polyvagal-Theorie</strong> (Porges): Nervensystem und soziale Verbindung</li>
              <li><strong>Affektregulationstheorie</strong> (Schore): Rechte Gehirnhälfte und Emotionsregulation</li>
              <li><strong>Somatische Therapieansätze</strong>: Körper als Ressource für Heilung</li>
            </ul>

            <h3 className="mt-8 text-xl font-semibold text-gray-900">Aktuelle Evidenzlage</h3>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              <strong>Transparenzhinweis:</strong> NARM selbst hat noch keine randomisierten kontrollierten Studien. Die Methode basiert auf:
            </p>
            <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
              <li>15+ Jahren klinischer Praxis und Fallstudien</li>
              <li>Integration evidenzbasierter Komponenten (Achtsamkeit, somatische Ansätze)</li>
              <li>Systematischer Ausbildung mit über 2000 Therapeut:innen weltweit</li>
              <li>Positiven Erfahrungsberichten aus der Praxis</li>
            </ul>
            <p className="mt-4 text-sm sm:text-base text-gray-700">
              Die einzelnen Komponenten von NARM (somatische Achtsamkeit, Bindungsarbeit) sind gut erforscht. Spezifische NARM-Forschung ist in Planung.
            </p>
          </div>
        </section>

        {/* NARM-Ausbildung */}
        <section aria-labelledby="training-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="training-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">NARM-Ausbildung in Deutschland</h2>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              Die 3-jährige NARM-Ausbildung (720 Stunden) wird angeboten von:
            </p>
            
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">UTA Akademie Köln</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>4 Module à 5 Tage pro Jahr</li>
                  <li>Direkte Supervision durch Senior-Trainer</li>
                  <li><a href="https://uta-akademie.de" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">www.uta-akademie.de</a></li>
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">NARM Training Institute</h3>
                <ul className="mt-3 ml-4 list-disc space-y-2 text-sm sm:text-base text-gray-700">
                  <li>Internationale Ausbildungen</li>
                  <li>Online- und Präsenzmodule</li>
                  <li><a href="https://narmtraining.com" className="underline text-indigo-600" target="_blank" rel="noopener noreferrer">www.narmtraining.com</a></li>
                </ul>
              </div>
            </div>
            
            <p className="mt-6 text-sm sm:text-base text-gray-700">
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
        <section aria-labelledby="links-heading" className="mt-14 sm:mt-20 lg:mt-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="links-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Weiterführende Links</h2>
            <ul className="mt-6 ml-4 list-disc space-y-3 text-sm sm:text-base text-gray-700">
              <li><a className="underline text-indigo-600" href="https://drlaurenceheller.com/de/" target="_blank" rel="noopener noreferrer">NARM auf Deutsch – Laurence Heller</a></li>
              <li><a className="underline text-indigo-600" href="https://www.kosel.de/buecher/entwicklungstrauma-heilen" target="_blank" rel="noopener noreferrer">Buch: „Entwicklungstrauma heilen“ – Heller & LaPierre</a></li>
              <li>Andere Methoden: <a className="underline text-indigo-600" href="/therapie/somatic-experiencing">Somatic Experiencing</a></li>
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
