import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Heart, Users, Shield, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Über uns – Katherine & Konstantin | Kaufmann Health",
  description:
    "Lernt Katherine und Konstantin kennen – ein familiengeführtes Team aus Therapie-Expertise und Tech-Erfahrung, das Menschen mit körperorientierten Therapeut:innen verbindet.",
  openGraph: {
    title: "Über uns – Katherine & Konstantin | Kaufmann Health",
    description: "Familiengeführte Therapeuten-Vermittlung mit persönlicher Kuration und Trauma-Expertise.",
    url: "https://kaufmann-health.de/ueber-uns",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/ueber-uns" },
};

export default function UeberUnsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Hero Section */}
      <section
        aria-labelledby="about-hero"
        className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 p-8 sm:p-10 lg:p-12"
      >
        {/* Background photo with blur */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/profile-pictures/katherine and konstantin.PNG"
            alt=""
            fill
            sizes="100vw"
            className="object-cover blur-[5px] scale-105"
            priority
          />
        </div>
        {/* White overlay to ensure text readability */}
        <div className="absolute inset-0 z-0 bg-white/70" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 z-0 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 id="about-hero" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
            Handverlesen.<br />Familiengeführt. Für dich.
          </h1>
          <p className="mt-6 text-base sm:text-lg leading-relaxed text-gray-700 max-w-2xl mx-auto">
            Wir sind Katherine und Konstantin – ein Team aus Therapie-Expertise und Tech-Erfahrung.
            Gemeinsam verbinden wir Menschen mit den richtigen Therapeut:innen – persönlich statt algorithmisch.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]">
              <Link href="/start">Therapeut:in finden</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base font-semibold border-2 hover:bg-gray-50 transition-all duration-200">
              <Link href="/fuer-therapeuten">Für Therapeut:innen</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section aria-labelledby="values-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="values-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center">
          Was uns auszeichnet
        </h2>
        <div className="mt-8 sm:mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <ValueCard
            icon={<Users className="h-6 w-6" />}
            title="Familiengeführt"
            description="Persönliche Betreuung statt anonymer Plattform. Wir kennen jede:n Therapeut:in persönlich."
          />
          <ValueCard
            icon={<Heart className="h-6 w-6" />}
            title="Trauma-informiert"
            description="Alle Therapeut:innen arbeiten mit körperorientierten, trauma-informierten Ansätzen."
          />
          <ValueCard
            icon={<Shield className="h-6 w-6" />}
            title="Privatsphäre zuerst"
            description="DSGVO-konform, keine Datenweitergabe, keine Diagnose in der Kassenakte."
          />
          <ValueCard
            icon={<Sparkles className="h-6 w-6" />}
            title="Persönliche Kuration"
            description="Keine automatischen Matches – nur durchdachte, individuelle Empfehlungen."
          />
        </div>
      </section>

      {/* Katherine's Section */}
      <section aria-labelledby="katherine-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/30 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />

          <div className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-12">
            {/* Katherine's Photo */}
            <div className="relative mx-auto lg:mx-0">
              <div className="relative aspect-[3/4] w-64 lg:w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-indigo-200/60">
                <Image
                  src="/profile-pictures/katherine.JPEG"
                  alt="Katherine Kaufmann"
                  fill
                  sizes="(min-width: 1024px) 320px, 256px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Katherine's Content */}
            <div className="space-y-6">
              <div>
                <h2 id="katherine-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                  Katherine Kaufmann
                </h2>
                <p className="mt-2 text-lg font-medium text-indigo-700">
                  Gründerin • NARM & Core Energetics Therapeutin
                </p>
              </div>

              <div className="prose prose-lg max-w-none">
                <p className="text-base leading-relaxed text-gray-700">
                  I view NARM and somatic self-development work as powerful tools for personal and psycho-spiritual growth.
                  I find it deeply fulfilling to support people as they unfold and discover their inner qualities.
                </p>
                <p className="text-base leading-relaxed text-gray-700">
                  I am trained in NARM (NeuroAffective Relational Model) and Core Energetics and offer NARM-informed
                  coaching and somatic sessions internationally.
                </p>
                <p className="text-base leading-relaxed text-gray-700">
                  I&apos;m also a mother, an avid reader of poetry and mystical texts, and a lover of the natural landscapes
                  of central New York, my home state.
                </p>
              </div>

              {/* Professional Background */}
              <div className="rounded-xl border border-indigo-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Professioneller Hintergrund</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>M.A. Social Work, University of Kentucky (laufend)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Teaching Assistant am Complex Trauma Training Center</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Zertifizierte NARM Therapeutin (NeuroAffective Relational Model)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Ausbildung in Neo-Reichianischen Ansätzen (Core Energetics)</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-indigo-200/60 bg-white/60 backdrop-blur-sm p-5">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">Mehr über Katherine:</span>{' '}
                  <a
                    href="https://katherine.kaufmann.earth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-800 hover:decoration-indigo-600 transition-colors font-medium"
                  >
                    katherine.kaufmann.earth
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Konstantin's Section */}
      <section aria-labelledby="konstantin-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-cyan-50/30 p-8 sm:p-10 lg:p-12 shadow-lg shadow-emerald-100/30 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_60%_0%,rgba(16,185,129,0.09),transparent_65%)]" />

          <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
            {/* Konstantin's Content */}
            <div className="space-y-6 lg:order-1">
              <div>
                <h2 id="konstantin-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                  Konstantin Kaufmann
                </h2>
                <p className="mt-2 text-lg font-medium text-emerald-700">
                  Gründer • Product & Operations
                </p>
              </div>

              <div className="prose prose-lg max-w-none">
                <p className="text-base leading-relaxed text-gray-700">
                  Ich komme aus der Welt der Technologie und Produktentwicklung – geprägt von Datenanalyse,
                  Teamführung und operativer Exzellenz bei Unternehmen wie N26 und Urban Sports Club.
                </p>
                <p className="text-base leading-relaxed text-gray-700">
                  Durch Katherine, meine Frau und Heilpraktikerin für Psychotherapie, habe ich die Tiefe
                  körperorientierter Arbeit kennengelernt. Kaufmann Health ist aus dieser Verbindung entstanden:
                  Tech-Präzision trifft auf therapeutische Expertise.
                </p>
                <p className="text-base leading-relaxed text-gray-700">
                  Meine Rolle ist es, die Brücke zu bauen – zwischen Menschen, die Unterstützung suchen,
                  und Therapeut:innen, die echte Transformation ermöglichen. Ich bringe operative Effizienz,
                  strategisches Denken und ein tiefes Verständnis für die Bedürfnisse erfolgreicher Menschen.
                </p>
              </div>

              {/* Professional Background */}
              <div className="rounded-xl border border-emerald-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Professioneller Hintergrund</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                    <span>Head of Academy bei Franklin Institute of Applied Sciences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                    <span>Lead Product Manager bei Urban Sports Group</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                    <span>Product Owner bei N26</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                    <span>Expertise in Produktentwicklung, Team-Building und operativer Exzellenz</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-200/60 bg-white/60 backdrop-blur-sm p-5">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-900">Mehr über Konstantin:</span>{' '}
                  <a
                    href="https://kkauf.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800 hover:decoration-emerald-600 transition-colors font-medium"
                  >
                    kkauf.com
                  </a>
                </p>
              </div>
            </div>

            {/* Konstantin's Photo */}
            <div className="relative mx-auto lg:mx-0 lg:order-2">
              <div className="relative aspect-[3/4] w-64 lg:w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-emerald-200/60">
                <Image
                  src="/profile-pictures/konstantin.JPEG"
                  alt="Konstantin Kaufmann"
                  fill
                  sizes="(min-width: 1024px) 320px, 256px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Together Section */}
      <section aria-labelledby="together-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30 rounded-2xl" />

          <h2 id="together-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center">
            Gemeinsam für dich
          </h2>

          <div className="mt-8 max-w-3xl mx-auto">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-slate-300/50">
              <Image
                src="/profile-pictures/katherine and konstantin.PNG"
                alt="Katherine und Konstantin Kaufmann"
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mt-8 max-w-3xl mx-auto space-y-4 text-center">
            <p className="text-base sm:text-lg leading-relaxed text-gray-700">
              Wir sind ein familiengeführtes Team mit komplementären Stärken: Katherine bringt tiefe therapeutische
              Expertise und jahrelange Erfahrung in körperorientierter Arbeit. Konstantin sorgt für operative
              Exzellenz und strategische Klarheit.
            </p>
            <p className="text-base sm:text-lg leading-relaxed text-gray-700">
              Gemeinsam wählen wir persönlich jede Empfehlung aus – keine Algorithmen, keine automatischen Matches.
              Nur durchdachte, individuelle Vorschläge von Menschen, die beide Welten verstehen:
              die der erfolgreichen Leistungsträger und die der tiefgreifenden inneren Arbeit.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="final-cta" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60 p-8 sm:p-12 lg:p-16">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 id="final-cta" className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
              Bereit für den ersten Schritt?
            </h2>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-gray-700">
              Fülle unseren 5-Minuten Fragebogen aus. Wir senden dir innerhalb von 24 Stunden bis zu 3
              persönlich ausgewählte Therapeuten-Vorschläge.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="h-14 px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]">
                <Link href="/fragebogen">Jetzt Therapeut:in finden</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{description}</p>
    </div>
  );
}
