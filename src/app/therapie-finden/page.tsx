import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Euro, Clock, UserCheck, ShieldCheck, Lock } from 'lucide-react';
import { COOKIES_ENABLED } from '@/lib/config';
import { LandingHero } from '@/features/landing/components/LandingHero';
import { PrivacySelfPaySection } from '@/features/landing/components/PrivacySelfPaySection';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export const metadata: Metadata = {
  title: 'Therapeut:innen finden – Körperorientierte Trauma-Therapie | Kaufmann Health',
  description: 'Finde geprüfte körperorientierte Therapeut:innen in deiner Nähe. Persönlich kuratierte Empfehlungen für Selbstzahler. Termine innerhalb einer Woche.',
  alternates: {
    canonical: `${baseUrl}/therapie-finden`,
  },
  openGraph: {
    title: 'Therapeut:innen finden – Körperorientierte Trauma-Therapie',
    description: 'Persönlich kuratierte Therapeut:innen-Empfehlungen für körperorientierte Psychotherapie (NARM, Hakomi, Somatic Experiencing).',
    url: `${baseUrl}/therapie-finden`,
    type: 'website',
    images: [
      {
        url: `${baseUrl}/logos/Health Logos - black/Kaufmann_health_logo_large.png`,
        width: 1200,
        height: 630,
        alt: 'Kaufmann Health – Therapeut:innen finden',
      },
    ],
  },
};

export default function TherapieFindenPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <LandingHero
        title="Traumata lösen sich nicht durch Reden allein"
        subtitle={
          <>Finde körperorientierte Therapeut:innen in deiner Nähe. Persönlich kuratierte Empfehlungen für Selbstzahler. Termine innerhalb einer Woche.</>
        }
        showModalityLogos
        ctaPill={
          <Button size="lg" variant="outline" asChild data-cta="hero-secondary">
            <CtaLink href="#top-form" eventType="cta_click">80–120€ pro Sitzung</CtaLink>
          </Button>
        }
        analyticsQualifier="LP-Therapie-Finden"
      />

      {/* EARTH-143: Discreet self-pay therapy (no insurance record) */}
      <PrivacySelfPaySection />

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
