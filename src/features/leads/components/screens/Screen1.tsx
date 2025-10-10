"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getEmailError } from '@/features/leads/lib/validation';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
import { getVerificationModeClient } from '@/lib/verification/config';
import { validatePhone } from '@/lib/verification/usePhoneValidation';
import ConsentSection from '@/components/ConsentSection';

export type ContactMethod = 'email' | 'phone';

export type Screen1Values = {
  name: string;
  email?: string;
  phone_number?: string;
  contact_method?: ContactMethod;
};

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|ipod/i.test(ua);
}

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
export default function Screen1({
  values,
  onChange,
  onNext,
  disabled,
  initialized = false,
}: {
  values: Screen1Values;
  onChange: (patch: Partial<Screen1Values>) => void;
  onNext: () => void;
  disabled?: boolean;
  initialized?: boolean;
}) {
  const mode = getVerificationModeClient();
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Initialize contact method on mount (hydration-safe)
  React.useEffect(() => {
    setMounted(true);

    // Wait until wizard has loaded saved data to avoid overwriting prefill
    if (!initialized) return;

    // If already set, don't override
    if (values.contact_method) return;
    
    // Must match server-side default (email) to avoid hydration mismatch
    let defaultMethod: ContactMethod = 'email';
    if (mode === 'email') {
      defaultMethod = 'email';
    } else if (mode === 'sms') {
      defaultMethod = 'phone';
    } else if (mode === 'choice') {
      // In choice mode, prefer saved preference, then detect mobile device
      const saved = getSavedContactMethod();
      if (saved) {
        defaultMethod = saved;
      } else if (isMobileDevice()) {
        // Default to phone on mobile devices (safe after hydration)
        defaultMethod = 'phone';
      }
    }
    
    onChange({ contact_method: defaultMethod });
  }, [mode, values.contact_method, onChange, initialized]);

  const contactMethod = values.contact_method || 'email';
  const canSwitchMethod = mode === 'choice';

  const handleSwitch = React.useCallback(() => {
    const newMethod: ContactMethod = contactMethod === 'email' ? 'phone' : 'email';
    saveContactMethod(newMethod);
    onChange({ contact_method: newMethod });
    setEmailError(null);
    setPhoneError(null);
  }, [contactMethod, onChange]);

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (contactMethod === 'email') {
      const err = getEmailError(values.email || '');
      setEmailError(err);
      if (!err) onNext();
    } else {
      // Validate and normalize phone
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
    <form
      className="space-y-6"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base">Wie dürfen wir dich ansprechen?</Label>
        <Input
          id="name"
          type="text"
          inputMode="text"
          placeholder="Vorname oder Spitzname"
          className="h-11"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          aria-label="Wie dürfen wir dich ansprechen?"
        />
        <p className="text-sm text-muted-foreground">Nur dein Vorname reicht</p>
      </div>

      {/* Contact field - email or phone based on mode */}
      <div className="space-y-2">
        {contactMethod === 'email' ? (
          <>
            <Label htmlFor="email" className="text-base">Deine E-Mail für die Therapievorschläge</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder="deine@email.de"
              className="h-11"
              value={values.email || ''}
              onChange={(e) => {
                onChange({ email: e.target.value });
              }}
              onBlur={() => setEmailError(getEmailError(values.email || ''))}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-red-600">{emailError}</p>
            )}
            <p className="text-sm text-muted-foreground">Wir schicken dir passende Therapeut:innen</p>
          </>
        ) : (
          <>
            <Label htmlFor="phone" className="text-base">Deine Handynummer für die Therapievorschläge</Label>
            <VerifiedPhoneInput
              value={values.phone_number || ''}
              onChange={(phone) => onChange({ phone_number: phone })}
              error={phoneError || undefined}
              helpText="Du bekommst einen SMS-Code zur Bestätigung"
            />
          </>
        )}
      </div>

      {/* Switch contact method link (choice mode only) */}
      {canSwitchMethod && mounted && (
        <div className="text-center -mt-2">
          <button
            type="button"
            onClick={handleSwitch}
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            {contactMethod === 'phone' ? 'Stattdessen Email verwenden' : 'Stattdessen Handynummer verwenden'}
          </button>
        </div>
      )}

      <ConsentSection actor="patient" className="mt-1" />

      <div>
        <Button type="submit" data-testid="wizard-next" className="h-12 w-full text-base" disabled={disabled} aria-disabled={disabled}>
          Passende Therapeut:innen finden →
        </Button>
      </div>
    </form>
  );
}
