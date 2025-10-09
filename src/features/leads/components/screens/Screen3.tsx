"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type Screen3Values = {
  city?: string;
  // Derived from session_preference for backward compatibility
  online_ok?: boolean;
  // Explicit preference selection
  session_preference?: 'online' | 'in_person' | 'either';
  privacy_preference?: 'Ja, sehr wichtig' | 'Nein, ist mir egal' | 'Bin mir unsicher';
};

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
  disabled,
}: {
  values: Screen3Values;
  onChange: (patch: Partial<Screen3Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const [errors, setErrors] = React.useState<{ location?: string; session?: string }>({});

  function validate() {
    const e: { location?: string; session?: string } = {};
    const pref = values.session_preference;
    if (!pref) e.session = 'Bitte wähle: Online, Vor Ort oder Beides.';
    const hasCity = !!(values.city && values.city.trim().length > 0);
    if (pref === 'in_person' && !hasCity) e.location = 'Bitte gib deine Stadt an.';
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
                disabled={!!disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Wie möchtest du die Sitzungen machen?</Label>
              <div className="grid gap-2">
                {([
                  { value: 'online', label: 'Online (Video)' },
                  { value: 'in_person', label: 'Vor Ort (in Präsenz)' },
                  { value: 'either', label: 'Beides ist okay' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`h-11 rounded border px-4 text-left ${values.session_preference === opt.value ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                    onClick={() => {
                      const derivedOnlineOk = opt.value === 'online' || opt.value === 'either';
                      onChange({ session_preference: opt.value, online_ok: derivedOnlineOk });
                    }}
                    disabled={!!disabled}
                    aria-disabled={disabled}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.session && <p className="text-sm text-red-600">{errors.session}</p>}
            </div>
            {errors.location && <p className="text-sm text-red-600">{errors.location}</p>}
          </div>
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
              disabled={!!disabled}
              aria-disabled={disabled}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
