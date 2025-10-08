"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import TherapyModalityExplanations from '@/components/TherapyModalityExplanations';

export type NewScreen5Values = {
  modality_matters?: boolean;
  methods?: string[];
};

const METHODS = ['NARM (Entwicklungstrauma)', 'Somatic Experiencing', 'Core Energetics', 'Hakomi'];

export default function NewScreen5_Modality({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
}: {
  values: NewScreen5Values;
  onChange: (patch: Partial<NewScreen5Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const toggle = (val: string) => {
    const set = new Set(values.methods || []);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onChange({ methods: Array.from(set) });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium">Ist dir die Therapiemethode deines Therapeuten wichtig?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`h-11 rounded border px-4 text-center font-medium ${
                values.modality_matters === true
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => {
                onChange({ modality_matters: true });
                // Keep existing selections when switching back to Yes
              }}
              disabled={disabled}
              aria-disabled={disabled}
            >
              Ja
            </button>
            <button
              type="button"
              className={`h-11 rounded border px-4 text-center font-medium ${
                values.modality_matters === false
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => {
                onChange({ modality_matters: false, methods: [] });
              }}
              disabled={disabled}
              aria-disabled={disabled}
            >
              Nein
            </button>
          </div>
        </div>

        {values.modality_matters === false && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-900">
              ✓ Perfekt! Wir kümmern uns darum und empfehlen dir Therapeut:innen, die zu deinen Bedürfnissen passen.
            </p>
          </div>
        )}

        {values.modality_matters === true && (
          <>
            <div className="space-y-2">
              <p className="font-medium">Welche Methoden interessieren dich? (Mehrfachauswahl möglich)</p>
              <div className="grid gap-2">
                {METHODS.map((opt) => {
                  const selected = (values.methods || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`h-11 rounded border px-4 text-left ${
                        selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'
                      }`}
                      onClick={() => toggle(opt)}
                      disabled={disabled}
                      aria-disabled={disabled}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <TherapyModalityExplanations />
            </div>
          </>
        )}
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
