import Image from "next/image";
import RevealContainer from "@/components/RevealContainer";

export const revalidate = 3600;

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
          Du hast das Leben aufgebaut, das du geplant hast. Warum fühlt es sich so leer an?
        </h1>
        <p className="mt-4 max-w-3xl text-gray-700">
          Kaufmann Health verbindet erfolgreiche Menschen mit körperorientierten Therapeuten, die verstehen:
          Manchmal führt der Weg nach vorne durch die Tiefe.
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
      <section
        aria-labelledby="story"
        className="mt-12 sm:mt-16 relative rounded-2xl border bg-white p-6 sm:p-8"
      >
        <h2 id="story" className="text-2xl font-semibold">
          Mehr als nur funktionieren
        </h2>
        <div className="mt-3 max-w-3xl space-y-4 text-gray-700">
          <p>
            Ich kenne beide Welten: die der OKRs, KPIs und Hyper-Performance – und die, in der man wieder atmet, zittert,
            weint und langsam spürt. Viele unserer Klient:innen haben alles erreicht, was sie sich vorgenommen haben –
            und merken doch: Etwas fehlt.
          </p>
          <p>
            Körperorientierte Therapie ist kein weiterer Optimierungs-Trick. Sie ist eine Einladung in die Tiefe:
            raus aus dem Kopf, rein in den Körper. Dort entstehen neue Wege – nicht, weil man sich stärker anstrengt,
            sondern weil man ehrlicher fühlt.
          </p>
          <p>
            Kaufmann Health ist bewusst keine Plattform für „schneller, günstiger, effizienter“.
            Wir sind eine Anlaufstelle für erfolgreiche Menschen, die mehr wollen als funktionieren –
            und die bereit sind, echten Kontakt mit sich aufzunehmen.
          </p>
        </div>
      </section>

      {/* Values */}
      <section aria-labelledby="values" className="mt-12 sm:mt-16">
        <h2 id="values" className="text-2xl font-semibold">
          Unsere Werte
        </h2>
        <RevealContainer>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div
              data-reveal
              className="rounded-lg border bg-white p-5 hover:shadow-md opacity-0 translate-y-2 transition-all duration-500"
              style={{ transitionDelay: "0ms" }}
            >
            <h3 className="text-lg font-medium">Tiefe statt Tempo</h3>
            <p className="mt-2 text-sm text-gray-600">
              Heilung braucht Raum. Wir priorisieren Qualität der Begegnung über Geschwindigkeit der Lösung.
            </p>
            </div>
            <div
              data-reveal
              className="rounded-lg border bg-white p-5 hover:shadow-md opacity-0 translate-y-2 transition-all duration-500"
              style={{ transitionDelay: "60ms" }}
            >
            <h3 className="text-lg font-medium">Körperweisheit statt Kopfoptimierung</h3>
            <p className="mt-2 text-sm text-gray-600">
              Der Körper weiß oft früher als der Verstand. Unsere Arbeit folgt dieser Intelligenz – somatisch, präsent, ehrlich.
            </p>
            </div>
            <div
              data-reveal
              className="rounded-lg border bg-white p-5 hover:shadow-md opacity-0 translate-y-2 transition-all duration-500"
              style={{ transitionDelay: "120ms" }}
            >
            <h3 className="text-lg font-medium">Verstehen statt Urteilen</h3>
            <p className="mt-2 text-sm text-gray-600">
              Leistung ist nicht das Problem – sie ist nur nicht die Antwort auf alles. Wir begegnen Erfolgsbiografien mit Respekt und Tiefe.
            </p>
            </div>
          </div>
        </RevealContainer>
      </section>

      {/* Founder */}
      <section aria-labelledby="founder" className="mt-12 sm:mt-16">
        <RevealContainer>
          <div
            data-reveal
            className="rounded-2xl border bg-white p-6 sm:p-8 opacity-0 translate-y-2 transition-all duration-500"
            style={{ transitionDelay: "0ms" }}
          >
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
              <div className="mt-3 space-y-3 text-gray-700">
                <p>
                  Ich komme aus der Welt der Technologie und Produktentwicklung – geprägt von Zahlen, Wachstum,
                  Effizienz. Gleichzeitig habe ich durch meine Frau, eine Heilpraktikerin für Psychotherapie, die Tiefe
                  körperorientierter Arbeit kennengelernt.
                </p>
                <p>
                  Kaufmann Health ist aus dieser Spannung entstanden: Ich verstehe die Logik derer, die alles erreicht
                  haben und trotzdem innere Leere spüren. Unsere Aufgabe ist nicht, das Leben noch weiter zu
                  optimieren – sondern Räume zu schaffen, in denen wieder Gefühl, Kontakt und Lebendigkeit möglich
                  werden.
                </p>
                <p>
                  Meine technische Erfahrung hilft mir, die Bedürfnisse erfolgreicher Menschen präzise zu verstehen –
                  und Angebote zu kuratieren, die nicht oberflächlich versprechen, sondern in die Tiefe führen.
                </p>
              </div>
            </div>
          </div>
          </div>
        </RevealContainer>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact" className="mt-12 sm:mt-16">
        <h2 id="contact" className="text-2xl font-semibold">
          Kontakt
        </h2>
        <RevealContainer>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div
              data-reveal
              className="rounded-lg border bg-white p-4 opacity-0 translate-y-2 transition-all duration-500"
              style={{ transitionDelay: "0ms" }}
            >
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
            <div
              data-reveal
              className="rounded-lg border bg-white p-4 opacity-0 translate-y-2 transition-all duration-500"
              style={{ transitionDelay: "60ms" }}
            >
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
        </RevealContainer>
      </section>
    </main>
  );
}

export const metadata = {
  title: "Über uns – Für erfolgreiche Menschen, die mehr wollen als funktionieren",
  description:
    "Kaufmann Health richtet sich an erfolgreiche Menschen, die innere Leere spüren. Körperorientierte Therapie, Tiefe statt Tempo, Verstehen statt Urteilen.",
  openGraph: {
    title: "Über uns – Für erfolgreiche Menschen, die mehr wollen als funktionieren",
    description: "Kaufmann Health für Tiefensucher: körperorientierte Therapie und kuratierte Empfehlungen, die in die Tiefe führen.",
    url: "https://kaufmann-health.de/ueber-uns",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/ueber-uns" },
};
