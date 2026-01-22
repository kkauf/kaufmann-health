import { notFound } from "next/navigation";
import { Clock, Users, ShieldCheck, TrendingUp, Euro, Brain, Activity, Heart, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import CtaLink from "@/components/CtaLink";
import PageAnalytics from "@/components/PageAnalytics";
import FaqAccordion from "@/components/FaqAccordion";
import { HeroNoForm } from "@/features/landing/components/HeroNoForm";
import { TherapistTeaserSection } from "@/features/landing/components/TherapistTeaserSection";
import { FinalCtaSection } from "@/features/landing/components/FinalCtaSection";
import { MODALITIES, type ModalityId } from "@/features/therapies/modalityConfig";
import { parseKeyword } from "@/lib/ads-landing";
import { buildFaqJsonLd } from "@/lib/seo";

// Campaign landing page - conversion-focused
// URL: /lp/narm, /lp/somatic-experiencing, etc.
// Use: Google Ads campaigns targeting specific modalities
// Supports: ?mode=online for online-only campaigns

// Modality-specific copy for campaigns
const MODALITY_COPY: Record<ModalityId, {
  heroTitle: string;
  heroSubtitle: string;
  heroValueProps: string[];
  onlineHeroTitle: string;
  onlineHeroSubtitle: string;
  onlineValueProps: string[];
  recognitionHeadline: string;
  recognitionBody: string[];
  whatItDoes: {
    icon: "brain" | "activity" | "heart" | "sparkles";
    title: string;
    desc: string;
  }[];
}> = {
  'narm': {
    heroTitle: "NARM Therapeut:in finden",
    heroSubtitle: "Körperpsychotherapie für Entwicklungstrauma — ohne Retraumatisierung",
    heroValueProps: [
      '✓ Zertifizierte NARM-Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Berlin & Online · 80€–120€',
    ],
    onlineHeroTitle: "Online NARM Therapeut:in finden",
    onlineHeroSubtitle: "Körperpsychotherapie für Entwicklungstrauma — von zuhause",
    onlineValueProps: [
      '✓ Zertifizierte NARM-Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Online-Therapie deutschlandweit · 80€–120€',
    ],
    recognitionHeadline: "Du funktionierst — aber lebst du wirklich?",
    recognitionBody: [
      "Hast du das Gefühl, nach außen erfolgreich zu sein, aber innerlich leer? Beziehungen sind entweder zu nah oder zu distanziert? Du verstehst deine Muster, aber sie ändern sich trotzdem nicht?",
      "NARM arbeitet nicht mit deiner Geschichte, sondern mit dem, was jetzt ist. Es geht nicht darum, die Vergangenheit zu verändern — sondern wie sie deine Gegenwart formt.",
    ],
    whatItDoes: [
      { icon: "brain", title: "Identitätsmuster erkennen", desc: "Verstehe, wie frühe Erfahrungen dein Selbstbild und deine Beziehungen prägen — ohne in der Geschichte zu graben." },
      { icon: "activity", title: "Selbstregulation stärken", desc: "Lerne, dein Nervensystem zu beruhigen und emotionale Stabilität aufzubauen." },
      { icon: "heart", title: "Authentisch verbinden", desc: "Entwickle echte Nähe und Autonomie in Beziehungen — ohne dich zu verlieren." },
      { icon: "sparkles", title: "Lebendiger werden", desc: "Von Überleben zu Leben. Spüre wieder Freude, Energie und echte Präsenz." },
    ],
  },
  'somatic-experiencing': {
    heroTitle: "Somatic Experiencing Therapeut:in finden",
    heroSubtitle: "Traumatherapie nach Dr. Peter Levine — sanft und körperbasiert",
    heroValueProps: [
      '✓ Zertifizierte SE-Praktiker:innen (SEP)',
      '✓ Ohne Warteliste',
      '✓ Berlin & Online · 80€–120€',
    ],
    onlineHeroTitle: "Online SE Therapeut:in finden",
    onlineHeroSubtitle: "Traumatherapie nach Dr. Peter Levine — von zuhause",
    onlineValueProps: [
      '✓ Zertifizierte SE-Praktiker:innen (SEP)',
      '✓ Ohne Warteliste',
      '✓ Online-Therapie deutschlandweit · 80€–120€',
    ],
    recognitionHeadline: "Dein Körper erinnert sich — auch wenn du vergessen willst.",
    recognitionBody: [
      "Fühlst du dich oft überwältigt, als ob dein Nervensystem ständig in Alarmbereitschaft ist? Schreckhaftigkeit, Anspannung oder das Gefühl, nicht richtig im Körper zu sein?",
      "Somatic Experiencing arbeitet mit deinem Nervensystem, nicht gegen es. Festgehaltene Überlebensenergie kann sich sanft entladen — ohne dass du das Trauma erneut durchleben musst.",
    ],
    whatItDoes: [
      { icon: "brain", title: "Nervensystem regulieren", desc: "Lerne, dein autonomes Nervensystem direkt zu beeinflussen — nicht durch Analyse, sondern durch körperliche Erfahrung." },
      { icon: "activity", title: "Trauma im Körper lösen", desc: "Festgehaltene Energie kann sich entladen. Chronische Anspannung und Taubheit beginnen sich zu lösen." },
      { icon: "heart", title: "Sicherheit im Körper finden", desc: "Entwickle ein Gefühl von Sicherheit und Präsenz — auch in stressigen Situationen." },
      { icon: "sparkles", title: "Resilienz aufbauen", desc: "Stärke deine natürliche Fähigkeit, mit Stress umzugehen und dich zu erholen." },
    ],
  },
  'hakomi': {
    heroTitle: "Hakomi Therapeut:in finden",
    heroSubtitle: "Achtsamkeitsbasierte Körperpsychotherapie — sanft und transformativ",
    heroValueProps: [
      '✓ Zertifizierte Hakomi-Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Berlin & Online · 80€–120€',
    ],
    onlineHeroTitle: "Online Hakomi Therapeut:in finden",
    onlineHeroSubtitle: "Achtsamkeitsbasierte Körperpsychotherapie — von zuhause",
    onlineValueProps: [
      '✓ Zertifizierte Hakomi-Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Online-Therapie deutschlandweit · 80€–120€',
    ],
    recognitionHeadline: "Veränderung beginnt mit Achtsamkeit.",
    recognitionBody: [
      "Spürst du, dass da mehr ist, aber du kommst nicht ran? Alte Muster wiederholen sich, obwohl du sie erkannt hast?",
      "Hakomi nutzt Achtsamkeit als Tor zum Unbewussten. In einem Zustand von Präsenz und Neugier zeigen sich die Überzeugungen, die dein Leben formen — und können sich transformieren.",
    ],
    whatItDoes: [
      { icon: "brain", title: "Unbewusstes erkunden", desc: "Entdecke die tiefen Überzeugungen, die dein Erleben und Verhalten steuern." },
      { icon: "activity", title: "Körperweisheit nutzen", desc: "Dein Körper weiß mehr als dein Verstand. Lerne, diese Weisheit zu nutzen." },
      { icon: "heart", title: "Sanft transformieren", desc: "Veränderung geschieht nicht durch Zwang, sondern durch liebevolle Präsenz." },
      { icon: "sparkles", title: "Authentisch werden", desc: "Lebe aus deinem wahren Selbst heraus, nicht aus alten Anpassungen." },
    ],
  },
  'core-energetics': {
    heroTitle: "Core Energetics Therapeut:in finden",
    heroSubtitle: "Körperorientierte Charakterarbeit — tiefgreifend und befreiend",
    heroValueProps: [
      '✓ Zertifizierte Core Energetics Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Berlin & Online · 80€–120€',
    ],
    onlineHeroTitle: "Online Core Energetics Therapeut:in finden",
    onlineHeroSubtitle: "Körperorientierte Charakterarbeit — von zuhause",
    onlineValueProps: [
      '✓ Zertifizierte Core Energetics Therapeut:innen',
      '✓ Ohne Warteliste',
      '✓ Online-Therapie deutschlandweit · 80€–120€',
    ],
    recognitionHeadline: "Die Energie, die du zurückhältst, fehlt dir im Leben.",
    recognitionBody: [
      "Fühlst du dich blockiert, als ob ein Teil deiner Lebensenergie eingesperrt ist? Emotionen, die du nicht ausdrücken kannst, Impulse, die du unterdrückst?",
      "Core Energetics arbeitet mit der Energie, die in deinem Körper festgehalten ist. Durch Bewegung, Ausdruck und Körperarbeit wird diese Energie befreit — für mehr Lebendigkeit und Authentizität.",
    ],
    whatItDoes: [
      { icon: "brain", title: "Charaktermuster verstehen", desc: "Erkenne, wie dein Körper deine Lebensgeschichte speichert und dein Verhalten formt." },
      { icon: "activity", title: "Blockaden lösen", desc: "Durch Bewegung und Ausdruck wird festgehaltene Energie befreit." },
      { icon: "heart", title: "Emotionen integrieren", desc: "Alle Gefühle haben ihren Platz. Lerne, sie zu fühlen und auszudrücken." },
      { icon: "sparkles", title: "Kern-Selbst erreichen", desc: "Unter den Abwehrmechanismen liegt dein wahres Selbst — lebendig und liebesfähig." },
    ],
  },
};

const ICON_MAP = {
  brain: Brain,
  activity: Activity,
  heart: Heart,
  sparkles: Sparkles,
};

// Combined FAQs from therapie-finden and start pages
const FAQS = [
  { id: 'prices', question: 'Was kosten die Sitzungen?', answer: 'In der Regel 80–120€ pro 60 Minuten. Den genauen Satz sprichst du direkt mit deiner Therapeut:in ab.' },
  { id: 'speed', question: 'Wie schnell bekomme ich Termine?', answer: 'Du erhältst sofort passende Therapeut:innen-Vorschläge basierend auf deinen Angaben. Termine sind in der Regel noch diese Woche möglich.' },
  { id: 'privacy', question: 'Wird die Psychotherapie bei meiner Krankenkasse dokumentiert?', answer: 'Nein. Es erfolgt keine Kassenabrechnung, kein Eintrag in deiner Krankenakte und keine ICD-10-Diagnose bei der Kasse.' },
  { id: 'why-body', question: 'Warum Körperpsychotherapie?', answer: 'Viele Menschen verstehen ihre Probleme bereits – sie wissen, woher ihre Ängste kommen, welche Muster sie haben. Aber Verstehen allein führt nicht zu Veränderung. Trauma und festgefahrene Reaktionen leben im Nervensystem. Körperpsychotherapie arbeitet direkt mit dem Körper, um diese Muster zu lösen.' },
];

export default async function CampaignLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ modality: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { modality: modalitySlug } = await params;
  const queryParams = await searchParams;

  // Validate modality
  const modalityConfig = Object.values(MODALITIES).find(m => m.slug === modalitySlug);
  if (!modalityConfig) {
    notFound();
  }

  const copy = MODALITY_COPY[modalityConfig.id];

  // Online mode support
  const isOnlineMode = queryParams?.mode === 'online';

  // Keyword tracking for Google Ads (ValueTrack: ?kw={keyword})
  const keyword = parseKeyword(queryParams?.kw);

  // Build fragebogen URL with modality prefill
  const fragebogenHref = isOnlineMode
    ? `/fragebogen?variant=self-service&modality=${modalityConfig.id}&mode=online`
    : `/fragebogen?variant=self-service&modality=${modalityConfig.id}`;

  // Directory escape hatch
  const directoryHref = isOnlineMode
    ? `/therapeuten${modalityConfig.directoryFilterParams}&format=online`
    : `/therapeuten${modalityConfig.directoryFilterParams}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Analytics: page view, scroll depth, CTA clicks */}
      <PageAnalytics qualifier={`lp-${modalityConfig.id}`} keyword={keyword ?? undefined} />

      {/* Hero */}
      <HeroNoForm
        title={isOnlineMode ? copy.onlineHeroTitle : copy.heroTitle}
        subtitle={isOnlineMode ? copy.onlineHeroSubtitle : copy.heroSubtitle}
        ctaLabel="Jetzt Therapeut:in finden"
        ctaHref={fragebogenHref}
        backgroundSrc="/images/hero-calm.jpeg"
        valueProps={isOnlineMode ? copy.onlineValueProps : copy.heroValueProps}
      />

      {/* Trust bar */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4 text-emerald-600" />
          <span>Geprüfte Therapeut:innen</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span>Antwort in &lt;24h</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>100% kostenlos</span>
        </span>
      </div>

      {/* Recognition Hook */}
      <section
        aria-labelledby="recognition-heading"
        className="relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_30%_0%,rgba(99,102,241,0.08),transparent_70%),radial-gradient(30rem_16rem_at_100%_80%,rgba(14,165,233,0.06),transparent_65%)]" />
        <div className="pointer-events-none absolute -top-12 -left-12 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />

        <div>
          <h2
            id="recognition-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 leading-tight"
          >
            {copy.recognitionHeadline}
          </h2>

          {copy.recognitionBody.map((paragraph, i) => (
            <p key={i} className="mt-5 text-base sm:text-lg leading-relaxed text-gray-700">
              {paragraph}
            </p>
          ))}

          {/* CTA */}
          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <CtaLink
              href={fragebogenHref}
              eventType="cta_click"
              eventId={`lp-${modalityConfig.id}-recognition-cta`}
              className="inline-flex items-center gap-2 rounded-lg bg-white border-2 border-indigo-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-indigo-700 shadow-md hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            >
              Unterstützung finden
            </CtaLink>
            <p className="text-sm sm:text-base text-gray-600">
              3 Minuten · Unverbindlich · DSGVO-konform
            </p>
          </div>
        </div>
      </section>

      {/* What this modality achieves - 4 Cards */}
      <section
        aria-labelledby="benefits-heading"
        className="relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(16,185,129,0.06),transparent_70%),radial-gradient(30rem_16rem_at_0%_100%,rgba(99,102,241,0.06),transparent_65%)]" />

        <div className="text-center">
          <h2 id="benefits-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Was {modalityConfig.name} erreicht
          </h2>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {copy.whatItDoes.map((item, i) => {
            const IconComponent = ICON_MAP[item.icon];
            const colorClasses = {
              brain: "from-indigo-50 to-indigo-100/60 text-indigo-600",
              activity: "from-sky-50 to-sky-100/60 text-sky-600",
              heart: "from-rose-50 to-rose-100/60 text-rose-600",
              sparkles: "from-emerald-50 to-emerald-100/60 text-emerald-600",
            };
            return (
              <Card key={i} className="group relative border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-white/80 backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
                <CardHeader>
                  <div className={`rounded-xl bg-gradient-to-br ${colorClasses[item.icon]} p-3 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 w-fit`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <CardTitle className="mt-4 text-lg text-gray-900">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="stats-heading" className="mt-10 sm:mt-14">
        <h2 id="stats-heading" className="sr-only">Fakten auf einen Blick</h2>
        <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30 rounded-2xl" />

          <div className="grid gap-6 sm:grid-cols-3 sm:gap-8">
            {/* Stat 1: Effectiveness */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-2.5 text-indigo-600 shadow-sm">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  80%
                </span>
              </div>
              <p className="text-sm text-gray-600">
                berichten von Verbesserungen nach 5 Sitzungen
              </p>
            </div>

            {/* Dividers */}
            <div className="hidden sm:block absolute left-1/3 top-6 bottom-6 w-px bg-gradient-to-b from-gray-200/50 via-gray-300/50 to-gray-200/50" />
            <div className="hidden sm:block absolute left-2/3 top-6 bottom-6 w-px bg-gradient-to-b from-gray-200/50 via-gray-300/50 to-gray-200/50" />
            <div className="sm:hidden h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

            {/* Stat 2: Pricing */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-2.5 text-sky-600 shadow-sm">
                  <Euro className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  €80–120
                </span>
              </div>
              <p className="text-sm text-gray-600">
                pro Sitzung bei Selbstzahlung
              </p>
            </div>

            <div className="sm:hidden h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

            {/* Stat 3: Speed */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-2.5 text-emerald-600 shadow-sm">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  7 Tage
                </span>
              </div>
              <p className="text-sm text-gray-600">
                durchschnittliche Zeit bis zum Ersttermin
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <div className="mt-10 sm:mt-12 text-center">
        <CtaLink
          href={fragebogenHref}
          eventType="cta_click"
          eventId={`lp-${modalityConfig.id}-stats-cta`}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 sm:px-10 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          Jetzt passende Therapeut:in finden
        </CtaLink>
      </div>

      {/* Therapist Network */}
      <section className="mt-10 sm:mt-14">
        <TherapistTeaserSection
          title={modalityConfig.therapistSectionTitle}
          subtitle={modalityConfig.therapistSectionSubtitle}
          filters={modalityConfig.therapistFilter}
          limit={3}
          randomize={true}
          showViewAllButton={true}
          viewAllButtonText={`Alle ${modalityConfig.name}-Therapeut:innen`}
          viewAllButtonHref={directoryHref}
        />
      </section>

      {/* Final CTA */}
      <FinalCtaSection
        heading="Bereit für den ersten Schritt?"
        subtitle="100% kostenlos & unverbindlich. Wir schlagen dir passende Therapeut:innen vor — du entscheidest, mit wem du Kontakt aufnehmen möchtest."
        buttonLabel="Jetzt Therapeut:in finden"
        targetId={fragebogenHref}
        align="center"
        variant="tinted"
        showAvailabilityNote={false}
      />

      {/* FAQ */}
      <section aria-labelledby="faq-heading" id="faq" className="mt-10 sm:mt-14">
        <h2 id="faq-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      {/* Escape hatch - for high intent users who want to browse */}
      <div className="mt-12 text-center">
        <CtaLink
          href={directoryHref}
          eventType="cta_click"
          eventId={`lp-${modalityConfig.id}-browse-all`}
          className="text-sm text-gray-500 hover:text-emerald-700 underline underline-offset-2 transition-colors"
        >
          Oder: Alle {modalityConfig.name}-Therapeut:innen direkt ansehen →
        </CtaLink>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(FAQS.map(({ question, answer }) => ({ question, answer })))) }} />
    </main>
  );
}
