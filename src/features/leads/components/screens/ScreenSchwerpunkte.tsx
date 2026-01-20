'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { ClientSchwerpunkteSelector } from '@/components/ClientSchwerpunkteSelector';
import { CLIENT_SCHWERPUNKTE_MIN, CLIENT_SCHWERPUNKTE_MAX } from '@/lib/schwerpunkte';

export type ScreenSchwerpunkteValues = {
  schwerpunkte?: string[];
};

interface ScreenSchwerpunkteProps {
  values: ScreenSchwerpunkteValues;
  onChange: (values: Partial<ScreenSchwerpunkteValues>) => void;
  onBack?: () => void;  // Optional - may be first step
  onNext: () => void;
  disabled?: boolean;
  therapistCount?: number | null;
}

export default function ScreenSchwerpunkte({
  values,
  onChange,
  onBack,
  onNext,
  disabled = false,
  therapistCount,
}: ScreenSchwerpunkteProps) {
  const selected = values.schwerpunkte ?? [];
  const canContinue = selected.length >= CLIENT_SCHWERPUNKTE_MIN;

  // Format therapist count for display
  const countDisplay = therapistCount 
    ? (therapistCount >= 50 ? '50+' : String(therapistCount))
    : null;

  const handleChange = React.useCallback(
    (newSelected: string[]) => {
      onChange({ schwerpunkte: newSelected });
    },
    [onChange]
  );

  return (
    <div className="space-y-6">
      {/* Progressive filtering indicator */}
      {countDisplay && (
        <div className="flex items-center justify-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-lg py-2 px-3 border border-emerald-100">
          <Users className="h-4 w-4" />
          <span><strong>{countDisplay}</strong> Therapeut:innen passen zu deinen Kriterien</span>
        </div>
      )}

      <ClientSchwerpunkteSelector
        selected={selected}
        onChange={handleChange}
        maxSelections={CLIENT_SCHWERPUNKTE_MAX}
      />

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBack}
            disabled={disabled}
            className="h-12 px-4 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          onClick={onNext}
          disabled={disabled || !canContinue}
          className="flex-1 h-12 px-6 font-semibold shadow-md hover:shadow-lg transition-all"
        >
          Weiter
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Skip option */}
      <div className="text-center">
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          Überspringen
        </button>
      </div>
    </div>
  );
}
