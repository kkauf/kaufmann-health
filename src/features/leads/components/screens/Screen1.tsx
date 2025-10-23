"use client";

import React from 'react';
import { Clock, ShieldCheck, Check } from 'lucide-react';
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
}) {
  const mode = getVerificationModeClient();
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
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

    const trimmedName = (values.name || '').trim();
    if (!trimmedName) {
      setNameError('Bitte gib deinen Namen an.');
      return;
    }
    setNameError(null);

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
        <h2 className="text-xl font-semibold">Fast geschafft!</h2>
        <p>Katherine und Konstantin prüfen deine Anfrage persönlich.</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-gray-700">
          <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-600" /><span>Vorschläge in &lt;24h</span></span>
          <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /><span>Du entscheidest</span></span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-indigo-600" /><span>Daten bleiben privat</span></span>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name" className="text-base">Dein Name</Label>
        <Input
          id="name"
          type="text"
          inputMode="text"
          placeholder="Vorname oder Spitzname"
          className="h-11"
          value={values.name}
          onChange={(e) => { setNameError(null); onChange({ name: e.target.value }); }}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
          aria-label="Wie dürfen wir dich ansprechen?"
        />
        {nameError && (
          <p id="name-error" className="text-sm text-red-600">{nameError}</p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">Um dir deine Vorschläge zusenden zu können, benötigen wir noch Kontaktdaten von dir.</p>

      {/* Contact field - email or phone based on mode */}
      {canSwitchMethod && mounted && (
        <div className="mt-1">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => { saveContactMethod('email'); onChange({ contact_method: 'email' }); setEmailError(null); setPhoneError(null); }}
              className={
                "px-3 py-1.5 text-sm rounded-md transition-colors " +
                (contactMethod === 'email' ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")
              }
              aria-pressed={contactMethod === 'email'}
            >
              E‑Mail
            </button>
            <button
              type="button"
              onClick={() => { saveContactMethod('phone'); onChange({ contact_method: 'phone' }); setEmailError(null); setPhoneError(null); }}
              className={
                "ml-1 px-3 py-1.5 text-sm rounded-md transition-colors " +
                (contactMethod === 'phone' ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")
              }
              aria-pressed={contactMethod === 'phone'}
            >
              SMS
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {contactMethod === 'email' ? (
          <>
            <Label htmlFor="email" className="text-base">E‑Mail für deine Therapievorschläge</Label>
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
          </>
        ) : (
          <>
            <Label htmlFor="phone" className="text-base">Handynummer für deine Therapievorschläge</Label>
            <VerifiedPhoneInput
              value={values.phone_number || ''}
              onChange={(phone) => onChange({ phone_number: phone })}
              error={phoneError || undefined}
              helpText="Du bekommst einen SMS-Code zur Bestätigung"
            />
            
          </>
        )}
      </div>

      

      <ConsentSection actor="patient" className="mt-1" />

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
          className="h-12 w-full md:w-auto text-base"
          disabled={disabled}
          aria-disabled={disabled}
        >
          Passende Therapeut:innen finden →
        </Button>
      </div>
    </form>
  );
}
