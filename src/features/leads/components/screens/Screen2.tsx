"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type Screen2Values = {
  start_timing?: 'Diese Woche (Akutplätze verfügbar)' | 'Innerhalb eines Monats' | 'Bin flexibel';
  kassentherapie?: 'Ja, abgeschlossen' | 'Ja, bin noch in Therapie' | 'Nein' | 'Bin mir nicht sicher';
  therapy_type?:
    | 'Verhaltenstherapie (CBT)'
    | 'Tiefenpsychologische Therapie'
    | 'Psychoanalyse'
    | 'Systemische Therapie'
    | 'Andere'
    | 'Weiß ich nicht';
  what_missing?: string[];
};

const START_OPTS: Screen2Values['start_timing'][] = [
  'Diese Woche (Akutplätze verfügbar)',
  'Innerhalb eines Monats',
  'Bin flexibel',
];
const KASSEN_OPTS: Screen2Values['kassentherapie'][] = [
  'Ja, abgeschlossen',
  'Ja, bin noch in Therapie',
  'Nein',
  'Bin mir nicht sicher',
];
const TYPE_OPTS: NonNullable<Screen2Values['therapy_type']>[] = [
  'Verhaltenstherapie (CBT)',
  'Tiefenpsychologische Therapie',
  'Psychoanalyse',
  'Systemische Therapie',
  'Andere',
  'Weiß ich nicht',
];
const MISSING_OPTS = [
  'Ich verstehe alles, aber kann es nicht ändern',
  'Möchte mit Körperempfindungen arbeiten',
  'Brauche einen anderen Ansatz',
  'Suche somatische Begleitung',
  'Andere Gründe',
];

export default function Screen2({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
}: {
  values: Screen2Values;
  onChange: (patch: Partial<Screen2Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const [errors, setErrors] = React.useState<{ start?: string; kasse?: string }>({});

  const needsType = values.kassentherapie === 'Ja, abgeschlossen' || values.kassentherapie === 'Ja, bin noch in Therapie';

  function validate() {
    const e: { start?: string; kasse?: string } = {};
    if (!values.start_timing) e.start = 'Bitte wähle, wann du starten möchtest.';
    if (!values.kassentherapie) e.kasse = 'Bitte beantworte diese Frage.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Lass uns die perfekte Unterstützung für dich finden</Label>
        <div className="space-y-2">
          <p className="font-medium">Wann möchtest du starten?*</p>
          <div className="grid gap-2">
            {START_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${values.start_timing === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => onChange({ start_timing: opt })}
              >
                {opt}
              </button>
            ))}
          </div>
          {errors.start && <p className="text-sm text-red-600">{errors.start}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Hast du bereits eine Kassentherapie gemacht?*</p>
        <div className="grid gap-2">
          {KASSEN_OPTS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left ${values.kassentherapie === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => onChange({ kassentherapie: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
        {errors.kasse && <p className="text-sm text-red-600">{errors.kasse}</p>}
      </div>

      {needsType && (
        <div className="space-y-2">
          <p className="font-medium">Welche Art von Therapie war/ist es?</p>
          <div className="grid gap-2">
            {TYPE_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${values.therapy_type === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => onChange({ therapy_type: opt })}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="font-medium">Was fehlt dir noch? (Mehrfachauswahl möglich)</p>
        <div className="grid gap-2">
          {MISSING_OPTS.map((opt) => {
            const selected = (values.what_missing || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => {
                  const list = new Set(values.what_missing || []);
                  if (selected) list.delete(opt);
                  else list.add(opt);
                  onChange({ what_missing: Array.from(list) });
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()} disabled={disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
