"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type NewScreen1Values = {
  therapy_experience?: 'has_experience' | 'first_time' | 'unsure';
  therapy_type?:
    | 'Verhaltenstherapie (CBT)'
    | 'Tiefenpsychologische Therapie'
    | 'Psychoanalyse'
    | 'Systemische Therapie'
    | 'Andere'
    | 'Weiß ich nicht';
};

const EXPERIENCE_OPTS: Array<{ value: NonNullable<NewScreen1Values['therapy_experience']>; label: string }> = [
  { value: 'has_experience', label: 'Ja, ich habe bereits Therapieerfahrung' },
  { value: 'first_time', label: 'Nein, dies wäre meine erste Therapie' },
  { value: 'unsure', label: 'Bin mir nicht sicher' },
];

const TYPE_OPTS: NonNullable<NewScreen1Values['therapy_type']>[] = [
  'Verhaltenstherapie (CBT)',
  'Tiefenpsychologische Therapie',
  'Psychoanalyse',
  'Systemische Therapie',
  'Andere',
  'Weiß ich nicht',
];

export default function NewScreen1_TherapyExperience({
  values,
  onChange,
  onNext,
  disabled,
}: {
  values: NewScreen1Values;
  onChange: (patch: Partial<NewScreen1Values>) => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const needsType = values.therapy_experience === 'has_experience';

  function validate() {
    if (!values.therapy_experience) {
      setError('Bitte beantworte diese Frage.');
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Hast du bereits Therapie gemacht?*</Label>
        <div className="grid gap-2">
          {EXPERIENCE_OPTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`h-11 rounded border px-4 text-left ${
                values.therapy_experience === opt.value
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-gray-300'
              }`}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => onChange({ therapy_experience: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {needsType && (
        <div className="space-y-2">
          <p className="font-medium">Welche Art von Therapie war/ist es?</p>
          <div className="grid gap-2">
            {TYPE_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`h-11 rounded border px-4 text-left ${
                  values.therapy_type === opt
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-gray-300'
                }`}
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

      <div className="flex items-center justify-end pt-2">
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
