import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageAnalytics from "@/components/PageAnalytics";
import FaqAccordion from "@/components/FaqAccordion";
import TherapistApplicationForm from "@/features/leads/components/TherapistApplicationForm";
import { CheckCircle2, Target, Users, Clock, Shield, TrendingUp, ShieldCheck, Lock, UserCheck } from "lucide-react";
import CtaLink from "@/components/CtaLink";
import { COOKIES_ENABLED } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Neue Klient:innen für deine Praxis | Für Therapeut:innen | Kaufmann Health",
  description:
    "Bewirb dich für unser kuratiertes Netzwerk körperorientierter Therapeut:innen. Erfolgsbasierte Vergütung - Details nach Aufnahme.",
  alternates: { canonical: "/fuer-therapeuten" },
  openGraph: {
    title: "Neue Klient:innen für deine Praxis | Für Therapeut:innen",
    description:
      "Kuratiertes Therapeut:innen-Netzwerk mit erfolgsbasierter Vergütung. Bewerbung erforderlich.",
  },
};

const faqItems = [
  {
    id: "fuer-therapeuten-faq-fee",
    question: "Wie funktioniert die Vergütung?",
    answer:
      "Wir arbeiten erfolgsbasiert – du zahlst nur für tatsächlich vermittelte Klient:innen. Die genauen Konditionen besprechen wir nach erfolgreicher Aufnahme in unser Netzwerk. Keine Vorabkosten, keine Mindestlaufzeit.",
  },
  {
    id: "fuer-therapeuten-faq-who",
    question: "Welche Therapeut:innen nehmt ihr in das Netzwerk auf?",
    answer:
      "Heilpraktiker:innen für Psychotherapie oder approbierte Psychotherapeut:innen mit Spezialisierung auf körperorientierte Verfahren (z. B. NARM, Hakomi, Somatic Experiencing, Core Energetics).",
  },
  {
    id: "fuer-therapeuten-faq-volume",
    question: "Wie viele Anfragen erhalte ich?",
    answer:
      "Das hängt von deiner Region und Verfügbarkeit ab. In Ballungsräumen erhalten Therapeut:innen meist 2–5 Kontakte pro Monat über unser Netzwerk.",
  },
  {
    id: "fuer-therapeuten-faq-reject",
    question: "Kann ich Anfragen ablehnen?",
    answer:
      "Ja, du entscheidest selbst, welche Klient:innen du übernehmen möchtest. Es besteht keine Verpflichtung.",
  },
  {
    id: "fuer-therapeuten-faq-diff",
    question: "Wie unterscheidet ihr euch von anderen Plattformen?",
    answer:
      "Wir bieten zusätzlich eine persönliche Orientierungshilfe für Interessent:innen und fokussieren uns ausschließlich auf körperorientierte Therapieverfahren.",
  },
  {
    id: 'auswahl-prozess',
    question: 'Nach welchen Kriterien wählt ihr Therapeut:innen aus?',
    answer: 'Wir berücksichtigen deine geografischen Präferenzen, die Art deines Schwerpunkts, gewünschte Therapieform und persönliche Faktoren. Da wir jede:n Therapeut:in in unserem Netzwerk persönlich kennen und regelmäßig in Kontakt sind, können wir gezielt passende Vorschläge machen.'
  },
  {
    id: 'datenschutz-therapeuten',
    question: 'Wie geht ihr mit meinen Daten um?',
    answer: COOKIES_ENABLED
      ? 'Wir verwenden deine Angaben ausschließlich zur Prüfung deiner Aufnahme und zur Vermittlung passender Klient:innen. Keine Analytics‑Cookies. Es wird lediglich ein minimales Conversion‑Signal an Google Ads gesendet. Details in unserer Datenschutzerklärung.'
      : 'Wir verwenden deine Angaben ausschließlich zur Prüfung deiner Aufnahme und zur Vermittlung passender Klient:innen. Keine Cookies, kein Tracking. Details in unserer Datenschutzerklärung.'
  },
];

