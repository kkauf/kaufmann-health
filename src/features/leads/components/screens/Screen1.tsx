"use client";

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getEmailError } from '@/features/leads/lib/validation';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
import { getVerificationModeClient } from '@/lib/verification/config';
import { validatePhone } from '@/lib/verification/usePhoneValidation';

export type ContactMethod = 'email' | 'phone';

export type Screen1Values = {
  name: string;
  email?: string;
  phone_number?: string;
  contact_method?: ContactMethod;
};

function getSavedContactMethod(): ContactMethod | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem('kh_contact_method');
  if (saved === 'email' || saved === 'phone') return saved;
  return null;
}

function saveContactMethod(method: ContactMethod) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('kh_contact_method', method);
  }
}

/**
 * Step 6: Phone-first contact collection (progressive disclosure flow)
 *
 * Shows phone input by default. Subtle "Lieber per E-Mail?" link toggles to email.
 * No name, no consent — those are collected in step 6.75 (ScreenNameEmail).
 */
export default function Screen1({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
  initialized = false,
}: {
  values: Screen1Values;
  onChange: (patch: Partial<Screen1Values>) => void;
  onNext: () => void;
  onBack?: () => void;
  disabled?: boolean;
  initialized?: boolean;
  isConcierge?: boolean;
  therapistCount?: number | null;
}) {
  const mode = getVerificationModeClient();
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);

  // Initialize contact method on mount (hydration-safe) — default to phone
  React.useEffect(() => {
    if (!initialized) return;
    if (values.contact_method) return;

    let defaultMethod: ContactMethod = 'phone';
    if (mode === 'email') {
      defaultMethod = 'email';
    } else if (mode === 'sms') {
      defaultMethod = 'phone';
    } else if (mode === 'choice') {
      const saved = getSavedContactMethod();
      defaultMethod = saved || 'phone';
    }

    onChange({ contact_method: defaultMethod });
  }, [mode, values.contact_method, onChange, initialized]);

  const contactMethod = values.contact_method || 'phone';

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (contactMethod === 'email') {
      const err = getEmailError(values.email || '');
      setEmailError(err);
      if (!err) onNext();
    } else {
      const validation = validatePhone(values.phone_number || '');
      if (!validation.isValid) {
        setPhoneError(validation.error || 'Bitte gib eine gültige Handynummer ein.');
      } else {
        setPhoneError(null);
        onNext();
      }
    }
  }, [contactMethod, values.email, values.phone_number, onNext]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {contactMethod === 'phone'
            ? 'Erhalte deinen Zugang per SMS'
            : 'Erhalte deinen Zugang per E-Mail'}
        </h2>
        <p className="text-gray-600">In 10 Sekunden verifiziert</p>
      </div>

      <div className="space-y-2">
        {contactMethod === 'phone' ? (
          <>
            <Label htmlFor="phone" className="text-base">Handynummer</Label>
            <VerifiedPhoneInput
              value={values.phone_number || ''}
              onChange={(phone) => onChange({ phone_number: phone })}
              error={phoneError || undefined}
            />
          </>
        ) : (
          <>
            <Label htmlFor="email" className="text-base">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder="deine@email.de"
              className="h-11"
              value={values.email || ''}
              onChange={(e) => onChange({ email: e.target.value })}
              onBlur={() => setEmailError(getEmailError(values.email || ''))}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-red-600">{emailError}</p>
            )}
          </>
        )}
      </div>

      {/* Privacy one-liner */}
      <p className="flex items-center gap-1.5 text-sm text-gray-500">
        <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <span>
          Deine {contactMethod === 'phone' ? 'Nummer' : 'E-Mail'} wird nur zur Verifizierung verwendet.{' '}
          <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
            Datenschutz
          </a>
        </span>
      </p>

      <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center gap-3">
        {onBack && (
          <Button
            variant="secondary"
            type="button"
            className="h-12 w-full md:w-auto"
            onClick={onBack}
            disabled={disabled}
            aria-disabled={disabled}
          >
            Zurück
          </Button>
        )}
        <Button
          type="submit"
          data-testid="wizard-next"
          className="h-12 w-full md:w-auto text-base font-semibold"
          disabled={disabled}
          aria-disabled={disabled}
        >
          Code senden →
        </Button>
      </div>

      {/* Subtle toggle for alternative contact method */}
      {mode === 'choice' && (
        <button
          type="button"
          onClick={() => {
            const newMethod: ContactMethod = contactMethod === 'phone' ? 'email' : 'phone';
            saveContactMethod(newMethod);
            onChange({ contact_method: newMethod });
            setEmailError(null);
            setPhoneError(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline w-full text-center transition-colors"
        >
          {contactMethod === 'phone' ? 'Lieber per E-Mail?' : 'Lieber per SMS?'}
        </button>
      )}
    </form>
  );
}
