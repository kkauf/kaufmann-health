import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import FaqAccordion from "@/components/FaqAccordion";
import TherapistApplicationForm from "@/components/TherapistApplicationForm";
import { CheckCircle2, Target, Users, Clock, Shield, TrendingUp, ShieldCheck, Lock, UserCheck } from "lucide-react";
import CtaLink from "@/components/CtaLink";
import { COOKIES_ENABLED } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Neue Klienten für Ihre Praxis | Für Therapeuten | Kaufmann Health",
  description:
    "Werden Sie Teil unseres kuratierten Netzwerks. Zahlen Sie nur eine Erfolgsgebühr, wenn Klienten über unsere Plattform zu Ihnen finden.",
  alternates: { canonical: "/fuer-therapeuten" },
  openGraph: {
    title: "Neue Klienten für Ihre Praxis | Für Therapeuten",
    description:
      "Spezialisiertes, kuratiertes Therapeuten-Netzwerk mit erfolgsbasierter Vergütung. Keine Vorabkosten.",
  },
};

const faqItems = [
  {
    id: "fuer-therapeuten-faq-fee",
    question: "Wie hoch ist die Erfolgsgebühr?",
    answer:
      "Für jeden vermittelten Klienten fallen für die ersten 10 Sitzungen jeweils 25% des Sitzungshonorars als Erfolgsgebühr an. Diese Gebühr fällt nur für Klienten an, die über unser Netzwerk zu Ihnen findet. Nach 10 Sitzungen gehören die Klienten Ihnen, d.h. es fallen keine weiteren Gebühren an. Kommt ein Klient nicht mehr, zahlen Sie nicht mehr.",
  },
  {
    id: "fuer-therapeuten-faq-who",
    question: "Welche Therapeuten nehmen Sie in das Netzwerk auf?",
    answer:
      "Heilpraktiker für Psychotherapie oder approbierte Psychotherapeuten mit Spezialisierung auf körperorientierte Verfahren (z. B. NARM, Hakomi, Somatic Experiencing, Core Energetics).",
  },
  {
    id: "fuer-therapeuten-faq-volume",
    question: "Wie viele Anfragen erhalte ich?",
    answer:
      "Das hängt von Ihrer Region und Verfügbarkeit ab. In Ballungsräumen erhalten Therapeuten meist 2–5 Kontakte pro Monat über unser Netzwerk.",
  },
  {
    id: "fuer-therapeuten-faq-reject",
    question: "Kann ich Anfragen ablehnen?",
    answer:
      "Ja, Sie entscheiden selbst, welche Klienten Sie übernehmen möchten. Es besteht keine Verpflichtung.",
  },
  {
    id: "fuer-therapeuten-faq-diff",
    question: "Wie unterscheiden Sie sich von anderen Plattformen?",
    answer:
      "Wir bieten zusätzlich eine persönliche Orientierungshilfe für Interessenten und fokussieren uns ausschließlich auf körperorientierte Therapieverfahren.",
  },
  {
    id: 'auswahl-prozess',
    question: 'Nach welchen Kriterien wählen Sie Therapeuten aus?',
    answer: 'Wir berücksichtigen Ihre geografischen Präferenzen, die Art Ihrer Problematik, gewünschte Therapieform und persönliche Faktoren. Da wir jeden Therapeuten in unserem Netzwerk persönlich kennen und regelmäßig mit ihnen in Kontakt stehen, können wir gezielt den für Sie passenden vorschlagen.'
  },
  {
    id: 'datenschutz-therapeuten',
    question: 'Wie gehen Sie mit meinen Daten um?',
    answer: COOKIES_ENABLED
      ? 'Wir verwenden Ihre Angaben ausschließlich zur Prüfung Ihrer Aufnahme und zur Vermittlung passender Klienten. Keine Analytics‑Cookies. Es wird lediglich ein minimales Conversion‑Signal an Google Ads gesendet. Details in unserer Datenschutzerklärung.'
      : 'Wir verwenden Ihre Angaben ausschließlich zur Prüfung Ihrer Aufnahme und zur Vermittlung passender Klienten. Keine Cookies, kein Tracking. Details in unserer Datenschutzerklärung.'
  },
];

