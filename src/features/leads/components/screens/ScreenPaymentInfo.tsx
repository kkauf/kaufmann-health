'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';

export type PaymentPreference = 'self_pay' | 'insurance_waitlist';

export type ScreenPaymentInfoValues = {
  payment_preference?: PaymentPreference;
};

interface ScreenPaymentInfoProps {
  values: ScreenPaymentInfoValues;
  onChange: (values: Partial<ScreenPaymentInfoValues>) => void;
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export default function ScreenPaymentInfo({
  values,
  onChange,
  onBack,
  onNext,
  disabled = false,
}: ScreenPaymentInfoProps) {
  const selected = values.payment_preference;
  const canContinue = !!selected;

  const handleSelect = (preference: PaymentPreference) => {
    onChange({ payment_preference: preference });
  };

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-gray-700">
          <strong>Hinweis:</strong> Unsere Therapeut:innen arbeiten mit Selbstzahlern (€80–120/Sitzung).
          Die Wartezeit auf kassenfinanzierte Therapie beträgt oft 6+ Monate.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleSelect('self_pay')}
          disabled={disabled}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selected === 'self_pay'
              ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center ${
              selected === 'self_pay'
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-gray-300'
            }`}>
              {selected === 'self_pay' && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-base text-gray-900">Ich bin bereit, selbst zu zahlen</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('insurance_waitlist')}
          disabled={disabled}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            selected === 'insurance_waitlist'
              ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center ${
              selected === 'insurance_waitlist'
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-gray-300'
            }`}>
              {selected === 'insurance_waitlist' && (
                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-base text-gray-900">Ich möchte lieber auf einen Kassenplatz warten</span>
          </div>
        </button>
      </div>

      {/* Show KV Terminservicestelle link when insurance_waitlist is selected */}
      {selected === 'insurance_waitlist' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
          <p className="text-sm text-gray-700 mb-3">
            Die Kassenärztliche Vereinigung bietet einen kostenlosen Terminservice für kassenfinanzierte Therapieplätze:
          </p>
          <a
            href="https://www.116117.de/de/terminservice.php"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            <span>Zur Terminservicestelle (116117)</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

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
          disabled={disabled || !canContinue}
          className="flex-1 h-12 px-6 font-semibold shadow-md hover:shadow-lg transition-all"
        >
          Weiter
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
