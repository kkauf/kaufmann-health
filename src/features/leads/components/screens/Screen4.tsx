"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type Screen4Values = {
  gender?: 'Frau' | 'Mann' | 'Keine Präferenz' | 'Divers/non-binär';
  language?: 'Deutsch' | 'Englisch' | 'Andere';
  language_other?: string;
  time_slots?: string[]; // e.g., 'Morgens (8-12 Uhr)'
  methods?: string[]; // Still here for compatibility, but modality is handled in NewScreen5
};

const GENDER: NonNullable<Screen4Values['gender']>[] = ['Frau', 'Mann', 'Keine Präferenz', 'Divers/non-binär'];
const LANGS: NonNullable<Screen4Values['language']>[] = ['Deutsch', 'Englisch', 'Andere'];
const TIMES = ['Morgens (8-12 Uhr)', 'Nachmittags (12-17 Uhr)', 'Abends (17-21 Uhr)', 'Wochenende', 'Bin flexibel'];

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
  const [errors, setErrors] = React.useState<{ language?: string; other?: string; time_slots?: string; methods?: string }>({});

  function validate() {
    const e: { language?: string; other?: string; time_slots?: string; methods?: string } = {};
    if (!values.language) e.language = 'Bitte wähle eine Sprache.';
    if (values.language === 'Andere' && !(values.language_other && values.language_other.trim())) {
      e.other = 'Bitte gib die gewünschte Sprache an.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const toggle = (key: 'time_slots' | 'methods', val: string) => {
    const set = new Set(values[key] || []);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onChange({ [key]: Array.from(set) } as Partial<Screen4Values>);
  };

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

      <div className="space-y-2">
        <p className="font-medium">In welcher Sprache möchtest du Therapie machen?*</p>
        <div className="grid gap-2">
          {LANGS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left ${values.language === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
              disabled={!!disabled}
              aria-disabled={disabled}
              onClick={() => onChange({ language: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
        {values.language === 'Andere' && (
          <input
            type="text"
            className="mt-2 h-11 w-full rounded border border-gray-300 px-3"
            placeholder="Welche Sprache?"
            value={values.language_other || ''}
            onChange={(e) => onChange({ language_other: e.target.value })}
            disabled={!!disabled}
          />
        )}
        {errors.language && <p className="text-sm text-red-600">{errors.language}</p>}
        {errors.other && <p className="text-sm text-red-600">{errors.other}</p>}
      </div>

      <div className="space-y-2">
        <p className="font-medium">Wann hast du Zeit für Termine? (Mehrfachauswahl)</p>
        <div className="grid gap-2">
          {TIMES.map((opt) => {
            const selected = (values.time_slots || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                disabled={!!disabled}
                aria-disabled={disabled}
                onClick={() => toggle('time_slots', opt)}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>


      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
