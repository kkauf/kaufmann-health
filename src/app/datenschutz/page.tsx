import { COOKIES_ENABLED } from '@/lib/config';

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <section aria-labelledby="ds-title" className="rounded-2xl border bg-white p-6 sm:p-8">
        <h1 id="ds-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Datenschutzerklärung</h1>
        <p className="mt-2 text-sm text-gray-500">Stand: 24. Januar 2026</p>

        <div className="mt-6 space-y-10 text-gray-700">
          <section aria-labelledby="ueberblick">
            <h2 id="ueberblick" className="text-xl font-semibold">1. Datenschutz auf einen Blick</h2>
            <p className="mt-3">
              Diese Datenschutzerklärung informiert Sie darüber, welche personenbezogenen Daten bei der Nutzung unserer
              Website erhoben, verarbeitet und gespeichert werden. Personenbezogene Daten sind Informationen, mit denen
              Sie persönlich identifiziert werden können. Ein Teil der Daten wird benötigt, um die fehlerfreie
              Bereitstellung der Website sicherzustellen. Andere Daten verwenden wir zur Bearbeitung von Anfragen, zur
              Vertragserfüllung oder zur Optimierung unserer Werbung und Angebote. Auf dieser Website setzen wir kein
              Cookie-Tracking ein.
            </p>
          </section>

          <section aria-labelledby="verantwortliche">
            <h2 id="verantwortliche" className="text-xl font-semibold">2. Verantwortliche Stelle</h2>
            <p className="mt-3">Verantwortlich für die Datenverarbeitung:</p>
            <address className="not-italic mt-3 space-y-1">
              <p className="font-medium">Kaufmann Earth LLC</p>
              <p>handelnd als Kaufmann Health</p>
              <p>2427 Stanton Road</p>
              <p>New Woodstock, NY, 13122, USA</p>
            </address>
            <p className="mt-3">
              Sie können uns telefonisch unter{' '}
              <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="tel:+4915679686874">+49 156 79686874</a>
              {' '}oder per E-Mail an{' '}
              <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>
              {' '}erreichen.
            </p>
          </section>

          <section aria-labelledby="eu-vertreter">
            <h2 id="eu-vertreter" className="text-xl font-semibold">3. EU-Datenschutzverantwortlicher nach Art. 27 Abs. 2 DSGVO</h2>
            <address className="not-italic mt-3 space-y-1">
              <p className="font-medium">Michael Strobel-Kaufmann</p>
              <p>Bergischer Ring 31</p>
              <p>58095 Hagen</p>
            </address>
          </section>

          <section aria-labelledby="hosting">
            <h2 id="hosting" className="text-xl font-semibold">4. Hosting</h2>
            <p className="mt-3">
              Unsere Website wird von externen Anbietern betrieben, darunter Vercel Inc., 340 S Lemon Ave #4133, Walnut,
              CA 91789, USA, und Supabase Inc., 9700 Great Hills Trail #150, Austin, TX 78759, USA. Die Speicherung
              personenbezogener Daten auf deren Servern dient der sicheren und effizienten Bereitstellung unserer Website.
              Die Verarbeitung erfolgt auf Grundlage der Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) und unseres
              berechtigten Interesses an einem stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO); sofern eine Einwilligung
              abgefragt wurde, zusätzlich auf Basis von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG.
            </p>
            <p className="mt-3">
              Die Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Frameworks (Vercel Inc.) oder der
              Standardvertragsklauseln der EU-Kommission (Art. 44 ff. DSGVO) (Supabase Inc., Kopien auf Anfrage). Die
              Speicherdauer richtet sich nach technischen Notwendigkeiten und gesetzlichen Aufbewahrungspflichten.
            </p>
            <p className="mt-3">
              Mit den oben genannten Anbietern wurden Auftragsverarbeitungsverträge (AVV) geschlossen.
            </p>
          </section>

          <section aria-labelledby="rechte-allgemein">
            <h2 id="rechte-allgemein" className="text-xl font-semibold">5. Allgemeine Hinweise zu Ihren Rechten</h2>
            <p className="mt-3">
              Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
              und Widerruf von Einwilligungen (Art. 15 – 20, 7 DSGVO). Außerdem können Sie aus besonderen Gründen der
              Verarbeitung widersprechen (Art. 21 DSGVO).
            </p>
            <p className="mt-3">
              Im Falle datenschutzrechtlicher Verstöße steht Ihnen nach Art. 77 Abs. 1 DSGVO ein Beschwerderecht bei einer
              Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes
              oder des Orts des mutmaßlichen Verstoßes. Unter diesem Link finden Sie eine Auflistung der Landesdatenschutzbeauftragten,
              insbesondere des Hessischen Beauftragten für Datenschutz und Informationsfreiheit:{' '}
              <a
                className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                href="https://www.bfdi.bund.de/DE/Service/Anschriften/anschriften_table.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.bfdi.bund.de/DE/Service/Anschriften/anschriften_table.html
              </a>
            </p>
            <p className="mt-3">
              <strong>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit</strong><br />
              Gustav-Stresemann-Ring 1, 65189 Wiesbaden<br />
              Telefon: +49 611 1408-0
            </p>
            <p className="mt-3">
              Der Verantwortliche stellt eine Kopie der personenbezogenen Daten, die Gegenstand der Verarbeitung sind,
              zur Verfügung (Art. 15 Abs. 3 S. 1 DSGVO).
            </p>
            <p className="mt-3">
              Für alle Anfragen wenden Sie sich bitte an{' '}
              <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">
                kontakt@kaufmann-health.de
              </a>.
            </p>
          </section>

          <section aria-labelledby="erfassung">
            <h2 id="erfassung" className="text-xl font-semibold">6. Datenerfassung und Dienste</h2>
            <div className="mt-3 space-y-6">
              <div>
                <h3 id="cookies" className="font-medium">Cookies und Tracking-Technologien</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>Cookie-Verwendung:</strong> Wir verwenden Cookies nur nach Ihrer ausdrücklichen Einwilligung
                    gemäß Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG.
                  </p>
                  <p><strong>Arten von Cookies:</strong></p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Notwendige Cookies:</strong> Technisch erforderlich für Grundfunktionen (z. B. Sitzungsverwaltung
                      im Admin‑Bereich). Rechtsgrundlage: § 25 Abs. 2 TDDDG.
                    </li>
                    {COOKIES_ENABLED && (
                      <li>
                        <strong>Marketing‑Cookies:</strong> Google Ads Conversion‑Tracking zur Messung der Werbewirksamkeit.
                        Nur mit Ihrer Einwilligung.
                      </li>
                    )}
                  </ul>
                  {COOKIES_ENABLED && (
                    <>
                      <p>
                        <strong>Google Ads Conversion‑Tracking:</strong> Bei Einwilligung setzen wir Google Ads Conversion‑Tracking
                        ein. Dabei können folgende Cookies gesetzt werden:
                      </p>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>_gcl_au: Speicherdauer 3 Monate</li>
                        <li>_gcl_aw: Speicherdauer 90 Tage</li>
                        <li>_gac_[property-id]: Speicherdauer 90 Tage</li>
                      </ul>
                      <p>
                        <strong>Consent Mode v2:</strong> Wir nutzen Google Consent Mode v2. Ohne Ihre Einwilligung werden keine
                        Marketing‑Cookies gesetzt; Google erhält lediglich anonymisierte Signale zur groben Schätzung von Conversions.
                      </p>
                    </>
                  )}
                  <p>
                    <strong>Zusätzlich:</strong> Zur weiteren Optimierung übermitteln wir verschlüsselte (gehashte) E‑Mail‑Adressen
                    server‑seitig an Google Ads (Enhanced Conversions). Dies erfolgt ohne Cookies auf Ihrem Gerät.
                  </p>
                  <p>
                    <strong>Widerruf:</strong> Sie können Ihre Einwilligung jederzeit widerrufen. Klicken Sie dazu auf
                    „Cookie‑Einstellungen&quot; im Footer unserer Website.
                  </p>
                  <p>
                    Für kleine Komfortfunktionen (z. B. damit ein Hinweis pro Sitzung nur einmal erscheint) nutzen wir ggf. den
                    lokalen Speicher Ihres Browsers (<span className="font-mono">sessionStorage</span>/<span className="font-mono">localStorage</span>).
                    Dabei werden keine personenbezogenen Profile erstellt, keine Daten an Dritte übermittelt und keine Cookies gesetzt.
                  </p>
                  <p>
                    Technische Server-Logs können aus Sicherheitsgründen Informationen wie IP-Adresse und User-Agent enthalten.
                    Es findet kein Tracking und kein Profiling statt.
                  </p>
                  {COOKIES_ENABLED && (
                    <p>
                      Weiterführende Informationen finden Sie in der{' '}
                      <a
                        className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                        href="https://policies.google.com/privacy?hl=de"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Datenschutzerklärung von Google
                      </a>.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium">Web-Analyse (cookieless)</h3>
                <p className="mt-2">
                  Zur Verbesserung unserer Website nutzen wir Vercel Web Analytics. Dabei werden ausschließlich aggregierte
                  Nutzungsdaten, wie Seitenaufrufe oder grundlegende Performance-Metriken, erhoben. Es werden keine Cookies
                  gesetzt, und es werden keine personenbezogenen Profile erstellt. Die Verarbeitung erfolgt auf Grundlage
                  unseres berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO).
                </p>
              </div>

              <div>
                <h3 className="font-medium">Erfolgsmessung unserer Werbung</h3>
                <p className="mt-2">
                  Zur Optimierung unserer Werbekampagnen übermitteln wir verschlüsselte E-Mail-Adressen an Google Ads, wenn
                  Sie unser Kontaktformular nutzen. Dies erfolgt serverseitig ohne Cookies auf Ihrem Gerät.
                </p>
                <p className="mt-2">
                  Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).<br />
                  Widerrufsrecht:{' '}
                  <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">
                    kontakt@kaufmann-health.de
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-medium">Datenübermittlung in die USA</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Empfänger ist Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, mit möglicher
                    Übermittlung in die USA auf Grundlage des EU-US Data Privacy Frameworks oder der Standardvertragsklauseln
                    der EU-Kommission (Art. 44 ff. DSGVO). Die Speicherdauer wird von Google bestimmt.
                  </p>
                  <p>
                    <strong>Hinweis zur Rechtslage:</strong> Stand Oktober 2025 besteht der Angemessenheitsbeschluss für das
                    EU-US Data Privacy Framework fort. Jedoch bestehen aufgrund politischer Entwicklungen in den USA rechtliche
                    Unsicherheiten über dessen Fortbestand. Wir beobachten die Entwicklung fortlaufend und werden bei einem
                    Wegfall des Angemessenheitsbeschlusses auf Standardvertragsklauseln der EU-Kommission ausweichen.
                  </p>
                  <p>
                    Rechtsgrundlage: Bei bestehendem Angemessenheitsbeschluss: Art. 45 DSGVO. Hilfsweise, bei Wegfall:
                    Art. 49 Abs. 1 lit. a DSGVO (Einwilligung).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Ereignis- und Fehlerprotokolle (PII-frei)</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Zur Sicherstellung des stabilen Betriebs, zur Fehlerdiagnose und zur Missbrauchsabwehr speichern wir
                    technische Ereignisse und Fehlermeldungen in einem internen Protokoll. Personenbezogene Inhalte werden
                    nicht gespeichert; Protokolldaten enthalten ausschließlich anonymisierte bzw. abgeleitete Informationen
                    (z. B. Ereignistyp, Zeitpunkt, ggf. gekürzte Metadaten).
                  </p>
                  <p>
                    IP-Adressen werden vor Speicherung mit einem sog. &quot;Salt&quot; irreversibel gehasht. Der verwendete User-Agent
                    kann in gekürzter Form gespeichert werden. Es erfolgt kein Tracking und kein Profiling.
                  </p>
                  <p>
                    Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit/Stabilität des Dienstes).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Google Workspace (E-Mail-Kommunikation)</h3>
                <p className="mt-2">
                  Für die Bearbeitung von Anfragen und die geschäftliche Kommunikation nutzen wir Google Workspace. Dabei
                  werden personenbezogene Daten wie Name, E-Mail-Adresse und Inhalte der Kommunikation verarbeitet. Die
                  Verarbeitung erfolgt auf Grundlage der Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) sowie unseres
                  berechtigten Interesses an effizienter Kommunikation (Art. 6 Abs. 1 lit. f DSGVO). Die Daten werden auf
                  Servern von Google Ireland Limited gespeichert; eine Übermittlung in die USA erfolgt ebenfalls auf
                  Grundlage des EU-US Data Privacy Frameworks oder der Standardvertragsklauseln. Die Speicherdauer richtet
                  sich nach gesetzlichen Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO). Weitere Informationen finden
                  Sie in der{' '}
                  <a
                    className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                    href="https://policies.google.com/privacy?hl=de"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Privacy Policy
                  </a>.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Kontaktformular</h3>
                <p className="mt-2">
                  Wenn Sie uns über das Kontaktformular kontaktieren, speichern wir Ihre Angaben zur Bearbeitung Ihrer Anfrage.
                  Rechtsgrundlage ist die Vertragserfüllung, berechtigtes Interesse oder Ihre Einwilligung (Art. 6 Abs. 1 lit.
                  a, b, f DSGVO). Die Daten werden gelöscht, sobald der Zweck entfällt, spätestens nach 24 Monaten.
                </p>
              </div>

              <div>
                <h3 className="font-medium">Therapeutenvermittlung</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Bei der Therapeutenvermittlung geben wir Ihre Kontaktdaten und ggf. Gesundheitsinformationen an ausgewählte
                    Therapeuten weiter. Dies erfolgt ausschließlich auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a, b DSGVO,
                    Art. 9 Abs. 2 lit. a DSGVO). Sie können diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.
                    Nach Widerruf wird die Vermittlung eingestellt und Ihre Daten innerhalb von 30 Tagen gelöscht, spätestens
                    jedoch nach zwei Jahren ohne Aktivität.
                  </p>
                  <p>
                    Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling gemäß Art. 22 Abs. 1 und 4 DSGVO
                    statt (Art. 13 Abs. 2 lit. f DSGVO). Alle Entscheidungen erfolgen manuell durch unser Team.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Vertragsdaten</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Bei der Registrierung von Therapeuten speichern wir die Vertragsannahme inklusive Zeitpunkt, IP-Adresse
                    (gehasht) und Vertragsversion. Dies dient der Dokumentation der Vertragsgültigkeit und erfolgt auf
                    Grundlage der Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Die Speicherdauer entspricht der Dauer der
                    Geschäftsbeziehung und den gesetzlichen Aufbewahrungspflichten, z. B. 10 Jahre nach § 147 AO und § 257 HGB.
                  </p>
                  <p>
                    Die Bereitstellung Ihrer personenbezogener Daten bei der Registrierung als Therapeut, der Kontaktaufnahme
                    über das Formular oder für den Newsletter ist für die Bearbeitung Ihrer Anfrage bzw. für den Vertragsabschluss
                    erforderlich (Art. 13 Abs. 2 lit. e DSGVO). Ohne diese Angaben können wir den Vertrag nicht abschließen oder
                    Ihre Anfrage nicht bearbeiten.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Kalenderbuchungen (Cal.com & Google Calendar)</h3>
                <div className="mt-2 space-y-2">
                  <p>
                    Für die Terminbuchung nutzen wir Cal.com (selbst gehostet unter cal.kaufmann.health). Therapeut:innen
                    können ihren Google Kalender mit Cal.com verbinden, um ihre Verfügbarkeit anzuzeigen und Buchungen
                    automatisch zu synchronisieren.
                  </p>
                  <p>Bei der Google Calendar-Integration werden folgende Daten verarbeitet:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Kalenderverfügbarkeit:</strong> Wir lesen bestehende Kalendereinträge (nur Titel und Zeitraum),
                      um freie Termine anzuzeigen
                    </li>
                    <li>
                      <strong>Buchungsereignisse:</strong> Bei einer Terminbuchung wird ein Kalendereintrag mit Datum,
                      Uhrzeit und Teilnehmerdaten erstellt
                    </li>
                  </ul>
                  <p><strong>Datenschutzmaßnahmen:</strong></p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>
                      <strong>Verschlüsselung:</strong> Alle Datenübertragungen erfolgen ausschließlich über TLS-verschlüsselte
                      Verbindungen (HTTPS)
                    </li>
                    <li>
                      <strong>Zugriffskontrolle:</strong> Der Zugriff auf Kalenderdaten ist strikt auf die für den
                      Buchungsvorgang notwendigen Informationen beschränkt
                    </li>
                    <li>
                      <strong>Keine dauerhafte Speicherung:</strong> Kalenderdaten werden nicht dauerhaft in unseren
                      Systemen gespeichert, sondern nur zur Laufzeit abgefragt
                    </li>
                    <li>
                      <strong>Keine Weitergabe:</strong> Kalenderdaten werden nicht an Dritte weitergegeben
                    </li>
                  </ul>
                  <p>
                    Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO
                    (Einwilligung), da Therapeut:innen die Kalenderverbindung aktiv herstellen.
                  </p>
                  <p>
                    <strong>Widerruf:</strong> Therapeut:innen können die Google Calendar-Verbindung jederzeit in den
                    Cal.com-Einstellungen trennen. Nach dem Trennen werden keine weiteren Kalenderdaten abgerufen.
                  </p>
                  <p>
                    Google LLC hat seinen Sitz in den USA. Die Datenübermittlung erfolgt auf Grundlage des EU-US Data
                    Privacy Framework (Angemessenheitsbeschluss der Europäischen Kommission gemäß Art. 45 DSGVO).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium">Newsletter</h3>
                <p className="mt-2">
                  Für den Bezug des Newsletters verarbeiten wir Ihre E-Mail-Adresse auf Grundlage Ihrer Einwilligung
                  (Art. 6 Abs. 1 lit. a DSGVO). Sie können die Einwilligung jederzeit über den Abmelde-Link widerrufen.
                  Nach Abmeldung kann Ihre Adresse in einer Sperrliste gespeichert werden, um weitere Zusendungen zu
                  verhindern (Art. 6 Abs. 1 lit. f DSGVO).
                </p>
              </div>

              <div>
                <h3 className="font-medium">Meldepflichten nach dem PStTG</h3>
                <p className="mt-2">
                  Sofern Sie als Anbieter (Therapeut) auf unserer Plattform tätig sind, sind wir gesetzlich verpflichtet,
                  bestimmte Daten (u. a. Steuer-ID, Honorarumsätze) zu erheben und an das Bundeszentralamt für Steuern zu melden.
                  Rechtsgrundlage ist Art. 6 Abs. 1 lit. c DSGVO i.V.m. den Bestimmungen des PStTG.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="gesundheitsdaten">
            <h2 id="gesundheitsdaten" className="text-xl font-semibold">7. Verarbeitung von Gesundheitsdaten (Art. 9 Abs. 2 DSGVO)</h2>
            <div className="mt-3 space-y-3">
              <p>
                Im Rahmen der Therapeutenvermittlung verarbeiten wir personenbezogene Gesundheitsdaten, die Sie freiwillig
                angeben. Die Verarbeitung erfolgt ausschließlich auf Grundlage Ihrer ausdrücklichen Einwilligung
                (Art. 9 Abs. 2 lit. a DSGVO). Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling
                nach Art. 22 DSGVO statt. Alle Entscheidungen erfolgen manuell durch unser Team.
              </p>
              <p>
                <strong>Widerrufsrecht:</strong> Sie können diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.
                Nach Widerruf wird die Vermittlung eingestellt und Ihre Daten innerhalb von 30 Tagen gelöscht, spätestens
                jedoch nach zwei Jahren ohne Aktivität.
              </p>
            </div>
          </section>

          <section aria-labelledby="speicherdauer">
            <h2 id="speicherdauer" className="text-xl font-semibold">8. Speicherdauer</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Kontakt- und Anfragedaten</strong> (z. B. über Formular, E-Mail, Telefon): werden nach abschließender
                Bearbeitung gelöscht, spätestens aber nach 24 Monaten, sofern keine weitere Geschäftsbeziehung entsteht oder
                Sie nicht vorher die Löschung verlangen.
              </li>
              <li>
                <strong>Daten aus der Therapeutenvermittlung:</strong> werden bei Widerruf Ihrer Einwilligung oder spätestens
                nach zwei Jahren ohne Aktivität gelöscht.
              </li>
              <li>
                <strong>Vertragsdaten</strong> (z. B. Therapeutenregistrierung): werden für die Dauer der Geschäftsbeziehung
                gespeichert und darüber hinaus entsprechend gesetzlicher Aufbewahrungspflichten.
              </li>
              <li>
                <strong>Newsletter-Daten:</strong> werden bis zu Ihrer Abmeldung gespeichert; eine Speicherung in einer
                Sperrliste („Blacklist&quot;) erfolgt, solange dies erforderlich ist, um weitere Zusendungen zu verhindern.
              </li>
              <li>
                <strong>Protokolldaten und technische Ereignisse:</strong> werden in der Regel maximal 90 Tage gespeichert
                und danach gelöscht oder anonymisiert.
              </li>
              <li>
                <strong>Gesetzliche Aufbewahrungspflichten:</strong> Nach steuer- und handelsrechtlichen Vorgaben
                (z. B. § 147 AO, § 257 HGB) müssen bestimmte Daten, wie Rechnungen und Vertragsunterlagen, bis zu zehn Jahre
                aufbewahrt werden. Während dieser Zeit wird die Verarbeitung eingeschränkt und die Daten ausschließlich zur
                Erfüllung der gesetzlichen Pflichten gespeichert.
              </li>
            </ul>
          </section>

          <section aria-labelledby="ihre-rechte">
            <h2 id="ihre-rechte" className="text-xl font-semibold">9. Ihre Rechte</h2>
            <p className="mt-3">
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit sowie Widerruf von Einwilligungen. Zudem können Sie aus besonderen Gründen der
              Verarbeitung widersprechen. Beschwerden können Sie bei der zuständigen Aufsichtsbehörde einreichen.
            </p>

            <h3 className="mt-4 font-medium">Rechte der betroffenen Person nach Art. 15–22 DSGVO</h3>
            <ol className="mt-3 list-decimal space-y-3 pl-6">
              <li>
                <strong>Recht auf Auskunft (Art. 15 DSGVO):</strong> Sie haben das Recht, Auskunft darüber zu erhalten,
                ob und welche personenbezogenen Daten von Ihnen verarbeitet werden, zu welchen Zwecken, an welche Empfänger
                sie übermittelt wurden und wie lange sie gespeichert werden.
              </li>
              <li>
                <strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger oder
                unvollständiger personenbezogener Daten verlangen.
              </li>
              <li>
                <strong>Recht auf Löschung („Recht auf Vergessenwerden&quot;, Art. 17 DSGVO):</strong> Sie können die Löschung
                Ihrer personenbezogenen Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten oder berechtigten
                Interessen zur Verarbeitung entgegenstehen.
              </li>
              <li>
                <strong>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Sie können unter bestimmten
                Voraussetzungen verlangen, dass die Verarbeitung Ihrer Daten eingeschränkt wird, z. B. wenn die Richtigkeit
                der Daten bestritten wird oder die Verarbeitung unrechtmäßig ist.
              </li>
              <li>
                <strong>Recht auf Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie haben das Recht, Ihre personenbezogenen
                Daten in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten und diese Daten an einen
                anderen Verantwortlichen zu übertragen, soweit die Verarbeitung auf einer Einwilligung oder einem Vertrag beruht.
              </li>
              <li>
                <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können aus Gründen, die sich aus Ihrer besonderen
                Situation ergeben, jederzeit gegen die Verarbeitung Ihrer personenbezogenen Daten Widerspruch einlegen,
                insbesondere gegen die Verarbeitung auf Grundlage berechtigter Interessen. Dies gilt auch für Profiling,
                das auf diese Rechtsgrundlage gestützt wird.
              </li>
              <li>
                <strong>Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> Sofern die Datenverarbeitung
                auf einer Einwilligung basiert, können Sie diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.
              </li>
              <li>
                <strong>Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO):</strong> Sie haben das Recht, sich
                bei einer Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
              </li>
              <li>
                <strong>Recht auf Information über automatisierte Entscheidungen und Profiling (Art. 22 DSGVO):</strong> Sofern
                automatisierte Entscheidungen einschließlich Profiling durchgeführt werden, haben Sie das Recht, Informationen
                über die Logik, Tragweite und angestrebten Auswirkungen dieser Verarbeitung zu erhalten.
                <br />
                <em className="text-gray-600">Hinweis: Auf unserer Website finden derzeit keine automatisierten Entscheidungen oder Profiling statt.</em>
              </li>
            </ol>
          </section>

          <div className="mt-8 pt-4 border-t text-sm text-gray-500">
            <p>Version: v2.1 – Kalenderbuchungen (Cal.com & Google Calendar) hinzugefügt</p>
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
