"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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
}: {
  values: NewScreen2Values;
  onChange: (patch: Partial<NewScreen2Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
  suppressAutoAdvance?: boolean;
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

  return (
    <div className="space-y-8">
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
        <Button
          variant="secondary"
          className="h-11"
          onClick={onBack}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Zurück
        </Button>
        <Button
          className="h-11"
          onClick={() => validate() && onNext()}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Weiter →
        </Button>
      </div>
    </div>
  );
}
