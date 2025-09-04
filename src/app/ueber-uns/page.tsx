import Image from "next/image";

export const dynamic = 'force-dynamic';

export default function UeberUnsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* About Hero */}
      <section
        aria-labelledby="about-hero"
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />
        <h1 id="about-hero" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Therapie sollte kein Privileg sein
        </h1>
        <p className="mt-4 max-w-2xl text-gray-700">
          Kaufmann Health wurde gegründet, um die Lücke zwischen qualifizierten Therapeuten
          und Menschen zu schließen, die Hilfe suchen.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="/therapie-finden"
            className="inline-flex items-center justify-center rounded-md bg-black px-5 py-2 text-white"
          >
            Therapeuten finden
          </a>
          <a
            href="/fuer-therapeuten"
            className="inline-flex items-center justify-center rounded-md border px-5 py-2 text-gray-900"
          >
            Für Therapeuten
          </a>
        </div>
      </section>

      {/* Story */}
      <section aria-labelledby="story" className="mt-12 sm:mt-16">
        <h2 id="story" className="text-2xl font-semibold">
          Unsere Geschichte
        </h2>
        <div className="mt-3 max-w-3xl space-y-4 text-gray-700">
          <p>
          Erfolgreich nach jeder Metrik – außer der wichtigsten: Lebendigkeit. Ich hatte alles optimiert, nur nicht meine Verbindung zu mir selbst.
          </p>
          <p>Körpertherapie hat das geändert. Nicht durch noch mehr Denken, sondern durch Spüren. Durch die Erkenntnis, dass unser Körper Antworten hat, die unser Verstand nicht mal als Fragen erkennt.</p>
          <p>
          Kaufmann Health ist für Menschen wie uns: Die in Zahlen denken und trotzdem spüren wollen. Die Exzellenz suchen – nicht nur im Job, sondern im Menschsein. Unsere Therapeut:innen verstehen beide Welten. Und bauen Brücken zwischen ihnen.
          </p>
        </div>
      </section>

      {/* Values */}
      <section aria-labelledby="values" className="mt-12 sm:mt-16">
        <h2 id="values" className="text-2xl font-semibold">
          Unsere Werte
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <h3 className="text-lg font-medium">Fairness statt Ausbeutung</h3>
            <p className="mt-2 text-sm text-gray-600">
              Therapeuten zahlen nur bei Erfolg. Patienten zahlen nichts für den Service.
              Win-Win statt Monopol.
            </p>
          </div>
          <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <h3 className="text-lg font-medium">Qualität vor Quantität</h3>
            <p className="mt-2 text-sm text-gray-600">
              Wir arbeiten nur mit ausgebildeten, erfahrenen Therapeuten.
              Jede Anfrage wird persönlich betreut.
            </p>
          </div>
          <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <h3 className="text-lg font-medium">Transparent und persönlich</h3>
            <p className="mt-2 text-sm text-gray-600">
             Wir bringen Menschen zusammen. Technologie ist dafür ein Mittel zum Zweck - nicht mehr und nicht weniger.
             Uns liegt die persönliche Kommunikation mit unseren Therapeuten und Klienten am Herzen.
            </p>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section aria-labelledby="founder" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <h2 id="founder" className="text-2xl font-semibold">
            Über den Gründer
          </h2>
          <div className="mt-4 flex items-start gap-4">
            <Image
              src="/profile-pictures/konstantin-kaufmann.jpg"
              alt="Foto von Konstantin Kaufmann"
              width={96}
              height={96}
              className="h-20 w-20 shrink-0 rounded-full border object-cover sm:h-24 sm:w-24"
              priority
            />
            <div>
              <p className="font-semibold">Konstantin Kaufmann</p>
              <p className="text-sm text-gray-600">Gründer &amp; Product Manager</p>
              <blockquote className="mt-3 italic text-gray-700">
                Durch meine Frau, eine Heilpraktikerin für Psychotherapie, kenne ich beide 
                Seiten: Therapeuten verbringen Stunden mit Marketing statt mit Heilen. 
                Patienten finden niemanden mit der richtigen Spezialisierung.<br /><br />
                
                Nach Jahren im Aufbau digitaler Produkte wusste ich: Das lässt sich besser 
                lösen. Ehrlich, transparent, ohne dass einer über den Tisch gezogen wird.
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact" className="mt-12 sm:mt-16">
        <h2 id="contact" className="text-2xl font-semibold">
          Kontakt
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <p className="font-medium">Kaufmann Health</p>
            <p className="mt-1">
              Email:{' '}
              <a
                href="mailto:kontakt@kaufmann-health.de"
                className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
              >
                kontakt@kaufmann-health.de
              </a></p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="font-medium">Rechtliches</p>
            <div className="mt-2 space-x-4 text-sm">
              <a className="hover:text-gray-900" href="/impressum">
                Impressum
              </a>
              <span aria-hidden>•</span>
              <a className="hover:text-gray-900" href="/datenschutz">
                Datenschutz
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export const metadata = {
  title: "Über Kaufmann Health - Trauma-Heilung beginnt hier",
  description:
    "Unsere Geschichte, Werte und Kontakt – Therapie ohne Wartelisten. Kaufmann Health bringt Menschen und qualifizierte Therapeuten zusammen.",
  openGraph: {
    title: "Über Kaufmann Health - Trauma-Heilung beginnt hier",
    description: "Unsere Geschichte, Werte und Kontakt – Trauma-Heilung beginnt hier.",
    url: "https://kaufmann-health.de/ueber-uns",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/ueber-uns" },
};
