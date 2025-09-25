"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type Screen3Values = {
  city?: string;
  online_ok?: boolean;
  budget?: 'Unter 80€' | '80-120€' | 'Über 120€' | 'Brauche einen Zahlungsplan';
  privacy_preference?: 'Ja, sehr wichtig' | 'Nein, ist mir egal' | 'Bin mir unsicher';
};

const BUDGETS: NonNullable<Screen3Values['budget']>[] = [
  'Unter 80€',
  '80-120€',
  'Über 120€',
  'Brauche einen Zahlungsplan',
];
const PRIVACY: NonNullable<Screen3Values['privacy_preference']>[] = [
  'Ja, sehr wichtig',
  'Nein, ist mir egal',
  'Bin mir unsicher',
];

export default function Screen3({
  values,
  onChange,
  onNext,
  onBack,
}: {
  values: Screen3Values;
  onChange: (patch: Partial<Screen3Values>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = React.useState<{ location?: string }>({});

  function validate() {
    const e: { location?: string } = {};
    const hasCity = !!(values.city && values.city.trim().length > 0);
    const online = !!values.online_ok;
    if (!hasCity && !online) e.location = 'Bitte gib eine Stadt an oder aktiviere Online‑Therapie.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Fast geschafft - noch ein paar praktische Details</Label>
        <div className="space-y-2">
          <p className="font-medium">Wo suchst du Unterstützung?</p>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm">Stadt</Label>
              <Input
                id="city"
                type="text"
                inputMode="text"
                autoComplete="address-level2"
                placeholder="z. B. Berlin"
                className="h-11"
                value={values.city || ''}
                onChange={(e) => onChange({ city: e.target.value })}
              />
            </div>
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300"
                checked={!!values.online_ok}
                onChange={(e) => onChange({ online_ok: e.target.checked })}
              />
              <span>Online‑Therapie ist auch okay</span>
            </label>
            {errors.location && <p className="text-sm text-red-600">{errors.location}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Wie viel kannst du pro Sitzung investieren?</p>
        <p className="text-sm text-muted-foreground">Steuerlich absetzbar als außergewöhnliche Belastung</p>
        <div className="grid gap-2">
          {BUDGETS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left ${values.budget === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
              onClick={() => onChange({ budget: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Ist dir Privatsphäre wichtig?</p>
        <p className="text-sm text-muted-foreground">Keine Krankenkassen‑Akten, keine Diagnosen</p>
        <div className="grid gap-2">
          {PRIVACY.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`h-11 rounded border px-4 text-left ${values.privacy_preference === opt ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
              onClick={() => onChange({ privacy_preference: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()}>Weiter →</Button>
      </div>
    </div>
  );
}
