import Image from 'next/image';
import TherapieFinderForm from '@/components/TherapieFinderForm';
import FaqAccordion from '@/components/FaqAccordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Euro, Clock, MapPin, Compass, PhoneCall, ShieldCheck } from 'lucide-react';

export default function TherapieFindenPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <section aria-labelledby="hero" className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h1 id="hero" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Traumata lösen sich nicht durch Reden allein
            </h1>
            <p className="mt-4 max-w-xl text-gray-700">
              Finden Sie körperorientierte Therapeuten in Ihrer Nähe. Durchsuchbares Verzeichnis für Selbstzahler. Termine innerhalb einer Woche.
            </p>
 

          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
            <Image
              src="/logos/Modalities/NARM.png"
              alt="NARM"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Hakomi.png"
              alt="Hakomi"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Somatic-Experiencing.png"
              alt="Somatic Experiencing"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Core-Energetics.png"
              alt="Core Energetics"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
          </div>
        </div>

        <div className="lg:pl-6" id="top-form">
          <TherapieFinderForm />
        </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section aria-labelledby="trust" className="mt-12 sm:mt-16">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />
          <h2 id="trust" className="text-2xl font-semibold">Warum Körperpsychotherapie?</h2>
          <p className="mt-3 max-w-3xl text-gray-700">
            Traumatische Erfahrungen werden nicht nur im Kopf, sondern im gesamten Nervensystem gespeichert. Körperorientierte Therapieformen arbeiten direkt mit diesen somatischen Speicherungen.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Activity className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">80%</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>der Klienten berichten von Verbesserungen nach 5 Sitzungen</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-sky-50 p-2 text-sky-600">
                  <Euro className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">€80-120</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>pro Sitzung bei Selbstzahlung</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">7 Tage</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>durchschnittliche Zeit bis zum Ersttermin</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      

      {/* Process */}
      <section aria-labelledby="process" className="mt-12 sm:mt-16">
        <h2 id="process" className="text-2xl font-semibold">So funktioniert&#39;s</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">1</div>
              </div>
              <CardTitle className="mt-2 text-lg">Verzeichnis durchsuchen</CardTitle>
              <CardDescription>Teilen Sie uns Ihren Standort mit und erhalten Sie Kontaktdaten - 100% vertraulich.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                  <Compass className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">2</div>
              </div>
              <CardTitle className="mt-2 text-lg">Persönliche Orientierungshilfe</CardTitle>
              <CardDescription>Unsicher, welche Therapieform passt? Wir besprechen gerne Ihre Optionen und zeigen Ihnen relevante Therapeuten aus unserem Verzeichnis.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">3</div>
              </div>
              <CardTitle className="mt-2 text-lg">Selbst auswählen & kontaktieren</CardTitle>
              <CardDescription>Sie erhalten Profile mit Verfügbarkeiten und kontaktieren Therapeuten eigenverantwortlich.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Personal Service */}
      <section aria-labelledby="personal-service" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 id="personal-service" className="text-xl font-semibold">Persönliche Orientierungshilfe</h3>
              <p className="mt-2 max-w-3xl text-gray-700">Unsicher, welche Therapieform passt? Wir besprechen gerne Ihre Optionen und zeigen Ihnen relevante Therapeuten aus unserem Verzeichnis.</p>
              <small className="mt-2 block text-xs text-gray-600">Dies ist eine Informationsberatung, keine medizinische oder therapeutische Empfehlung.</small>
            </div>
          </div>
        </div>
      </section>

      {/* Qualifications */}
      <section aria-labelledby="qualifications" className="mt-12 sm:mt-16">
        <h2 id="qualifications" className="text-2xl font-semibold">Therapeuten in unserem Verzeichnis</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">✓ Heilpraktiker für Psychotherapie (staatlich geprüft)</div>
          <div className="rounded-lg border bg-white p-4">✓ Zertifiziert in NARM, Hakomi oder Somatic Experiencing</div>
          <div className="rounded-lg border bg-white p-4">✓ Mindestens 2 Jahre Praxiserfahrung</div>
          <div className="rounded-lg border bg-white p-4">✓ Regelmäßige Supervision und Fortbildung</div>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mt-12 sm:mt-16">
        <h2 id="faq" className="text-2xl font-semibold">Häufige Fragen</h2>
        <div className="mt-6">
          <FaqAccordion
            items={[
              {
                id: 'kosten',
                question: 'Was kostet das Therapeuten-Verzeichnis?',
                answer: 'Das Verzeichnis ist für Sie als Patient komplett kostenlos. Sie zahlen nur die Therapiesitzungen direkt an den Therapeuten Ihrer Wahl.',
              },
              {
                id: 'selbstzahler',
                question: 'Warum Selbstzahler?',
                answer: 'Als Selbstzahler erhalten Sie sofort einen Termin, bestimmen selbst über Ihre Therapie und vermeiden Diagnosen in Ihrer Krankenakte. Viele Zusatzversicherungen erstatten Heilpraktiker-Leistungen.',
              },
              {
                id: 'koerperorientiert',
                question: 'Was ist körperorientierte Psychotherapie?',
                answer: 'Methoden wie NARM, Hakomi und Somatic Experiencing arbeiten mit der Verbindung zwischen Körper und Psyche. Sie lösen Traumata dort, wo sie gespeichert sind - im Nervensystem.',
              },
              {
                id: 'termin',
                question: 'Wie schnell bekomme ich einen Termin?',
                answer: 'Die meisten Therapeuten in unserem Verzeichnis haben innerhalb von 7 Tagen Termine frei. Nach Ihrer Anfrage erhalten Sie innerhalb von 24 Stunden Kontaktmöglichkeiten.',
              },
              {
                id: 'kontakt',
                question: 'Kann ich selbst verschiedene Therapeuten kontaktieren?',
                answer: 'Selbstverständlich. Sie entscheiden eigenverantwortlich, welche Therapeuten Sie kontaktieren möchten. Wir stellen nur die Kontaktinformationen zur Verfügung.',
              },
            ]}
          />
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
