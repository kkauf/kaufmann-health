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

  const needsLocation = values.session_preference === 'in_person' || values.session_preference === 'either';

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Label className="text-base">Fast geschafft - noch ein paar praktische Details</Label>
        
        {/* Session preference - ask first */}
        <div className="space-y-2">
          <p className="font-medium">Wie möchtest du die Sitzungen machen?</p>
          <div className="grid gap-2">
            {([
              { value: 'online', label: 'Online (Video)', subtitle: 'Deutschlandweit verfügbar' },
              { value: 'in_person', label: 'Vor Ort (in Präsenz)', subtitle: 'Aktuell nur in Berlin' },
              { value: 'either', label: 'Beides ist okay', subtitle: 'Online + Vor Ort in Berlin' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`h-auto py-3 rounded border px-4 text-left ${values.session_preference === opt.value ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300'}`}
                onClick={() => {
                  const derivedOnlineOk = opt.value === 'online' || opt.value === 'either';
                  onChange({ session_preference: opt.value, online_ok: derivedOnlineOk });
                }}
                disabled={!!disabled}
                aria-disabled={disabled}
              >
                <span className="block font-medium">{opt.label}</span>
                <span className="block text-xs text-gray-500">{opt.subtitle}</span>
              </button>
            ))}
          </div>
          {errors.session && <p className="text-sm text-red-600">{errors.session}</p>}
        </div>

        {/* City - only show when in_person or either selected */}
        {needsLocation && (
          <div className="space-y-1 pt-2">
            <Label className="text-sm">Standort für Präsenz-Sitzungen</Label>
            <div className="flex items-center gap-2 h-11 px-3 rounded border border-gray-200 bg-gray-50 text-gray-700">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>{DEFAULT_CITY}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={() => validate() && onNext()} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
