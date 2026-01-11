"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type Screen4Values = {
  gender?: 'Frau' | 'Mann' | 'Keine Präferenz' | 'Divers/non-binär';
  methods?: string[]; // Still here for compatibility, but modality is handled in NewScreen5
};

const GENDER: NonNullable<Screen4Values['gender']>[] = ['Frau', 'Mann', 'Keine Präferenz'];

export default function Screen4({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
}: {
  values: Screen4Values;
  onChange: (patch: Partial<Screen4Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Letzte Details für deine perfekte Vermittlung</Label>
        <div className="space-y-2">
          <p className="font-medium">Bevorzugtes Geschlecht der Therapeut:in (optional)</p>
          <div className="grid gap-2">
            {GENDER.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${values.gender === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                disabled={!!disabled}
                aria-disabled={disabled}
                onClick={() => onChange({ gender: opt })}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={onNext} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
