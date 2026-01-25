'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { getSchwerpunktLabel } from '@/lib/schwerpunkte';

export type PaymentPreference = 'self_pay' | 'insurance_waitlist';

export type ScreenPaymentInfoValues = {
  payment_preference?: PaymentPreference;
};

interface ScreenPaymentInfoProps {
  values: ScreenPaymentInfoValues;
  schwerpunkte?: string[];
  onChange: (values: Partial<ScreenPaymentInfoValues>) => void;
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
}

// Investment framing based on schwerpunkt - what waiting 6+ months costs them
const INVESTMENT_FRAMING: Record<string, string> = {
  trauma: '6 weitere Monate mit Flashbacks, Albträumen oder ständiger Anspannung',
  angst: '6 weitere Monate, in denen Angst deinen Alltag einschränkt',
  depression: '6 weitere Monate Erschöpfung und das Gefühl, nicht weiterzukommen',
  selbstwert: '6 weitere Monate innerer Kritik und Selbstzweifel',
  trauer: '6 weitere Monate, den Schmerz alleine zu tragen',
  psychosomatik: '6 weitere Monate körperlicher Beschwerden ohne Lösung',
  essstoerung: '6 weitere Monate im Kampf mit Essen und Körperbild',
  wut: '6 weitere Monate, in denen Emotionen dich überwältigen',
  zwang: '6 weitere Monate unter dem Druck von Zwängen und Kontrolle',
  sexualitaet: '6 weitere Monate Blockaden in deiner Intimität',
  beziehung: '6 weitere Monate Beziehungsstress und Einsamkeit',
  paare: '6 weitere Monate Konflikte statt Verbindung',
  krisen: '6 weitere Monate in der Krise ohne professionelle Begleitung',
  identitaet: '6 weitere Monate Unsicherheit über dich selbst',
  neurodivergenz: '6 weitere Monate ohne passende Unterstützung für dein Gehirn',
  entwicklung: '6 weitere Monate Stillstand statt Wachstum',
};

export default function ScreenPaymentInfo({
  values,
  schwerpunkte = [],
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

  // Get personalized investment framing based on first schwerpunkt
  const primarySchwerpunkt = schwerpunkte[0];
  const investmentMessage = primarySchwerpunkt ? INVESTMENT_FRAMING[primarySchwerpunkt] : null;
  const schwerpunktLabel = primarySchwerpunkt ? getSchwerpunktLabel(primarySchwerpunkt) : null;

  return (
    <div className="space-y-6">
      {/* Investment framing */}
      <div className="space-y-3">
        <p className="text-base leading-relaxed text-gray-700">
          Unsere Therapeut:innen arbeiten mit Selbstzahlern (€80–120/Sitzung).
        </p>
        {investmentMessage && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <p className="text-sm text-gray-600 mb-1">Die Wartezeit auf einen Kassenplatz bedeutet oft:</p>
            <p className="text-base font-medium text-gray-900">{investmentMessage}</p>
          </div>
        )}
        {!investmentMessage && (
          <p className="text-sm text-gray-600">
            Die Wartezeit auf kassenfinanzierte Therapie beträgt oft 6+ Monate.
          </p>
        )}
        <p className="text-sm text-gray-700">
          <strong>Therapie ist eine Investition in dich selbst</strong> – in deine Gesundheit, deine Beziehungen und deine Lebensqualität.
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

      {/* Show info panel when insurance_waitlist is selected */}
      {selected === 'insurance_waitlist' && (
        <div className="space-y-4">
          {/* Reconsider panel */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
            <p className="text-sm font-medium text-gray-900 mb-2">Gut zu wissen:</p>
            <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
              <li>Viele Klient:innen starten selbstzahlend und wechseln später zur Kasse</li>
              <li>Private Krankenzusatzversicherungen erstatten oft 80–100%</li>
              <li>Manche Arbeitgeber übernehmen Therapiekosten als Benefit</li>
            </ul>
            <button
              type="button"
              onClick={() => handleSelect('self_pay')}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
            >
              Doch lieber selbst zahlen →
            </button>
          </div>

          {/* KV Terminservicestelle link */}
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
