"use client";

import React from 'react';
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
  suppressAutoAdvance,
}: {
  values: NewScreen5Values;
  onChange: (patch: Partial<NewScreen5Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
  suppressAutoAdvance?: boolean;
}) {
  const [flashKey, setFlashKey] = React.useState<string | null>(null);
  const [flashNext, setFlashNext] = React.useState(false);
  const [userInteracted, setUserInteracted] = React.useState(false);

  // Auto-advance when "Nein" is selected (single choice)
  React.useEffect(() => {
    if (disabled || values.modality_matters !== false) return;
    if (suppressAutoAdvance && !userInteracted) return;
    const timer = setTimeout(() => {
      onNext();
    }, 1200); // Longer delay to read affirmation message
    return () => clearTimeout(timer);
  }, [values.modality_matters, disabled, onNext, suppressAutoAdvance, userInteracted]);

  const toggle = (val: string) => {
    const set = new Set(values.methods || []);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onChange({ methods: Array.from(set) });
  };

  const handleNextClick = () => {
    setFlashNext(true);
    setTimeout(() => {
      onNext();
    }, 200); // Brief flash before advancing
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium">Ist dir die Therapiemethode deines Therapeuten wichtig?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`h-11 rounded border px-4 text-center font-medium transition-all ${
                values.modality_matters === true
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900' + (flashKey === 'yes' ? ' scale-[1.02] shadow-md' : '')
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => {
                setFlashKey('yes');
                setUserInteracted(true);
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
              className={`h-11 rounded border px-4 text-center font-medium transition-all ${
                values.modality_matters === false
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900' + (flashKey === 'no' ? ' scale-[1.02] shadow-md' : '')
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => {
                setFlashKey('no');
                setUserInteracted(true);
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
                      className={`h-11 rounded border px-4 text-left transition-all ${
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

            {/* Navigation buttons for multi-select (moved up) */}
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
                className={`h-11 transition-all ${
                  flashNext ? 'scale-[1.05] shadow-lg' : ''
                }`}
                onClick={handleNextClick}
                disabled={disabled}
                aria-disabled={disabled}
              >
                Weiter →
              </Button>
            </div>

            {/* Optional explanations below */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-muted-foreground mb-4">Mehr über diese Methoden:</p>
              <TherapyModalityExplanations />
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons for single-select (Nein) */}
      {values.modality_matters === false && (
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
      )}

      {/* Show back button only if neither option selected yet */}
      {values.modality_matters === undefined && (
        <div className="flex items-center justify-start pt-2">
          <Button
            variant="secondary"
            className="h-11"
            onClick={onBack}
            disabled={disabled}
            aria-disabled={disabled}
          >
            Zurück
          </Button>
        </div>
      )}
    </div>
  );
}