export default function TherapistsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <PageAnalytics qualifier="Fuer-Therapeuten" />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Neue Klient:innen für deine Praxis | Für Therapeut:innen | Kaufmann Health",
            description:
              "Werde Teil unseres handverlesenen Netzwerks. Du zahlst nur eine Erfolgsgebühr, wenn Klient:innen über unsere Plattform zu dir finden.",
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
              description: "Kuratiertes Netzwerk mit erfolgsbasierter Vergütung",
            },
          }),
        }}
      />
      {/* Hero */}
      <section
        aria-labelledby="hero"
        className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />
        <h1 id="hero" className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
          Bewirb dich für unser kuratiertes Netzwerk
        </h1>
        <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-700">
          Wir suchen ausgewählte Heilpraktiker:innen für Psychotherapie mit Spezialisierung auf körperorientierte Verfahren. Erfolgsbasierte Vergütung – du zahlst nur für tatsächlich vermittelte Klient:innen.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-base text-gray-700" aria-label="Vertrauen">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Geprüfte Anfragen
          </span>
          {!COOKIES_ENABLED && (
            <span className="inline-flex items-center gap-2">
              <Lock className="h-5 w-5 text-slate-700" />
              Keine Cookies
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            Transparente Datenverarbeitung
          </span>
        </div>
        <div className="mt-8">
          <Button
            size="lg"
            asChild
            data-cta="therapists-hero-apply"
            data-audience="therapists"
            className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
          >
            <CtaLink href="#apply-form" eventType="cta_click" eventId="fuer-therapeuten-hero-apply">
              Jetzt bewerben →
            </CtaLink>
          </Button>
        </div>
      </section>

      {/* Logos strip */}
      <section aria-labelledby="logos" className="mt-14 sm:mt-20">
        <h2 id="logos" className="sr-only">Fokus auf körperorientierte Verfahren</h2>
        <div className="rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <Image src="/logos/Modalities/NARM.png" alt="NARM" width={120} height={40} loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=" sizes="(max-width: 640px) 33vw, 120px" className="h-20 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Hakomi.png" alt="Hakomi" width={120} height={40} loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=" sizes="(max-width: 640px) 33vw, 120px" className="h-20 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing" width={160} height={40} loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=" sizes="(max-width: 640px) 33vw, 160px" className="h-20 w-auto object-contain opacity-80" />
            <Image src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" width={160} height={40} loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=" sizes="(max-width: 640px) 33vw, 160px" className="h-20 w-auto object-contain opacity-80" />
          </div>
        </div>
      </section>

      {/* Problem (Social Proof) */}
      <section aria-labelledby="problem" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="problem" className="sr-only">Problem</h2>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <blockquote className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <p className="text-base sm:text-lg leading-relaxed text-gray-800 font-medium">&bdquo;Ich habe 175€ für Werbung ausgegeben und keine einzige Anfrage bekommen.&ldquo;</p>
            <footer className="mt-3 text-sm sm:text-base text-gray-600">– Hakomi-Therapeutin aus Berlin</footer>
          </blockquote>
          <blockquote className="relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-cyan-50/30 p-6 sm:p-8 shadow-lg shadow-emerald-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(16,185,129,0.09),transparent_65%)]" />
            <p className="text-base sm:text-lg leading-relaxed text-gray-800 font-medium">&bdquo;Andere Therapeuten-Verzeichnisse verlangen bis zu 150€ pro Monat - ohne dass ich weiß, ob ich dafür wirklich Klient:innen bekomme. Bei Kaufmann Health ist das anders. Hier zahle ich nur, wenn ich wirklich etwas dafür bekomme.&ldquo;</p>
            <footer className="mt-3 text-sm sm:text-base text-gray-600">– NARM-Therapeut aus München</footer>
          </blockquote>
        </div>
      </section>

      {/* Solution */}
      <section aria-labelledby="solution" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="solution" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Unser Empfehlungsservice</h2>
        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Spezialisiertes Netzwerk</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Fokus auf körperorientierte Verfahren</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm w-fit">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Erfolgsbasiert</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Details nach Aufnahme</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3 text-sky-600 shadow-sm w-fit">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Faire Konditionen</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Transparente Konditionen – keine Überraschungen</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 p-3 text-slate-700 shadow-sm w-fit">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Flexibel</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Jederzeit kündbar</p>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="how" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">So funktioniert die Aufnahme</h2>
        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 md:grid-cols-2">
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 pt-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-t-xl" />
            <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">1</div>
            <h3 className="text-lg font-semibold text-gray-900">Bewerbung & Prüfung</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">Wir prüfen deine Qualifikationen und Spezialisierung sorgfältig</p>
          </div>
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 pt-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-t-xl" />
            <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">2</div>
            <h3 className="text-lg font-semibold text-gray-900">Sichtbarkeit für Interessent:innen</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">Klient:innen finden dich über unser Netzwerk und unsere Orientierungshilfe</p>
          </div>
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 pt-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-t-xl" />
            <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">3</div>
            <h3 className="text-lg font-semibold text-gray-900">Direkter Kontakt</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">Interessent:innen kontaktieren dich direkt und vereinbaren Termine</p>
          </div>
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-5 sm:p-6 pt-8">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-t-xl" />
            <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg">4</div>
            <h3 className="text-lg font-semibold text-gray-900">Erfolgsbasierte Vergütung</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">Du zahlst nur für tatsächlich vermittelte Klient:innen – faire, transparente Konditionen</p>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section aria-labelledby="requirements" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="requirements" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Voraussetzungen für die Aufnahme ins Netzwerk</h2>
        <ul className="mt-8 sm:mt-10 grid gap-3 sm:gap-4 sm:grid-cols-2">
          <li className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-700 font-medium">Heilpraktiker:in für Psychotherapie oder approbierte:r Psychotherapeut:in</span>
          </li>
          <li className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-700 font-medium">Spezialisierung auf körperorientierte Verfahren (NARM, Hakomi, Somatic Experiencing, Core Energetics)</span>
          </li>
          <li className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-700 font-medium">Mindestens 2 Jahre Praxiserfahrung</span>
          </li>
          <li className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-700 font-medium">Bereitschaft für Selbstzahler-Klient:innen</span>
          </li>
          <li className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow sm:col-span-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-gray-700 font-medium">Verfügbarkeit für neue Klient:innen</span>
          </li>
        </ul>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="benefits" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Deine Vorteile</h2>
        <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm w-fit">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Keine Vorabkosten</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Du zahlst nur bei Erfolg</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
              <Target className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Zielgerichtete Sichtbarkeit</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Alle Anfragen kommen von vorinteressierten Selbstzahlern</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3 text-sky-600 shadow-sm w-fit">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Zeitersparnis</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Kein Marketing, keine Kaltakquise notwendig</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 p-3 text-slate-700 shadow-sm w-fit">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Flexible Teilnahme</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Keine Mindestlaufzeit, transparente Bedingungen</p>
          </Card>
          <Card className="relative bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-5 sm:px-6">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm w-fit">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Jederzeit kündbar</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">Jederzeit kündbar, keine Mindestlaufzeit</p>
          </Card>
        </div>
      </section>

      {/* Qualitätsversprechen */}
      <section aria-labelledby="quality-promise" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
          <h2 id="quality-promise" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Qualitätsversprechen</h2>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white p-4 shadow-sm">
              <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Geprüfte Klient:innen</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">Anfragen werden vorqualifiziert und zielgerichtet weitergeleitet.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50/40 to-white p-4 shadow-sm">
              <Lock className="mt-0.5 h-6 w-6 text-slate-700 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Cookies'}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. DSGVO‑konforme Prozesse.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-indigo-200/60 bg-gradient-to-br from-indigo-50/40 to-white p-4 shadow-sm">
              <UserCheck className="mt-0.5 h-6 w-6 text-indigo-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Transparente Datenverarbeitung</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">Deine Daten werden ausschließlich zur Vermittlung verwendet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service description (legal wording) */}
      <section aria-labelledby="service" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="service" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Unser Service im Detail</h2>
        <div className="mt-6 sm:mt-8 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6 shadow-sm">
          <p className="max-w-prose text-sm sm:text-base leading-relaxed text-gray-700">
            Kaufmann Health ist eine Vermittlungsplattform für Heilpraktiker:innen für Psychotherapie.
            Wir vermitteln qualifizierte Therapeut:innen an passende Klient:innen.
            Wir geben keine medizinischen oder therapeutischen Empfehlungen und garantieren keine Behandlungserfolge.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq" className="mt-14 sm:mt-20 lg:mt-24">
        <h2 id="faq" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
        <div className="mt-6 sm:mt-8">
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* Application CTA + Form */}
      <section aria-labelledby="apply" className="mt-14 sm:mt-20 lg:mt-24" id="apply-form">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60 p-8 sm:p-12 lg:p-16">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-200/20 to-transparent blur-3xl" />
          <h2 id="apply" className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
            Bereit, dich zu bewerben?
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
            Bewirb dich jetzt für unser kuratiertes Netzwerk körperorientierter Therapeut:innen. Wir prüfen jede Bewerbung sorgfältig.
          </p>
          <div className="mt-8 sm:mt-10">
            <TherapistApplicationForm />
          </div>
        </div>
      </section>
    </main>
  );
}
