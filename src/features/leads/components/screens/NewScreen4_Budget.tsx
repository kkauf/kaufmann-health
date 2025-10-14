"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type NewScreen4Values = {
  budget?: '80-100€ pro Sitzung' | '100-120€ pro Sitzung' | 'Flexibel, Qualität ist wichtiger';
};

const BUDGET_OPTS: NonNullable<NewScreen4Values['budget']>[] = [
  '80-100€ pro Sitzung',
  '100-120€ pro Sitzung',
  'Flexibel, Qualität ist wichtiger',
];

export default function NewScreen4_Budget({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
  suppressAutoAdvance,
}: {
  values: NewScreen4Values;
  onChange: (patch: Partial<NewScreen4Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
  suppressAutoAdvance?: boolean;
}) {
  const [flashKey, setFlashKey] = React.useState<string | null>(null);
  const [userInteracted, setUserInteracted] = React.useState(false);

  // Auto-advance after selection
  React.useEffect(() => {
    if (disabled || !values.budget) return;
    if (suppressAutoAdvance && !userInteracted) return;
    const timer = setTimeout(() => {
      onNext();
    }, 800);
    return () => clearTimeout(timer);
  }, [values.budget, disabled, onNext, suppressAutoAdvance, userInteracted]);
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Was ist dein Budget pro Sitzung?</Label>
        <div className="grid gap-2">
          {BUDGET_OPTS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left transition-all ${
                values.budget === opt
                  ? 'border-emerald-600 bg-emerald-50' + (flashKey === opt ? ' scale-[1.02] shadow-md' : '')
                  : 'border-gray-300'
              }`}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => {
                setFlashKey(opt);
                setUserInteracted(true);
                onChange({ budget: opt });
              }}
            >
              {opt}
            </button>
          ))}
        </div>
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
          onClick={onNext}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Weiter →
        </Button>
      </div>
    </div>
  );
}
