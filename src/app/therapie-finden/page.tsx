import Image from 'next/image';
import TherapieFinderForm from '@/components/TherapieFinderForm';

export default function TherapieFindenPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Traumata lösen sich nicht durch Reden allein
          </h1>
          <p className="mt-4 max-w-xl text-gray-700">
            Finden Sie körperorientierte Therapeuten in Ihrer Nähe. Durchsuchbares Verzeichnis für Selbstzahler. Termine innerhalb einer Woche.
          </p>

          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
            <Image
              src="/logos/NARM.png"
              alt="NARM"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Hakomi.png"
              alt="Hakomi"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Somatic-Experiencing.png"
              alt="Somatic Experiencing"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Core-Energetics.png"
              alt="Core Energetics"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
          </div>
        </div>

        <div className="lg:pl-6">
          <TherapieFinderForm />
        </div>
      </section>

      {/* Trust Indicators */}
      <section aria-labelledby="trust" className="mt-12 sm:mt-16">
        <h2 id="trust" className="text-2xl font-semibold">Warum Körperpsychotherapie?</h2>
        <p className="mt-4 max-w-3xl text-gray-700">
          Traumatische Erfahrungen werden nicht nur im Kopf, sondern im gesamten Nervensystem gespeichert. Körperorientierte Therapieformen arbeiten direkt mit diesen somatischen Speicherungen.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-5 text-center">
            <div className="text-3xl font-semibold">80%</div>
            <div className="mt-1 text-sm text-gray-600">der Klienten berichten von Verbesserungen nach 5 Sitzungen</div>
          </div>
          <div className="rounded-lg border bg-white p-5 text-center">
            <div className="text-3xl font-semibold">€80-120</div>
            <div className="mt-1 text-sm text-gray-600">pro Sitzung bei Selbstzahlung</div>
          </div>
          <div className="rounded-lg border bg-white p-5 text-center">
            <div className="text-3xl font-semibold">7 Tage</div>
            <div className="mt-1 text-sm text-gray-600">durchschnittliche Zeit bis zum Ersttermin</div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section aria-labelledby="disclaimer" className="mt-10">
        <p id="disclaimer" className="rounded border-l-4 border-amber-400 bg-amber-50 p-3 text-xs text-gray-700">
          Kaufmann Health ist ein Informationsverzeichnis. Wir stellen Kontaktdaten zur Verfügung, vermitteln aber keine therapeutischen Leistungen. Die Therapiewahl liegt allein bei Ihnen.
        </p>
      </section>

      {/* Process */}
      <section aria-labelledby="process" className="mt-12 sm:mt-16">
        <h2 id="process" className="text-2xl font-semibold">So funktioniert&#39;s</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-5">
            <div className="text-sm text-gray-500">1</div>
            <h3 className="mt-1 text-lg font-medium">Verzeichnis durchsuchen</h3>
            <p className="mt-2 text-sm text-gray-600">Teilen Sie uns Ihren Standort mit und erhalten Sie Kontaktdaten - 100% vertraulich.</p>
          </div>
          <div className="rounded-lg border bg-white p-5">
            <div className="text-sm text-gray-500">2</div>
            <h3 className="mt-1 text-lg font-medium">Persönliche Orientierungshilfe</h3>
            <p className="mt-2 text-sm text-gray-600">Unsicher, welche Therapieform passt? Wir besprechen gerne Ihre Optionen und zeigen Ihnen relevante Therapeuten aus unserem Verzeichnis.</p>
          </div>
          <div className="rounded-lg border bg-white p-5">
            <div className="text-sm text-gray-500">3</div>
            <h3 className="mt-1 text-lg font-medium">Selbst auswählen & kontaktieren</h3>
            <p className="mt-2 text-sm text-gray-600">Sie erhalten Profile mit Verfügbarkeiten und kontaktieren Therapeuten eigenverantwortlich.</p>
          </div>
        </div>
      </section>

      {/* Personal Service */}
      <section aria-labelledby="personal-service" className="mt-12 sm:mt-16">
        <h3 id="personal-service" className="text-xl font-semibold">Persönliche Orientierungshilfe</h3>
        <p className="mt-2 max-w-3xl text-gray-700">Unsicher, welche Therapieform passt? Wir besprechen gerne Ihre Optionen und zeigen Ihnen relevante Therapeuten aus unserem Verzeichnis.</p>
        <small className="mt-2 block text-xs text-gray-600">Dies ist eine Informationsberatung, keine medizinische oder therapeutische Empfehlung.</small>
      </section>

      {/* Qualifications */}
      <section aria-labelledby="qualifications" className="mt-12 sm:mt-16">
        <h2 id="qualifications" className="text-2xl font-semibold">Therapeuten in unserem Verzeichnis</h2>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li>✓ Heilpraktiker für Psychotherapie (staatlich geprüft)</li>
          <li>✓ Zertifiziert in NARM, Hakomi oder Somatic Experiencing</li>
          <li>✓ Mindestens 2 Jahre Praxiserfahrung</li>
          <li>✓ Regelmäßige Supervision und Fortbildung</li>
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mt-12 sm:mt-16">
        <h2 id="faq" className="text-2xl font-semibold">Häufige Fragen</h2>
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-medium">Was kostet das Therapeuten-Verzeichnis?</h3>
            <p className="mt-1 text-sm text-gray-600">Das Verzeichnis ist für Sie als Patient komplett kostenlos. Sie zahlen nur die Therapiesitzungen direkt an den Therapeuten Ihrer Wahl.</p>
          </div>
          <div>
            <h3 className="font-medium">Warum Selbstzahler?</h3>
            <p className="mt-1 text-sm text-gray-600">Als Selbstzahler erhalten Sie sofort einen Termin, bestimmen selbst über Ihre Therapie und vermeiden Diagnosen in Ihrer Krankenakte. Viele Zusatzversicherungen erstatten Heilpraktiker-Leistungen.</p>
          </div>
          <div>
            <h3 className="font-medium">Was ist körperorientierte Psychotherapie?</h3>
            <p className="mt-1 text-sm text-gray-600">Methoden wie NARM, Hakomi und Somatic Experiencing arbeiten mit der Verbindung zwischen Körper und Psyche. Sie lösen Traumata dort, wo sie gespeichert sind - im Nervensystem.</p>
          </div>
          <div>
            <h3 className="font-medium">Wie schnell bekomme ich einen Termin?</h3>
            <p className="mt-1 text-sm text-gray-600">Die meisten Therapeuten in unserem Verzeichnis haben innerhalb von 7 Tagen Termine frei. Nach Ihrer Anfrage erhalten Sie innerhalb von 24 Stunden Kontaktmöglichkeiten.</p>
          </div>
          <div>
            <h3 className="font-medium">Kann ich selbst verschiedene Therapeuten kontaktieren?</h3>
            <p className="mt-1 text-sm text-gray-600">Selbstverständlich. Sie entscheiden eigenverantwortlich, welche Therapeuten Sie kontaktieren möchten. Wir stellen nur die Kontaktinformationen zur Verfügung.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="final-cta" className="mt-12 sm:mt-16 text-center">
        <h2 id="final-cta" className="text-2xl font-semibold">Bereit für Veränderung?</h2>
        <p className="mt-2 text-gray-700">Lassen Sie uns Ihnen Kontaktmöglichkeiten zu passenden Therapeuten zeigen.</p>
        <div className="mt-4 flex justify-center">
          <a href="#top-form" className="inline-flex items-center justify-center rounded-md bg-black px-5 py-2 text-white">Kostenloses Verzeichnis durchsuchen →</a>
        </div>
        <small className="mt-2 block text-xs text-gray-600">Wir senden Ihnen innerhalb von 24 Stunden Kontaktdaten</small>
      </section>

      {/* Footer legal note (page-specific) */}
      <section aria-labelledby="footer-legal" className="mt-12 sm:mt-16">
        <p id="footer-legal" className="text-xs text-gray-600">
          Kaufmann Health betreibt ein Informationsverzeichnis für Heilpraktiker für Psychotherapie. Wir treffen keine Auswahl oder Empfehlung bezüglich der Eignung einzelner Therapeuten für spezifische Behandlungen. Die Entscheidung über eine Therapie treffen Sie eigenverantwortlich.
        </p>
      </section>
    </main>
  );
}
