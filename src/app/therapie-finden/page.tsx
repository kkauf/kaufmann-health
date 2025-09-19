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
              Finde körperorientierte Therapeut:innen in deiner Nähe. Persönlich kuratierte Empfehlungen für Selbstzahler. Termine innerhalb einer Woche.
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
          <p className="mt-2 max-w-3xl text-gray-700">Deine mentale Gesundheit, deine Privatsphäre.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card className="transition-all duration-200">
              <CardHeader className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <Lock className="h-5 w-5" />
                </div>
                <CardTitle className="font-medium">Komplette Privatsphäre</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>Keine S‑Nummer, kein Eintrag bei der Krankenkasse, keine ICD‑10‑Diagnose in deiner Kassenakte.</CardDescription>
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
                <CardDescription>{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. Verwendung deiner Angaben nur zur Kontaktaufnahme.'}</CardDescription>
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

      {/* Footer legal note (page-specific) */}
      <section aria-labelledby="footer-legal" className="mt-12 sm:mt-16">
        <p id="footer-legal" className="text-xs text-gray-600">
          Kaufmann Health vermittelt qualifizierte Therapeut:innen basierend auf deren Qualifikationen, Verfügbarkeit und deinen Präferenzen. Wir treffen keine medizinischen Empfehlungen bezüglich spezifischer Behandlungen. Die Entscheidung über eine Therapie triffst du eigenverantwortlich.
        </p>
      </section>
    </main>
  );
}
