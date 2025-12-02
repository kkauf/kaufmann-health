import { COOKIES_ENABLED } from '@/lib/config';

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <section aria-labelledby="ds-title" className="rounded-2xl border bg-white p-6 sm:p-8">
        <h1 id="ds-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Datenschutzerklärung</h1>

        <div className="mt-6 space-y-10 text-gray-700">
          <section aria-labelledby="ueberblick">
            <h2 id="ueberblick" className="text-xl font-semibold">1. Datenschutz auf einen Blick</h2>
            <div className="mt-3 space-y-3">
              <p>
                Die folgenden Hinweise geben einen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
                Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
              </p>
              <p>
                Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Sofern über die Website
                Verträge geschlossen oder angebahnt werden, verarbeiten wir die übermittelten Daten für Vertragsangebote, Bestellungen
                oder sonstige Auftragsanfragen.
              </p>
              <p>
                {COOKIES_ENABLED ? (
                  <>
                    Auf dieser Website setzen wir keine Analytics‑Cookies. Für die Zuordnung von Werbeklicks zu erfolgreichen Formularsendungen kann ein First‑Party‑Cookie (Google Ads Conversion Linker) gesetzt werden. Details finden Sie in den nachfolgenden Abschnitten.
                  </>
                ) : (
                  <>
                    Auf dieser Website verwenden wir server‑seitiges Tracking ohne Cookies. Details finden Sie in den nachfolgenden Abschnitten.
                  </>
                )}
              </p>
            </div>
          </section>

          <section aria-labelledby="hosting">
            <h2 id="hosting" className="text-xl font-semibold">2. Hosting</h2>
            <p className="mt-3">
              Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den
              Servern der folgenden Anbieter gespeichert. Das Hosting erfolgt zum Zwecke der Vertragserfüllung gegenüber unseren
              potenziellen und bestehenden Kunden (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer sicheren, schnellen und effizienten
              Bereitstellung unseres Online-Angebots (Art. 6 Abs. 1 lit. f DSGVO). Sofern eine Einwilligung abgefragt wurde, erfolgt die
              Verarbeitung zusätzlich auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG; die Einwilligung ist jederzeit widerrufbar.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA</li>
              <li>Supabase Inc., 9700 Great Hills Trail #150, Austin, TX 78759, USA</li>
            </ul>
            <p className="mt-3">
              Mit den oben genannten Anbietern wurden Auftragsverarbeitungsverträge (AVV) geschlossen.
            </p>
          </section>

          <section aria-labelledby="allgemeines">
            <h2 id="allgemeines" className="text-xl font-semibold">3. Allgemeine Hinweise und Pflichtinformationen</h2>
            <div className="mt-3 space-y-4">
              <div>
                <h3 className="font-medium">Datenschutz</h3>
                <p className="mt-2">
                  Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie
                  dieser Datenschutzerklärung. Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der Kommunikation per
                  E-Mail) Sicherheitslücken aufweisen kann.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Hinweis zur verantwortlichen Stelle</h3>
                <address className="not-italic mt-2 space-y-1">
                  <p className="font-medium">Konstantin Kaufmann - Kaufmann Health</p>
                  <p>Billackerweg 1</p>
                  <p>64646 Heppenheim</p>
                  <p>
                    Telefon: <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="tel:+4915679686874">+49 156 79686874</a>
                  </p>
                  <p>
                    E-Mail: <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>
                  </p>
                </address>
              </div>

              <div>
                <h3 className="font-medium">Speicherdauer</h3>
                <p className="mt-2">
                  Soweit in dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen
                  Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Gesetzliche Aufbewahrungsfristen bleiben unberührt.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Rechtsgrundlagen der Verarbeitung</h3>
                <p className="mt-2">
                  Sofern Sie in die Datenverarbeitung eingewilligt haben, verarbeiten wir Ihre Daten auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO
                  (ggf. Art. 9 Abs. 2 lit. a DSGVO). Zur Vertragserfüllung oder Durchführung vorvertraglicher Maßnahmen auf Grundlage von Art. 6
                  Abs. 1 lit. b DSGVO, zur Erfüllung rechtlicher Pflichten nach Art. 6 Abs. 1 lit. c DSGVO und aufgrund berechtigter Interessen nach
                  Art. 6 Abs. 1 lit. f DSGVO. Bei Zugriff auf Endgeräte-Daten außerdem gemäß § 25 Abs. 1 TDDDG (Einwilligung).
                </p>
              </div>

              <div>
                <h3 className="font-medium">Empfänger von personenbezogenen Daten</h3>
                <p className="mt-2">
                  Im Rahmen unserer Geschäftstätigkeit arbeiten wir mit externen Stellen (z. B. Hosting, E-Mail, Analytik) zusammen. Eine
                  Übermittlung personenbezogener Daten erfolgt nur auf Grundlage einer entsprechenden Rechtsgrundlage (z. B. AVV, gemeinsame
                  Verantwortlichkeit, gesetzliche Verpflichtung, berechtigtes Interesse).
                </p>
              </div>

              <div>
                <h3 className="font-medium">Widerruf und Widerspruchsrecht</h3>
                <p className="mt-2">
                  Sie können eine bereits erteilte Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen. Zudem haben Sie das Recht, aus
                  Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit Widerspruch gegen die Verarbeitung auf Grundlage von Art. 6
                  Abs. 1 lit. e oder f DSGVO einzulegen; dies gilt auch für ein darauf gestütztes Profiling (Art. 21 DSGVO).
                </p>
              </div>

              <div>
                <h3 className="font-medium">Beschwerderecht</h3>
                <p className="mt-2">
                  Im Falle datenschutzrechtlicher Verstöße steht Ihnen ein Beschwerderecht bei einer Aufsichtsbehörde zu, insbesondere in dem
                  Mitgliedstaat Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Weitere Betroffenenrechte</h3>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li>Recht auf Datenübertragbarkeit</li>
                  <li>Auskunft, Berichtigung und Löschung</li>
                  <li>Recht auf Einschränkung der Verarbeitung</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium">Betroffenenrechte</h3>
                <p className="mt-2">
                  Für alle Anfragen zu Ihren Datenschutzrechten (Auskunft, Berichtigung,
                  Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch) wenden Sie
                  sich bitte an:
                </p>
                <p className="mt-1 font-medium">
                  E-Mail:{' '}
                  <a
                    className="text-blue-600 underline"
                    href="mailto:kontakt@kaufmann-health.de"
                  >
                    kontakt@kaufmann-health.de
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-medium">SSL-/TLS-Verschlüsselung</h3>
                <p className="mt-2">
                  Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL-/TLS-Verschlüsselung.
                  Eine verschlüsselte Verbindung erkennen Sie an &quot;https://&quot; und dem Schloss-Symbol im Browser.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="erfassung">
            <h2 id="erfassung" className="text-xl font-semibold">4. Datenerfassung auf dieser Website</h2>
            <div className="mt-3 space-y-4">
              <div>
                <h3 id="cookies" className="font-medium">Cookies und Tracking-Technologien</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>Cookie-Verwendung:</strong>{' '}
                    {COOKIES_ENABLED
                      ? 'Wir verwenden Cookies nur nach Ihrer ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG.'
                      : 'Wir setzen auf dieser Website keine Marketing‑ oder Tracking‑Cookies. Technisch notwendige Cookies können im Admin‑Bereich zum Einsatz kommen (§ 25 Abs. 2 TDDDG).'}
                  </p>
                  <p><strong>Arten von Cookies:</strong></p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Notwendige Cookies:</strong> Technisch erforderlich für Grundfunktionen (z. B. Sitzungsverwaltung im Admin‑Bereich). Rechtsgrundlage: § 25 Abs. 2 TDDDG.
                    </li>
                    {COOKIES_ENABLED && (
                      <li>
                        <strong>Marketing‑Cookies:</strong> Google Ads Conversion‑Tracking zur Messung der Werbewirksamkeit. Nur mit Ihrer Einwilligung.
                      </li>
                    )}
                  </ul>
                  {COOKIES_ENABLED && (
                    <>
                      <p>
                        <strong>Google Ads Conversion‑Tracking:</strong> Bei Einwilligung setzen wir Google Ads Conversion‑Tracking ein. Dabei können folgende Cookies gesetzt werden:
                      </p>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>_gcl_au: Speicherdauer 3 Monate</li>
                        <li>_gcl_aw: Speicherdauer 90 Tage</li>
                        <li>_gac_[property-id]: Speicherdauer 90 Tage</li>
                      </ul>
                      <p>
                        <strong>Consent Mode v2:</strong> Wir nutzen Google Consent Mode v2. Ohne Ihre Einwilligung werden keine Marketing‑Cookies gesetzt; Google erhält lediglich anonymisierte Signale zur groben Schätzung von Conversions.
                      </p>
                    </>
                  )}
                  <p>
                    <strong>Zusätzlich:</strong> Zur weiteren Optimierung übermitteln wir verschlüsselte (gehashte) E‑Mail‑Adressen server‑seitig an Google Ads (Enhanced Conversions). Dies erfolgt ohne Cookies auf Ihrem Gerät.
                  </p>
                  <p>
                    <strong>Widerruf:</strong> Sie können Ihre Einwilligung jederzeit widerrufen. Klicken Sie dazu auf „Cookie‑Einstellungen“ im Footer unserer Website.
                  </p>
                  <p>
                    Für kleine Komfortfunktionen (z. B. damit ein Hinweis pro Sitzung nur einmal erscheint) nutzen wir ggf. den lokalen Speicher
                    Ihres Browsers (<span className="font-mono">sessionStorage</span>/<span className="font-mono">localStorage</span>). Dabei werden keine personenbezogenen Profile erstellt,
                    keine Daten an Dritte übermittelt und keine Cookies gesetzt.
                  </p>
                  <p>
                    Technische Server-Logs können aus Sicherheitsgründen Informationen wie IP-Adresse und User-Agent enthalten. Es findet kein Tracking
                    und kein Profiling statt.
                  </p>
                  {COOKIES_ENABLED && (
                    <p>
                      Weiterführende Informationen finden Sie in der{' '}
                      <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noopener noreferrer">Datenschutzerklärung von Google</a>.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium">Web-Analyse (cookieless)</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Zur Verbesserung unserer Website nutzen wir eine cookielose Web-Analyse (Vercel Web Analytics). Dabei werden ausschließlich
                    aggregierte Nutzungsdaten (z. B. Seitenaufrufe, grundlegende Performance-Metriken) erfasst. Es werden keine Tracking-Cookies gesetzt
                    und keine personenbezogenen Profile erstellt.
                  </p>
                  <p>
                    Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Optimierung und Stabilität unseres Online-Angebots).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Kontaktformular</h3>
                <p className="mt-2">
                  Wenn Sie uns per Formular Anfragen senden, verarbeiten wir Ihre Angaben zur Bearbeitung und für Anschlussfragen. Rechtsgrundlage
                  ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag/vertragsähnlich) bzw. unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) oder Ihre
                  Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die Daten verbleiben bei uns bis Widerruf, Löschungsverlangen oder Zweckerreichung.
                </p>
                <p className="mt-2">
                  <strong>Erfolgsmessung unserer Werbung</strong><br />
                  Zur Optimierung unserer Werbekampagnen übermitteln wir verschlüsselte E-Mail-Adressen an Google Ads, wenn Sie unser Kontaktformular nutzen. Dies erfolgt server-seitig ohne Cookies auf Ihrem Gerät.
                </p>
                <p className="mt-2">
                  Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse). Widerspruchsrecht: kontakt@kaufmann-health.de
                </p>
              </div>

              <div>
                <h3 className="font-medium">Datenübermittlung in die USA</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Bei Nutzung von Google-Diensten können Daten in die USA übertragen werden. Google LLC ist unter dem EU-US Data Privacy Framework zertifiziert. Dennoch besteht ein Restrisiko, da US-Behörden unter bestimmten Umständen Zugriff auf personenbezogene Daten nehmen können.
                  </p>
                  <p>
                    Rechtsgrundlage: Bei Einwilligung Art. 49 Abs. 1 lit. a DSGVO. Wir informieren Sie transparent über dieses Risiko, sodass Sie eine informierte Entscheidung treffen können.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Ereignis- und Fehlerprotokolle (PII-frei)</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Zur Sicherstellung des stabilen Betriebs, zur Fehlerdiagnose und zur Missbrauchsabwehr speichern wir technische Ereignisse und
                    Fehlermeldungen in einem internen Protokoll. Personenbezogene Inhalte werden nicht gespeichert; Protokolldaten enthalten
                    ausschließlich anonymisierte bzw. abgeleitete Informationen (z. B. Ereignistyp, Zeitpunkt, ggf. gekürzte Metadaten).
                  </p>
                  <p>
                    IP-Adressen werden vor Speicherung mit einem sog. &quot;Salt&quot; irreversibel gehasht. Der verwendete User-Agent kann in gekürzter Form
                    gespeichert werden. Es erfolgt kein Tracking und kein Profiling.
                  </p>
                  <p>
                    Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit/Stabilität des Dienstes).
                  </p>
                </div>
              </div>

              <div>
                <h3 id="vertragsdaten" className="font-medium">Vertragsdaten (Therapeuten-Registrierung)</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Wenn Sie sich als Therapeut:in registrieren, wird zur schnellen Aufnahme in unser Netzwerk ein Dienstleistungsvertrag
                    automatisch angenommen. Zum Nachweis der Wirksamkeit und zur Erfüllung gesetzlicher Pflichten verarbeiten wir dabei folgende
                    Metadaten:
                  </p>
                  <ul className="list-disc space-y-1 pl-6">
                    <li>Zeitpunkt der Vertragsannahme (Timestamp)</li>
                    <li>IP-Adresse zum Zeitpunkt der Annahme (in gehashter Form)</li>
                    <li>Version der zugrunde liegenden Vertragsbedingungen</li>
                  </ul>
                  <p>
                    Zweck: Sicherstellung der Vertragsgültigkeit, Dokumentation der Annahme sowie rechtliche Nachweispflichten.
                  </p>
                  <p>
                    Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. Durchführung vorvertraglicher Maßnahmen).
                  </p>
                  <p>
                    Speicherdauer: Für die Dauer der Geschäftsbeziehung und darüber hinaus entsprechend gesetzlicher Aufbewahrungsfristen.
                  </p>
                  <p>
                    Weitere Informationen zu den Vertragsbedingungen finden Sie unter
                    {' '}
                    <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="/therapist-terms">/therapist-terms</a>.
                  </p>
                </div>
              </div>

              <div>
                <h3 id="therapeutenvermittlung" className="font-medium">
                  Therapeutenvermittlung und Kontaktherstellung
                </h3>
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>Zweck:</strong> Weitergabe Ihrer Kontakt- und Gesundheitsdaten an
                    {' '}passende Therapeuten zur Kontaktaufnahme
                  </p>
                  <p>
                    <strong>Rechtsgrundlage:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO,
                    {' '}Art. 9 Abs. 2 lit. a DSGVO für Gesundheitsdaten)
                  </p>
                  <p>
                    <strong>Empfänger:</strong> Ausgewählte Heilpraktiker für Psychotherapie basierend
                    {' '}auf Ihren Präferenzen und Ihrem Standort
                  </p>
                  <p>
                    <strong>Übertragene Daten:</strong> Name, E‑Mail, Telefon, Stadt, Therapiewünsche,
                    {' '}gesundheitsbezogene Angaben aus Ihren Formulareingaben
                  </p>
                  <p>
                    <strong>Widerruf:</strong> Jederzeit per E‑Mail an{' '}
                    <a
                      className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                      href="mailto:kontakt@kaufmann-health.de"
                    >
                      kontakt@kaufmann-health.de
                    </a>{' '}
                    möglich. Nach Widerruf werden Ihre Daten innerhalb von 30 Tagen gelöscht.
                  </p>
                  <p>
                    <strong>Speicherdauer:</strong> Daten werden gelöscht, sobald Sie Ihre Einwilligung
                    {' '}widerrufen oder nach 2 Jahren ohne Aktivität.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Anfrage per E-Mail, Telefon oder Telefax</h3>
                <p className="mt-2">
                  Wenn Sie uns per E-Mail, Telefon oder Telefax kontaktieren, verarbeiten wir Ihre Anfrage inkl. personenbezogener Daten zur
                  Bearbeitung. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO (Vertrag/Vertragsanbahnung), andernfalls Art. 6 Abs. 1 lit. f DSGVO
                  (berechtigtes Interesse) oder Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="newsletter">
            <h2 id="newsletter" className="text-xl font-semibold">5. Newsletter</h2>
            <div className="mt-3 space-y-3">
              <p>
                Für den Bezug eines Newsletters verarbeiten wir Ihre E-Mail-Adresse sowie weitere freiwillige Angaben ausschließlich auf Grundlage
                Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung können Sie jederzeit über den Abmelde-Link widerrufen.
              </p>
              <p>
                Nach Abmeldung kann Ihre E-Mail-Adresse in einer Blacklist gespeichert werden, sofern dies zur Verhinderung künftiger Mailings
                erforderlich ist (Art. 6 Abs. 1 lit. f DSGVO). Die Blacklist-Daten werden ausschließlich zu diesem Zweck verwendet.
              </p>
            </div>
          </section>

          <div className="mt-8 pt-4 border-t text-sm text-gray-500">
            <p>Stand: September 2025</p>
            <p>Version: 2025-09-01.v2</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export const metadata = {
  title: "Datenschutzerklärung | Kaufmann Health",
  description:
    "Datenschutzerklärung für Kaufmann Health – Therapeutenvermittlung und Kontaktherstellung, GDPR‑konforme Datenverarbeitung, Ihre Rechte und Widerrufsmöglichkeiten.",
  openGraph: {
    title: "Datenschutzerklärung | Kaufmann Health",
    description:
      "Informationen zur Therapeutenvermittlung, Datenschutz, Hosting und Ihren Betroffenenrechten.",
    url: "https://kaufmann-health.de/datenschutz",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/datenschutz" },
};
