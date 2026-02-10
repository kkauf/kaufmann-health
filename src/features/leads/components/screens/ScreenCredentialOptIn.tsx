'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export type ScreenCredentialOptInValues = {
  accept_certified?: boolean;
};

interface ScreenCredentialOptInProps {
  values: ScreenCredentialOptInValues;
  onChange: (values: Partial<ScreenCredentialOptInValues>) => void;
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export default function ScreenCredentialOptIn({
  values,
  onChange,
  onBack,
  onNext,
  disabled = false,
}: ScreenCredentialOptInProps) {
  const isChecked = values.accept_certified === true;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Weitere Therapeut:innen verfügbar</h2>
        <p className="text-base text-gray-700">
          Neben unseren Heilpraktiker:innen arbeiten wir auch mit zertifizierten
          Körpertherapeut:innen zusammen, die sich auf Methoden wie NARM und Somatic
          Experiencing spezialisiert haben.
        </p>
        <p className="text-sm text-gray-600">
          Diese Therapeut:innen bieten körpertherapeutische Begleitung an — keine
          Psychotherapie im Sinne des Heilpraktikergesetzes.
        </p>
      </div>

      {/* Opt-in checkbox */}
      <button
        type="button"
        onClick={() => onChange({ accept_certified: !isChecked })}
        disabled={disabled}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          isChecked
            ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            isChecked
              ? 'border-indigo-500 bg-indigo-500'
              : 'border-gray-300'
          }`}>
            {isChecked && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div>
            <span className="text-base font-medium text-gray-900">
              Auch zertifizierte Körpertherapeut:innen anzeigen
            </span>
            <p className="text-sm text-gray-600 mt-1">
              Erweitert deine Auswahl um spezialisierte Praktiker:innen
            </p>
          </div>
        </div>
      </button>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
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
        <Button
          type="button"
          size="lg"
          onClick={onNext}
          disabled={disabled}
          className="flex-1 h-12 px-6 font-semibold shadow-md hover:shadow-lg transition-all"
        >
          Weiter
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
