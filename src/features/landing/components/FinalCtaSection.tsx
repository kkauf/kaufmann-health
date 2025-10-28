import React from "react";
import VariantGate from "@/components/VariantGate";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";
import { Shield, Lock, FileCheck, Clock, MessageCircle } from "lucide-react";

export function FinalCtaSection({
  heading = "Bereit für den ersten Schritt?",
  subtitle,
  quote,
  buttonLabel = "Passende Therapeut:innen finden",
  targetId = "#top-form",
  footnoteText = "Kostenlos & unverbindlich. Antwort innerhalb von 24 Stunden.",
  variant = 'default',
  align = 'left',
  showAvailabilityNote = true,
  className,
  withEntryOptions = false,
  targetBasePath = '/fragebogen',
}: {
  heading?: string;
  subtitle?: string;
  quote?: string;
  buttonLabel?: string;
  targetId?: string;
  footnoteText?: string;
  variant?: 'default' | 'tinted';
  align?: 'left' | 'center';
  showAvailabilityNote?: boolean;
  className?: string;
  withEntryOptions?: boolean;
  /** Base path for entry options. '/therapeuten' shows format options; otherwise experience options. */
  targetBasePath?: string;
}) {
  const bgClass = variant === 'tinted'
    ? 'bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60'
    : 'bg-gradient-to-b from-slate-50 to-white';
  const alignClass = align === 'center' ? 'text-center items-center' : '';
  const sectionClass = (className ? className + ' ' : '') +
    `mt-12 sm:mt-16 relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 ${bgClass} p-8 sm:p-12 lg:p-16 ${alignClass}`;

  const EXPERIENCE_OPTIONS = [
    { value: 'yes', label: 'Ja, bereits Erfahrung', query: 'experience=yes' },
    { value: 'no', label: 'Nein, erste Therapie', query: 'experience=no' },
    { value: 'unsure', label: 'Bin mir unsicher', query: 'experience=unsure' },
  ] as const;

  const FORMAT_OPTIONS = [
    { value: 'online', label: 'Online', query: 'format=online' },
    { value: 'inperson', label: 'Vor Ort', query: 'format=inperson' },
    { value: 'unsure', label: 'Bin mir unsicher', query: 'format=unsure' },
  ] as const;
  return (
    <section
      aria-labelledby="final-cta-heading"
      className={sectionClass}
    >
      {/* Enhanced gradient overlays */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />

      {/* Decorative elements */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-gradient-to-tr from-teal-200/30 to-transparent blur-3xl" />

      <div className={`relative z-10 ${align === 'center' ? 'mx-auto max-w-3xl' : 'max-w-3xl'} flex flex-col ${alignClass}`}>
        <h2 id="final-cta-heading" className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
          {heading}
        </h2>

        {subtitle ? (
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-gray-700 max-w-2xl">
            {subtitle}
          </p>
        ) : null}

        {quote ? (
          <div className="mt-5 rounded-xl border border-emerald-200/60 bg-white/80 backdrop-blur-sm p-5 text-sm sm:text-base text-slate-700 shadow-sm">
            {quote}
          </div>
        ) : null}

        {!withEntryOptions ? (
          <div className={`mt-8 flex flex-col gap-4 ${align === 'center' ? 'items-center' : 'items-start'}`}>
            <Button
              asChild
              size="lg"
              data-cta="final-primary"
              className="h-14 px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <CtaLink href={targetId} eventType="cta_click" aria-label={buttonLabel} data-cta="final-primary">
                {buttonLabel}
              </CtaLink>
            </Button>

            {showAvailabilityNote ? (
              <VariantGate show="B">
                <p className="text-sm sm:text-base text-emerald-800 font-medium bg-emerald-100/50 px-4 py-2 rounded-lg">
                  Noch 3 Therapeut:innen mit freien Terminen diese Woche.
                </p>
              </VariantGate>
            ) : null}
          </div>
        ) : (
          <div className={`mt-6 sm:mt-8 w-full ${align === 'center' ? 'text-center' : ''}`}>
            <p className="text-base sm:text-lg text-gray-700">
              {targetBasePath === '/therapeuten' ? 'Welches Therapieformat passt am besten zu dir?' : 'Hast du bereits Therapie gemacht?'}
            </p>
            <div className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
              {(targetBasePath === '/therapeuten' ? FORMAT_OPTIONS : EXPERIENCE_OPTIONS).map((option) => {
                const isDirectory = targetBasePath === '/therapeuten';
                const href = isDirectory ? `/therapeuten?${option.query}` : `${targetBasePath}?${option.query}`;
                return (
                  <CtaLink
                    key={option.value}
                    href={href}
                    eventType="cta_click"
                    data-cta={`midpage-conversion-${option.value}`}
                    className="group relative flex items-center justify-center min-h-[44px] sm:min-h-[48px] px-6 py-3 rounded-xl border-2 border-teal-600 bg-white text-teal-700 font-semibold text-base sm:text-lg shadow-md hover:bg-teal-600 hover:text-white hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
                  >
                    {option.label}
                  </CtaLink>
                );
              })}
            </div>
            <div className="mt-5 sm:mt-6 flex items-center justify-center gap-2 text-sm sm:text-base text-gray-600">
              {targetBasePath === '/therapeuten' ? (
                <>
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                  <span>Antwort in &lt;24h</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                  <span>5-Minuten Fragebogen</span>
                </>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-sm sm:text-base text-gray-600 leading-relaxed flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <span className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span>DSGVO-konform</span>
          </span>
          <span className="text-gray-400">•</span>
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            <span>SSL-verschlüsselt</span>
          </span>
          <span className="text-gray-400">•</span>
          <span className="inline-flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-600" />
            <span>Therapie ohne Krankenkassen-Eintrag</span>
          </span>
        </p>
      </div>
    </section>
  );
}

export default FinalCtaSection;
