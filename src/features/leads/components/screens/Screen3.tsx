"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

export type Screen3Values = {
  city?: string;
  // Derived from session_preference for backward compatibility
  online_ok?: boolean;
  // Explicit preference selection
  session_preference?: 'online' | 'in_person' | 'either';
};

// Currently only active in Berlin
const DEFAULT_CITY = 'Berlin';

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
  const [errors, setErrors] = React.useState<{ session?: string }>({});

  // Set default city on mount if not already set
  React.useEffect(() => {
    if (!values.city) {
      onChange({ city: DEFAULT_CITY });
    }
  }, []);

  function validate() {
    const e: { session?: string } = {};
    const pref = values.session_preference;
    if (!pref) e.session = 'Bitte wähle: Online, Vor Ort oder Beides.';
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
            <div className="space-y-1">
              <Label className="text-sm">Stadt</Label>
              <div className="flex items-center gap-2 h-11 px-3 rounded border border-gray-200 bg-gray-50 text-gray-700">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{DEFAULT_CITY}</span>
              </div>
              <p className="text-xs text-gray-500">Wir sind aktuell nur in Berlin aktiv.</p>
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
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
