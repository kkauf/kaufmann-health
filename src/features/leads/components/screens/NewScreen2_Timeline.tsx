"use client";

import React from 'react';
import { Clock, Users, ShieldCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';

export type NewScreen2Values = {
  start_timing?: 'Innerhalb der nächsten Woche' | 'Innerhalb des nächsten Monats' | 'Flexibel, der richtige Match ist wichtiger';
};

const START_OPTS: NonNullable<NewScreen2Values['start_timing']>[] = [
  'Innerhalb der nächsten Woche',
  'Innerhalb des nächsten Monats',
  'Flexibel, der richtige Match ist wichtiger',
];

export default function NewScreen2_Timeline({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
  suppressAutoAdvance,
  therapistCount,
}: {
  values: NewScreen2Values;
  onChange: (patch: Partial<NewScreen2Values>) => void;
  onNext: () => void;
  onBack?: () => void; // Optional - this can be the first step
  disabled?: boolean;
  suppressAutoAdvance?: boolean;
  therapistCount?: number | null;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [flashKey, setFlashKey] = React.useState<string | null>(null);
  const [userInteracted, setUserInteracted] = React.useState(false);

  // Auto-advance after selection
  React.useEffect(() => {
    if (disabled || !values.start_timing) return;
    if (suppressAutoAdvance && !userInteracted) return;
    const timer = setTimeout(() => {
      onNext();
    }, 800);
    return () => clearTimeout(timer);
  }, [values.start_timing, disabled, onNext, suppressAutoAdvance, userInteracted]);

  function validate() {
    if (!values.start_timing) {
      setError('Bitte wähle, wann du starten möchtest.');
      return false;
    }
    setError(null);
    return true;
  }

  // Format therapist count for display
  const countDisplay = therapistCount 
    ? (therapistCount >= 50 ? '50+' : String(therapistCount))
    : null;

  return (
    <div className="space-y-6">
      {/* Trust signals header */}
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-700">
          {countDisplay && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Users className="h-4 w-4 text-emerald-600" />
              <span>{countDisplay} geprüfte Therapeut:innen</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-emerald-600" />
            <span>3 Min. zum Match</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Kostenlos & unverbindlich</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base">Wann möchtest du idealerweise beginnen?*</Label>
        <div className="grid gap-2">
          {START_OPTS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left transition-all ${
                values.start_timing === opt
                  ? 'border-emerald-600 bg-emerald-50' + (flashKey === opt ? ' scale-[1.02] shadow-md' : '')
                  : 'border-gray-300'
              }`}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => {
                setFlashKey(opt);
                setUserInteracted(true);
                onChange({ start_timing: opt });
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <Button
            variant="secondary"
            className="h-11"
            onClick={onBack}
            disabled={disabled}
            aria-disabled={disabled}
          >
            Zurück
          </Button>
        ) : <div />}
        <Button
          className="h-11"
          onClick={() => validate() && onNext()}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Weiter →
        </Button>
      </div>

      {/* Escape hatch - browse all therapists */}
      <div className="pt-2 text-center">
        <CtaLink
          href="/therapeuten"
          eventType="cta_click"
          eventId="wizard-browse-all-escape"
          className="text-sm text-gray-500 hover:text-emerald-700 underline underline-offset-2 transition-colors"
        >
          Keine Zeit? Alle Therapeut:innen ansehen →
        </CtaLink>
      </div>
    </div>
  );
}
