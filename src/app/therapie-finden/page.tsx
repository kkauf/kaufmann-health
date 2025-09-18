import Image from 'next/image';
import { EmailEntryForm } from '@/components/EmailEntryForm';
import FaqAccordion from '@/components/FaqAccordion';
import TherapyModalityExplanations from '@/components/TherapyModalityExplanations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Euro, Clock, MessageCircle, UserCheck, PhoneCall, ShieldCheck, Lock, Check } from 'lucide-react';
import { COOKIES_ENABLED } from '@/lib/config';

export const revalidate = 3600;

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
              Finden Sie körperorientierte Therapeut:innen in Ihrer Nähe. Persönlich kuratierte Empfehlungen für Selbstzahler. Termine innerhalb einer Woche.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700" aria-label="Vertrauen">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Geprüfte Profile
              </span>
              {!COOKIES_ENABLED && (
                <span className="inline-flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-700" />
                  Keine Tracking‑Cookies
                </span>
              )}
              <span className="inline-flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-indigo-600" />
                Transparente Datenverarbeitung
              </span>
            </div>

          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
            <Image
              src="/logos/Modalities/NARM.png"
              alt="NARM"
              width={240}
              height={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Hakomi.png"
              alt="Hakomi"
              width={240}
              height={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Somatic-Experiencing.png"
              alt="Somatic Experiencing"
              width={240}
              height={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Core-Energetics.png"
              alt="Core Energetics"
              width={240}
              height={80}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
              className="h-20 w-auto object-contain opacity-80"
            />
          </div>
        </div>

        <div className="lg:pl-6" id="top-form">
          <EmailEntryForm />
        </div>
        </div>
      </section>

      {/* EARTH-143: Discreet self-pay therapy (no insurance record) */}
      <section aria-labelledby="no-insurance" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <h2 id="no-insurance" className="text-2xl font-semibold">Diskrete Therapie ohne Krankenkasseneintrag</h2>
          <p className="mt-2 max-w-3xl text-gray-700">Ihre mentale Gesundheit, Ihre Privatsphäre.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <Lock className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Komplette Privatsphäre</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Keine S‑Nummer, kein Eintrag bei der Krankenkasse, keine ICD‑10‑Diagnose in Ihrer Kassenakte.</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Karrierefreundlich</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Relevanz für Verbeamtung sowie Lebens‑/Berufsunfähigkeitsversicherung. Beliebt bei Pilot:innen, Polizei, Führungskräften.</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Sofort starten</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Keine 3–9 Monate Wartezeit, kein Gutachterverfahren – direkte Terminvereinbarung.</CardDescription>
              </CardContent>
            </Card>
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
            <Card className="transition-all duration-200">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Activity className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">80%</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>der Klienten berichten von Verbesserungen nach fünf Sitzungen</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200">
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
            <Card className="transition-all duration-200">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <Clock className="h-5 w-5" />
                </div>
                <CardTitle className="text-3xl bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">Schnell</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Meist Termine innerhalb weniger Tage verfügbar</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Datenschutz & Vertrauen */}
      <section aria-labelledby="privacy-trust" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <h2 id="privacy-trust" className="text-2xl font-semibold">Datenschutz & Vertrauen</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Geprüfte Therapeut:innen</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Wir verifizieren Qualifikationen und Spezialisierungen manuell.</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <Lock className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Tracking‑Cookies'}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. Verwendung Ihrer Angaben nur zur Kontaktaufnahme.'}</CardDescription>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Transparente Prozesse</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>DSGVO-konforme Verarbeitung. Details in unserer <a className="underline" href="/datenschutz#cookies">Datenschutzerklärung</a>.</CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process */}
      <section aria-labelledby="process" className="mt-12 sm:mt-16">
        <h2 id="process" className="text-2xl font-semibold">So funktioniert&#39;s</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Card className="group relative overflow-hidden transition-all duration-200">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">1</div>
              </div>
              <CardTitle className="mt-2 text-lg">Sie schildern uns Ihre Situation</CardTitle>
              <CardDescription>Beschreiben Sie kurz Ihr Anliegen und Ihre Präferenzen.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="group relative overflow-hidden transition-all duration-200">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">2</div>
              </div>
              <CardTitle className="mt-2 text-lg">Wir wählen passende Therapeut:innen aus</CardTitle>
              <CardDescription>Wir prüfen unsere kuratierte Liste und wählen passende Therapeut:innen für Sie aus.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="group relative overflow-hidden transition-all duration-200">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">3</div>
              </div>
              <CardTitle className="mt-2 text-lg">Direkter Kontakt zu ausgewählten Therapeut:innen</CardTitle>
              <CardDescription>Sie erhalten direkte Kontaktdaten der ausgewählten Therapeut:innen.</CardDescription>
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
              <h3 id="personal-service" className="text-xl font-semibold">Persönlich ausgewählte Therapeut:innen-Empfehlungen</h3>
              <p className="mt-2 max-w-3xl text-gray-700">Wir kennen jede:n Therapeut:in persönlich und prüfen Qualifikation, Arbeitsweise und Verfügbarkeit. Auf dieser Basis sprechen wir eine kuratierte Auswahl aus.</p>
              <small className="mt-2 block text-xs text-gray-600">Dies ist eine Informationsberatung, keine medizinische oder therapeutische Empfehlung.</small>
            </div>
          </div>
        </div>
      </section>

      {/* Qualifications */}
      <section aria-labelledby="qualifications" className="mt-12 sm:mt-16">
        <h2 id="qualifications" className="text-2xl font-semibold">Unsere sorgfältig geprüften Therapeut:innen</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 text-slate-600" />
            <span>Heilpraktiker für Psychotherapie (staatlich geprüft)</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 text-slate-600" />
            <span>Zertifiziert in NARM, Hakomi oder Somatic Experiencing</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 text-slate-600" />
            <span>Mindestens 2 Jahre Praxiserfahrung</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 text-slate-600" />
            <span>Regelmäßige Supervision und Fortbildung</span>
          </div>
        </div>
      </section>

      {/* Therapy Modalities Explanations */}
      <TherapyModalityExplanations />

      {/* FAQ */}
      <section aria-labelledby="faq" className="mt-12 sm:mt-16">
        <h2 id="faq" className="text-2xl font-semibold">Häufige Fragen</h2>
        <div className="mt-6">
          <FaqAccordion
            items={[
              {
                id: 'kosten',
                question: 'Was kostet die Therapeut:innen-Empfehlung?',
                answer: 'Unser Service ist für Sie als Klient:in komplett kostenlos. Sie zahlen nur die Therapiesitzungen direkt an der/die Therapeut:in Ihrer Wahl.',
              },
              {
                id: 'selbstzahler',
                question: 'Warum Selbstzahler?',
                answer: 'Als Selbstzahler erhalten Sie sofort einen Termin, bestimmen selbst über Ihre Therapie und vermeiden Diagnosen in Ihrer Krankenakte. Viele Zusatzversicherungen erstatten Heilpraktiker-Leistungen.',
              },
              {
                id: 'kk-eintrag',
                question: 'Wird die Therapie bei meiner Krankenkasse dokumentiert?',
                answer: 'Nein. Unsere Therapeut:innen rechnen nicht über die gesetzliche Krankenkasse ab (keine S‑Nummer). Es erfolgt kein Eintrag in Ihrer Krankenakte und keine ICD‑10‑Diagnose bei der Kasse.',
              },
              {
                id: 'warum-diskret',
                question: 'Warum ist Selbstzahler‑Therapie diskreter?',
                answer: 'Ohne Kassenabrechnung bleibt Ihre Therapie privat. Das ist besonders relevant für Verbeamtung sowie Lebens‑/Berufsunfähigkeitsversicherung. Viele Menschen in sensiblen Berufen (Pilot:innen, Polizei, Führungskräfte) wählen deshalb bewusst die Selbstzahler‑Option.',
              },
              {
                id: 'koerperorientiert',
                question: 'Was ist körperorientierte Psychotherapie?',
                answer: 'Methoden wie NARM, Hakomi und Somatic Experiencing arbeiten mit der Verbindung zwischen Körper und Psyche. Sie lösen Traumata dort, wo sie gespeichert sind - im Nervensystem.',
              },
              {
                id: 'auswahl-prozess',
                question: 'Nach welchen Kriterien wählen Sie Therapeut:innen aus?',
                answer: 'Wir berücksichtigen Ihre geografischen Präferenzen, die Art Ihrer Problematik, gewünschte Therapieform und persönliche Faktoren. Da wir jede:n Therapeut:in in unserem Netzwerk persönlich kennen und regelmäßig in Kontakt stehen, können wir gezielt den/die für Sie passende:n vorschlagen.'
              },
              {
                id: 'termin',
                question: 'Wie schnell bekomme ich einen Termin?',
                answer: 'Nach Ihrer Anfrage erhalten Sie innerhalb von 24 Stunden Kontaktdaten passender Therapeut:innen. Die meisten haben kurzfristig Termine verfügbar.',
              },
              {
                id: 'kontakt',
                question: 'Kann ich selbst verschiedene Therapeut:innen kontaktieren?',
                answer: 'Selbstverständlich. Sie entscheiden eigenverantwortlich, welche Therapeut:innen Sie kontaktieren möchten. Wir stellen nur die Kontaktinformationen zur Verfügung.',
              },
              {
                id: 'datenschutz',
                question: 'Wie gehen Sie mit meinen Daten um?',
                answer: COOKIES_ENABLED
                  ? 'Wir verwenden Ihre Angaben ausschließlich, um passende Therapeut:innen vorzuschlagen und Ihnen deren Kontaktdaten bereitzustellen. Keine Analytics‑Cookies. Es wird lediglich ein minimales Conversion‑Signal an Google Ads gesendet. Details finden Sie in unserer Datenschutzerklärung.'
                  : 'Wir verwenden Ihre Angaben ausschließlich, um passende Therapeut:innen vorzuschlagen und Ihnen deren Kontaktdaten bereitzustellen. Keine Cookies, kein Tracking. Details finden Sie in unserer Datenschutzerklärung.',
              },
              {
                id: 'qualifikation',
                question: 'Wie stellen Sie die Qualifikation der Therapeut:innen sicher?',
                answer: 'Wir kennen jede:n Therapeut:in persönlich und prüfen Qualifikationen, Spezialisierungen und Verfügbarkeit vor der Empfehlung.',
              },
            ]}
          />
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="final-cta" className="mt-12 sm:mt-16 text-center">
        <h2 id="final-cta" className="text-2xl font-semibold">Lassen Sie uns Ihnen die passende:n Therapeut:in vorschlagen</h2>
        <p className="mt-2 text-gray-700">Erhalten Sie eine persönliche, kuratierte Empfehlung – kostenlos & unverbindlich.</p>
        <div className="mt-4 flex justify-center">
          <Button asChild size="lg">
            <a href="#top-form">Kostenlose Therapeut:innen-Empfehlung erhalten →</a>
          </Button>
        </div>
        <small className="mt-2 block text-xs text-gray-600">Wir melden uns innerhalb von 24 Stunden mit einer Auswahl</small>
      </section>

      {/* Footer legal note (page-specific) */}
      <section aria-labelledby="footer-legal" className="mt-12 sm:mt-16">
        <p id="footer-legal" className="text-xs text-gray-600">
          Kaufmann Health vermittelt qualifizierte Therapeut:innen basierend auf deren Qualifikationen, Verfügbarkeit und Ihren Präferenzen. Wir treffen keine medizinischen Empfehlungen bezüglich spezifischer Behandlungen. Die Entscheidung über eine Therapie treffen Sie eigenverantwortlich.
        </p>
      </section>
    </main>
  );
}
