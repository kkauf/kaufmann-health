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
  const canContinue = selected === 'self_pay';

  const handleSelect = (preference: PaymentPreference) => {
    onChange({ payment_preference: preference });
  };

  return (
    <div className="space-y-6">
      {/* Context */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Kurzer Hinweis zur Finanzierung</h2>
        <p className="text-base text-gray-700">
          Unsere Therapeut:innen arbeiten mit Selbstzahlern (€80–120 pro Sitzung).
          Viele unserer Klient:innen sehen das als Investition in sich selbst –
          in ihre Gesundheit, ihre Beziehungen und ihre Lebensqualität.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {/* Self-pay option */}
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
            <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
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
            <div>
              <span className="text-base font-medium text-gray-900">Das passt für mich</span>
              <p className="text-sm text-gray-600 mt-1">Sofort starten · Freie Therapeutenwahl · Volle Flexibilität</p>
            </div>
          </div>
        </button>

        {/* Insurance waitlist option */}
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
            <div className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
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
            <div>
              <span className="text-base font-medium text-gray-900">Nein, ich brauche einen Kassenplatz</span>
              {selected === 'insurance_waitlist' && (
                <p className="text-sm text-gray-600 mt-1">Oft 6+ Monate Wartezeit · Zugewiesene:r Therapeut:in · Eintrag in Patientenakte</p>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Show helpful info when insurance_waitlist is selected */}
      {selected === 'insurance_waitlist' && (
        <div className="space-y-4">
          {/* Caring message + value proposition */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-900 mb-3">
              Wir verstehen das – und würden dir trotzdem gerne helfen.
            </p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>Die Wartezeit auf kassenfinanzierte Therapie beträgt oft über 6 Monate</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>Einen Kassenplatz bei Expert:innen für Körperpsychotherapie zu finden ist nahezu unmöglich</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>Unsere Klient:innen berichten oft schon nach 3 Sitzungen von spürbaren Verbesserungen</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>Ein kostenloses Kennenlerngespräch ist möglich – um zu sehen, ob es das Richtige für dich ist</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => {
                handleSelect('self_pay');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="mt-4 w-full text-center py-2 px-4 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
            >
              Ich probier&apos;s aus →
            </button>
          </div>

          {/* Helpful alternatives */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-900 mb-2">Gut zu wissen:</p>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex gap-2">
                <span className="text-gray-400">•</span>
                <span>Private Zusatzversicherungen erstatten oft 80–100% der Kosten</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">•</span>
                <span>Manche Arbeitgeber übernehmen Therapiekosten als Benefit</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">•</span>
                <span>Du kannst selbstzahlend starten und später zu einem Kassenplatz wechseln</span>
              </li>
            </ul>
          </div>

          {/* KV Terminservicestelle link */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
            <p className="text-sm text-gray-700 mb-3">
              Für kassenfinanzierte Plätze hilft dir die Terminservicestelle:
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
