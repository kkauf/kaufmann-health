import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import PageAnalytics from "@/components/PageAnalytics";
import FaqAccordion from "@/components/FaqAccordion";
import { CheckCircle2, TrendingUp, ChevronRight, LogIn, ArrowRight, Users, Heart } from "lucide-react";
import FairPricingModal from "@/components/FairPricingModal";
import Link from "next/link";
import CtaLink from "@/components/CtaLink";
import { COOKIES_ENABLED } from "@/lib/config";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Neue Klient:innen für deine Praxis | Für Therapeut:innen | Kaufmann Health",
  description:
    "Klient:innen, die gezielt körperorientierte Therapie suchen. Erfolgsbasierte Vermittlung: 25% auf die ersten 10 Sitzungen, dann 0% – für immer.",
  alternates: { canonical: "/fuer-therapeuten" },
  openGraph: {
    title: "Neue Klient:innen für deine Praxis | Für Therapeut:innen",
    description:
      "Klient:innen, die gezielt körperorientierte Therapie suchen. Erfolgsbasiert, ohne Vorabkosten.",
  },
};

const faqItems = [
  {
    id: "fuer-therapeuten-faq-fee",
    question: "Wie funktioniert die Vergütung genau?",
    answer:
      "25% Provision auf die ersten 10 Sitzungen pro vermittelter:m Klient:in. Ab Sitzung 11: 0% – für immer. Keine monatlichen Gebühren, keine Mindestlaufzeit. Deine bestehenden Klient:innen kosten nichts.",
  },
  {
    id: "fuer-therapeuten-faq-who",
    question: "Welche Therapeut:innen nehmt ihr auf?",
    answer:
      "Heilpraktiker:innen für Psychotherapie oder approbierte Psychotherapeut:innen mit Spezialisierung auf körperorientierte Verfahren – NARM, Somatic Experiencing, Hakomi oder Core Energetics.",
  },
  {
    id: "fuer-therapeuten-faq-volume",
    question: "Wie viele Anfragen erhalte ich?",
    answer:
      "Das hängt von deiner Methode, Region und Verfügbarkeit ab. Aktuell haben wir besonders hohe Nachfrage nach NARM – mehr Anfragen als verfügbare Therapeut:innen.",
  },
  {
    id: "fuer-therapeuten-faq-reject",
    question: "Muss ich jede Anfrage annehmen?",
    answer:
      "Nein. Du entscheidest selbst, welche Klient:innen du übernehmen möchtest. Es besteht keine Verpflichtung.",
  },
  {
    id: "fuer-therapeuten-faq-diff",
    question: "Wie unterscheidet ihr euch von anderen Plattformen?",
    answer:
      "Andere Plattformen nehmen dauerhafte Provision oder monatliche Gebühren. Bei uns: Nach 10 Sitzungen ist Schluss. Wir fokussieren uns ausschließlich auf körperorientierte Verfahren.",
  },
  {
    id: "datenschutz-therapeuten",
    question: "Wie geht ihr mit meinen Daten um?",
    answer: COOKIES_ENABLED
      ? "Deine Angaben werden ausschließlich zur Vermittlung verwendet. Keine Analytics-Cookies. Lediglich ein minimales Conversion-Signal an Google Ads."
      : "Deine Angaben werden ausschließlich zur Vermittlung verwendet. Keine Cookies, kein Tracking.",
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
              "Klient:innen, die gezielt körperorientierte Therapie suchen. Erfolgsbasierte Vermittlung.",
          }),
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO – Strong value proposition
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        aria-labelledby="hero"
        className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />

        <h1 id="hero" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-gray-900">
          Klient:innen, die gezielt deine Methode suchen
        </h1>

        <p className="mt-4 sm:mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-700">
          Wir vermitteln Selbstzahler:innen an körperorientierte Therapeut:innen – NARM, Somatic Experiencing, Hakomi, Core Energetics.{" "}
          <span className="font-medium text-gray-900">Erfolgsbasiert, ohne Vorabkosten.</span>
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            asChild
            data-cta="therapists-hero-apply"
            className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <CtaLink href="/therapists/register" eventType="cta_click" eventId="fuer-therapeuten-hero-apply">
              Jetzt registrieren
              <ArrowRight className="ml-2 h-5 w-5" />
            </CtaLink>
          </Button>
          <Link
            href="/portal/login"
            className="inline-flex items-center gap-2 h-12 sm:h-14 px-5 sm:px-6 text-sm sm:text-base font-medium text-gray-700 hover:text-gray-900 bg-white/80 hover:bg-white border border-gray-200 rounded-lg shadow-sm transition-all duration-200"
          >
            <LogIn className="h-4 w-4" />
            Mitglieder-Login
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SOCIAL PROOF – Quotes from therapists
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="social-proof" className="mt-14 sm:mt-20">
        <h2 id="social-proof" className="sr-only">Stimmen von Therapeut:innen</h2>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <figure className="relative rounded-2xl border border-gray-200/60 bg-white p-6 sm:p-8 shadow-md">
            <svg className="absolute top-4 left-4 h-8 w-8 text-indigo-200" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
            </svg>
            <blockquote className="relative pt-6">
              <p className="text-base sm:text-lg leading-relaxed text-gray-800">
                Andere Therapeuten-Verzeichnisse verlangen bis zu 150€ pro Monat – ohne dass ich weiß, ob ich dafür wirklich Klient:innen bekomme.{" "}
                <span className="font-medium">Hier zahle ich nur, wenn ich wirklich etwas dafür bekomme.</span>
              </p>
              <figcaption className="mt-4 text-sm text-gray-600">
                – NARM-Therapeut aus München
              </figcaption>
            </blockquote>
          </figure>

          <figure className="relative rounded-2xl border border-gray-200/60 bg-white p-6 sm:p-8 shadow-md">
            <svg className="absolute top-4 left-4 h-8 w-8 text-indigo-200" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
            </svg>
            <blockquote className="relative pt-6">
              <p className="text-base sm:text-lg leading-relaxed text-gray-800">
                Ich habe 175€ für Google-Werbung ausgegeben und keine einzige Anfrage bekommen.{" "}
                <span className="font-medium">Das Risiko liegt jetzt bei Kaufmann Health, nicht bei mir.</span>
              </p>
              <figcaption className="mt-4 text-sm text-gray-600">
                – Hakomi-Therapeutin aus Berlin
              </figcaption>
            </blockquote>
          </figure>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          WHY US – Core differentiators (consolidated)
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="why-us" className="mt-14 sm:mt-20">
        <h2 id="why-us" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center">
          Warum Kaufmann Health?
        </h2>
        <div className="mt-8 sm:mt-10 grid gap-6 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center shadow-sm">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Gezielte Anfragen</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Menschen, die aktiv nach NARM, SE oder Hakomi suchen – keine Zufallsklicks.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Kein Risiko</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Keine Vorabkosten. Du zahlst nur bei erfolgreicher Vermittlung.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center shadow-sm">
              <Heart className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Langzeit = Dein Gewinn</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Nach 10 Sitzungen gehört die Klient:innen-Beziehung dir zu 100%.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS – Simplified steps
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="how-it-works" className="mt-14 sm:mt-20">
        <h2 id="how-it-works" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          So funktioniert&apos;s
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: 1, title: "Bewerbung", desc: "Kurzes Formular ausfüllen" },
            { step: 2, title: "Prüfung", desc: "Wir prüfen Qualifikation & Dokumente" },
            { step: 3, title: "Profil live", desc: "Du wirst für passende Anfragen sichtbar" },
            { step: 4, title: "Klient:innen", desc: "Direkter Kontakt, du entscheidest" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="relative rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm">
              <div className="absolute -top-3 -left-3 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow">
                {step}
              </div>
              <h3 className="mt-2 text-base font-semibold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          REQUIREMENTS – Compact checklist
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="requirements" className="mt-14 sm:mt-20">
        <h2 id="requirements" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Voraussetzungen
        </h2>
        <div className="mt-6 rounded-xl border border-gray-200/60 bg-slate-50/60 p-5 sm:p-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Heilpraktiker:in für Psychotherapie oder approbiert",
              "NARM, Somatic Experiencing, Hakomi oder Core Energetics",
              "Mindestens 2 Jahre Praxiserfahrung",
              "Verfügbarkeit für neue Klient:innen",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRICING – Understated, accessible via modal
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="pricing" className="mt-14 sm:mt-20">
        <h2 id="pricing" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Konditionen
        </h2>
        <div className="mt-6 rounded-xl border border-gray-200/60 bg-white p-5 sm:p-6 shadow-sm">
          <p className="text-base text-gray-700">
            25% Provision auf die ersten 10 Sitzungen pro Klient:in. Danach 0% – für immer.
            Keine monatlichen Gebühren, keine Mindestlaufzeit.
          </p>
          <FairPricingModal
            trigger={
              <button className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                Rechenbeispiel ansehen
                <ChevronRight className="h-4 w-4" />
              </button>
            }
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CONSULTING SECTION – Keep intact per user request
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="consulting" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-8 sm:p-10 shadow-lg shadow-indigo-100/30 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="consulting" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Individuelle digitale Lösungen für deine Praxis
            </h2>
            <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
              Du möchtest neben Klient:innen-Anfragen auch deine digitale Infrastruktur professionalisieren – z. B.
              mit Buchungssystem, Online-Kursen oder automatisierten E-Mail-Strecken? Über Kaufmann Health hinaus
              begleite ich ausgewählte Therapeut:innen und Praxen bei der Umsetzung maßgeschneiderter Lösungen.
            </p>
            <div className="mt-6">
              <Button
                asChild
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
              >
                <CtaLink href="/beratung" eventType="cta_click" eventId="fuer-therapeuten-consulting-cta">
                  Mehr zu Beratung & digitalen Lösungen
                </CtaLink>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ – Keep intact
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="faq" className="mt-14 sm:mt-20">
        <h2 id="faq" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Häufige Fragen</h2>
        <div className="mt-6 sm:mt-8">
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA – Clear conversion
      ═══════════════════════════════════════════════════════════════════ */}
      <section aria-labelledby="cta-final" className="mt-14 sm:mt-20">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60 p-8 sm:p-12 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />

          <h2 id="cta-final" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Bereit für passende Klient:innen?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-gray-700 max-w-xl mx-auto">
            Kurzes Formular ausfüllen – wir prüfen deine Qualifikationen und melden uns innerhalb von 48 Stunden.
          </p>

          <div className="mt-8">
            <Button
              size="lg"
              asChild
              data-cta="therapists-final-apply"
              className="h-12 sm:h-14 px-8 sm:px-10 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <CtaLink href="/therapists/register" eventType="cta_click" eventId="fuer-therapeuten-final-apply">
                Jetzt registrieren
                <ArrowRight className="ml-2 h-5 w-5" />
              </CtaLink>
            </Button>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Bereits registriert?{" "}
            <Link href="/portal/login" className="font-medium text-emerald-700 hover:text-emerald-800 transition-colors">
              Zum Mitglieder-Login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