export default function TherapistsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Neue Klienten für Ihre Praxis | Für Therapeuten | Kaufmann Health",
            description:
              "Werden Sie Teil unseres kuratierten Netzwerks. Zahlen Sie nur eine Erfolgsgebühr, wenn Klienten über unsere Plattform zu Ihnen finden.",
          }),
        }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Therapeuten-Empfehlungen",
            provider: { "@type": "Organization", name: "Kaufmann Health" },
            areaServed: "DE",
            audience: { "@type": "Audience", audienceType: "HealthcareProfessional" },
            offers: {
              "@type": "Offer",
              description: "Erfolgsbasierte Vergütung: 25% der ersten 10 Sitzungen, danach 0%",
            },
          }),
        }}
      />
      {/* Hero */}
      <section
        aria-labelledby="hero"
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />
        <h1 id="hero" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Neue Klienten für Ihre Praxis
        </h1>
        <p className="mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
          Werden Sie Teil unseres kuratierten Netzwerks. Zahlen Sie nur eine Erfolgsgebühr, wenn Klienten über unsere Plattform zu Ihnen finden.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700" aria-label="Vertrauen">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Geprüfte Anfragen
          </span>
          {!COOKIES_ENABLED && (
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-700" />
              Keine Cookies
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-indigo-600" />
            Transparente Datenverarbeitung
          </span>
        </div>
        <div className="mt-6">
          <Button size="lg" asChild data-cta="therapists-hero-apply" data-audience="therapists">
            <CtaLink href="#apply-form" eventType="cta_click" eventId="fuer-therapeuten-hero-apply">
              In Netzwerk aufnehmen lassen →
            </CtaLink>
          </Button>
        </div>
      </section>

      {/* Logos strip */}
      <section aria-labelledby="logos" className="mt-10 sm:mt-12">
        <h2 id="logos" className="sr-only">Fokus auf körperorientierte Verfahren</h2>
        <div className="rounded-2xl border bg-white/60 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <Image src="/logos/Modalities/NARM.png" alt="NARM" width={120} height={40} className="h-8 w-auto opacity-70 grayscale" />
            <Image src="/logos/Modalities/Hakomi.png" alt="Hakomi" width={120} height={40} className="h-8 w-auto opacity-70 grayscale" />
            <Image src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing" width={160} height={40} className="h-8 w-auto opacity-70 grayscale" />
            <Image src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" width={160} height={40} className="h-8 w-auto opacity-70 grayscale" />
          </div>
        </div>
      </section>

      {/* Problem (Social Proof) */}
      <section aria-labelledby="problem" className="mt-12 sm:mt-16">
        <h2 id="problem" className="sr-only">Problem</h2>
        <blockquote className="rounded-2xl border bg-gradient-to-r from-rose-50 to-orange-50 p-6 text-gray-800 sm:p-8">
          <p className="text-base sm:text-lg">„Ich habe 175€ für Werbung ausgegeben und keine einzige Anfrage bekommen.“</p>
          <footer className="mt-2 text-sm text-gray-600">– Hakomi-Therapeutin aus Berlin</footer>
        </blockquote>
      </section>

      {/* Solution */}
      <section aria-labelledby="solution" className="mt-12 sm:mt-16">
        <h2 id="solution" className="text-2xl font-semibold">Unser Empfehlungsservice</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <Target className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 font-medium">Spezialisiertes Netzwerk</h3>
            <p className="mt-1 text-sm text-gray-600">Fokus auf körperorientierte Verfahren</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 font-medium">Erfolgsbasiert</h3>
            <p className="mt-1 text-sm text-gray-600">25% für die ersten 10 Sitzungen</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 font-medium">Faire Konditionen</h3>
            <p className="mt-1 text-sm text-gray-600">Danach 0%, Klienten gehören Ihnen</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 font-medium">Flexibel</h3>
            <p className="mt-1 text-sm text-gray-600">Jederzeit kündbar</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mt-12 sm:mt-16">
        <h2 id="how" className="text-2xl font-semibold">So funktioniert unser Empfehlungsservice</h2>
        <div className="relative mt-6 pl-8">
          <div className="absolute inset-y-0 left-3 w-px bg-slate-200" />
          <ol className="space-y-6 text-gray-700">
            <li className="relative">
              <span className="absolute -left-8 top-0 grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">1</span>
              <p><strong>Kostenlose Aufnahme</strong> – Wir prüfen Ihre Qualifikationen und nehmen Sie in unser Netzwerk auf</p>
            </li>
            <li className="relative">
              <span className="absolute -left-8 top-0 grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">2</span>
              <p><strong>Sichtbarkeit für Interessenten</strong> – Klienten finden Sie über unser Netzwerk und unsere Orientierungshilfe</p>
            </li>
            <li className="relative">
              <span className="absolute -left-8 top-0 grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">3</span>
              <p><strong>Direkter Kontakt</strong> – Interessenten kontaktieren Sie direkt und vereinbaren Termine</p>
            </li>
            <li className="relative">
              <span className="absolute -left-8 top-0 grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">4</span>
              <p><strong>Erfolgsbasierte Gebühr</strong> – Nur wenn Klienten über unser Netzwerk zu Ihnen finden, zahlen Sie 25% der ersten 10 Sitzungen</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Requirements */}
      <section aria-labelledby="requirements" className="mt-12 sm:mt-16">
        <h2 id="requirements" className="text-2xl font-semibold">Voraussetzungen für die Aufnahme ins Netzwerk</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-xl border bg-white p-4 text-gray-700"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> Heilpraktiker für Psychotherapie oder approbierter Psychotherapeut</li>
          <li className="flex items-start gap-3 rounded-xl border bg-white p-4 text-gray-700"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> Spezialisierung auf körperorientierte Verfahren (NARM, Hakomi, Somatic Experiencing, Core Energetics)</li>
          <li className="flex items-start gap-3 rounded-xl border bg-white p-4 text-gray-700"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> Mindestens 2 Jahre Praxiserfahrung</li>
          <li className="flex items-start gap-3 rounded-xl border bg-white p-4 text-gray-700"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> Bereitschaft für Selbstzahler-Klienten</li>
          <li className="flex items-start gap-3 rounded-xl border bg-white p-4 text-gray-700 sm:col-span-2"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> Verfügbarkeit für neue Klienten</li>
        </ul>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits" className="mt-12 sm:mt-16">
        <h2 id="benefits" className="text-2xl font-semibold">Ihre Vorteile</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 text-lg font-medium">Keine Vorabkosten</h3>
            <p className="mt-1 text-sm text-gray-600">Zahlen Sie nur bei Erfolg</p>
          </div>
          <div className="rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <Target className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 text-lg font-medium">Zielgerichtete Sichtbarkeit</h3>
            <p className="mt-1 text-sm text-gray-600">Alle Anfragen kommen von vorinteressierten Selbstzahlern</p>
          </div>
          <div className="rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <Clock className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 text-lg font-medium">Zeitersparnis</h3>
            <p className="mt-1 text-sm text-gray-600">Kein Marketing, keine Kaltakquise notwendig</p>
          </div>
          <div className="rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 text-lg font-medium">Faire Konditionen</h3>
            <p className="mt-1 text-sm text-gray-600">Nach 10 Sitzungen gehören Klienten komplett Ihnen</p>
          </div>
          <div className="rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-md">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="mt-2 text-lg font-medium">Flexible Teilnahme</h3>
            <p className="mt-1 text-sm text-gray-600">Jederzeit kündbar, keine Mindestlaufzeit</p>
          </div>
        </div>
      </section>

      {/* Qualitätsversprechen */}
      <section aria-labelledby="quality-promise" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-white p-6 sm:p-8">
          <h2 id="quality-promise" className="text-2xl font-semibold">Qualitätsversprechen</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium">Geprüfte Klienten</p>
                <p className="text-sm text-gray-600">Anfragen werden vorqualifiziert und zielgerichtet weitergeleitet.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4">
              <Lock className="mt-0.5 h-5 w-5 text-slate-700" />
              <div>
                <p className="font-medium">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Cookies'}</p>
                <p className="text-sm text-gray-600">{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. DSGVO‑konforme Prozesse.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-slate-50 p-4">
              <UserCheck className="mt-0.5 h-5 w-5 text-indigo-600" />
              <div>
                <p className="font-medium">Transparente Datenverarbeitung</p>
                <p className="text-sm text-gray-600">Ihre Daten werden ausschließlich zur Vermittlung verwendet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service description (legal wording) */}
      <section aria-labelledby="service" className="mt-12 sm:mt-16">
        <h2 id="service" className="text-2xl font-semibold">Unser Service im Detail</h2>
        <div className="mt-4 rounded-xl border bg-slate-50 p-5">
          <p className="max-w-prose text-sm text-gray-700">
            Kaufmann Health ist eine Vermittlungsplattform für Heilpraktiker der Psychotherapie. 
            Wir vermitteln qualifizierte Therapeuten an passende Klienten. 
            Wir geben keine medizinischen oder therapeutischen Empfehlungen und garantieren keine Behandlungserfolge.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mt-12 sm:mt-16">
        <h2 id="faq" className="text-2xl font-semibold">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* Application CTA + Form */}
      <section aria-labelledby="apply" className="mt-12 sm:mt-16">
        <div className="rounded-2xl border bg-gradient-to-b from-indigo-50 to-white p-6 sm:p-8">
          <h2 id="apply" className="text-2xl font-semibold">Bereit für mehr Sichtbarkeit?</h2>
          <p className="mt-2 text-gray-700">
            Werden Sie jetzt Teil unseres kuratierten Netzwerks für körperorientierte Psychotherapie.
          </p>
          <div className="mt-8">
            <TherapistApplicationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
