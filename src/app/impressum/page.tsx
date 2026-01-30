export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <section aria-labelledby="impressum-title" className="rounded-2xl border bg-white p-6 sm:p-8">
        <h1 id="impressum-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Impressum
        </h1>
        <div className="mt-6 space-y-8 text-gray-700">
          <section aria-labelledby="anbieter">
            <h2 id="anbieter" className="text-xl font-semibold">Angaben gemäß § 5 DDG</h2>
            <address className="not-italic mt-3 space-y-1">
              <p className="font-medium">Kaufmann Earth LLC</p>
              <p>handelnd als Kaufmann Health</p>
              <p>2427 Stanton Road</p>
              <p>New Woodstock, NY, 13122, USA</p>
              <p className="mt-2 text-sm text-gray-600">
                Registrierung: Madison, 250730021764 (New York State Department of State Division of Corporations,
                State Divisions and Uniform Commercial Code)
              </p>
            </address>
          </section>

          <section aria-labelledby="vertretung">
            <h2 id="vertretung" className="text-xl font-semibold">Vertreten durch</h2>
            <p className="mt-3">Konstantin Kaufmann (CEO)</p>
          </section>

          <section aria-labelledby="kontakt">
            <h2 id="kontakt" className="text-xl font-semibold">Kontakt</h2>
            <ul className="mt-3 space-y-1">
              <li>
                Telefon: <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="tel:+4915679686874">+49 156 79686874</a>
              </li>
              <li>
                E-Mail: <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>
              </li>
            </ul>
          </section>

          <section aria-labelledby="verantwortlich">
            <h2 id="verantwortlich" className="text-xl font-semibold">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <address className="not-italic mt-3 space-y-1">
              <p>Konstantin Kaufmann</p>
              <p>2427 Stanton Road</p>
              <p>New Woodstock, NY, 13122, USA</p>
            </address>
          </section>

          <section aria-labelledby="eu-datenschutz">
            <h2 id="eu-datenschutz" className="text-xl font-semibold">EU-Datenschutzverantwortlicher nach Art. 27 Abs. 2 DSGVO</h2>
            <address className="not-italic mt-3 space-y-1">
              <p>Michael Strobel-Kaufmann</p>
              <p>Bergischer Ring 31</p>
              <p>58095 Hagen</p>
            </address>
          </section>

          <section aria-labelledby="zustellung">
            <h2 id="zustellung" className="text-xl font-semibold">Zustellungsbevollmächtigter in Deutschland (gemäß § 5 DDG, Art. 27 DSGVO)</h2>
            <address className="not-italic mt-3 space-y-1">
              <p>Michael Strobel-Kaufmann</p>
              <p>Bergischer Ring 31</p>
              <p>58095 Hagen</p>
            </address>
            <p className="mt-3">
              Die vorgenannte Person ist bevollmächtigt, Zustellungen in gerichtlichen und außergerichtlichen Verfahren,
              die den Betrieb der Plattform Kaufmann Earth LLC betreffen, für die Gesellschaft entgegenzunehmen.
            </p>
          </section>

          <section aria-labelledby="streitbeilegung">
            <h2 id="streitbeilegung" className="text-xl font-semibold">EU-Streitbeilegung</h2>
            <p className="mt-3">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a
                className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              . Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section aria-labelledby="haftungsausschluss">
            <h2 id="haftungsausschluss" className="text-xl font-semibold">Haftungsausschluss</h2>
            <div className="mt-3 space-y-4">
              <div>
                <h3 className="font-medium">Haftung für Inhalte</h3>
                <p className="mt-2">
                  Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
                  können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen
                  Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
                  übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
                  Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen
                  bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
                  Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Haftung für Links</h3>
                <p className="mt-2">
                  Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für
                  diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
                  Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
                  überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der
                  verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
                  Rechtsverletzungen werden wir derartige Links umgehend entfernen.
                </p>
              </div>
            </div>
          </section>

          <div className="mt-8 pt-4 border-t text-sm text-gray-500">
            <p>Stand: Januar 2026</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export const metadata = {
  title: "Impressum | Kaufmann Health",
  description:
    "Impressum nach § 5 DDG mit Kontaktdaten, Verantwortlichkeit nach § 18 Abs. 2 MStV und rechtlichen Hinweisen.",
  openGraph: {
    title: "Impressum | Kaufmann Health",
    description:
      "Angaben gemäß § 5 DDG, Verantwortlichkeit nach § 18 Abs. 2 MStV und rechtliche Hinweise.",
    url: "https://kaufmann-health.de/impressum",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/impressum" },
};
