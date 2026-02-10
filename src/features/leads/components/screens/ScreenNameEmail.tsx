'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import ConsentSection from '@/components/ConsentSection';

export type ScreenNameEmailValues = {
  name: string;
  email?: string;
};

interface ScreenNameEmailProps {
  values: ScreenNameEmailValues;
  onChange: (patch: Partial<ScreenNameEmailValues>) => void;
  onNext: () => void;
  onBack?: () => void;
  disabled?: boolean;
  /** If true, email was already collected in step 6 (email verification path) */
  emailAlreadyCollected?: boolean;
}

function sendEvent(type: string, properties: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ type, properties });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    }
  } catch {}
}

export default function ScreenNameEmail({
  values,
  onChange,
  onNext,
  onBack,
  disabled = false,
  emailAlreadyCollected = false,
}: ScreenNameEmailProps) {
  const [nameError, setNameError] = React.useState<string | null>(null);

  // Analytics: track screen shown
  React.useEffect(() => {
    sendEvent('name_email_shown', { phone_verified: true });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = (values.name || '').trim();
    if (!trimmedName) {
      setNameError('Bitte gib deinen Namen an.');
      return;
    }
    setNameError(null);

    sendEvent('name_email_submitted', {
      has_email: !!(values.email && values.email.trim()),
      has_name: true,
    });

    onNext();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Fast geschafft!</h2>
      </div>

      {/* Name field (required) */}
      <div className="space-y-2">
        <Label htmlFor="screen-name" className="text-base">
          Wie dürfen wir dich ansprechen?
        </Label>
        <Input
          id="screen-name"
          type="text"
          inputMode="text"
          placeholder="Vorname oder Spitzname"
          className="h-11"
          value={values.name}
          onChange={(e) => {
            setNameError(null);
            onChange({ name: e.target.value });
          }}
          disabled={disabled}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'screen-name-error' : undefined}
        />
        {nameError && (
          <p id="screen-name-error" className="text-sm text-red-600">
            {nameError}
          </p>
        )}
      </div>

      {/* Email field (optional, hidden if already collected) */}
      {!emailAlreadyCollected && (
        <div className="space-y-2">
          <Label htmlFor="screen-email" className="text-base">
            Damit deine Therapeut:in dich erreichen kann
          </Label>
          <Input
            id="screen-email"
            type="email"
            inputMode="email"
            placeholder="deine@email.de"
            className="h-11"
            value={values.email || ''}
            onChange={(e) => onChange({ email: e.target.value })}
            disabled={disabled}
          />
          <p className="text-sm text-muted-foreground">
            Optional — Therapeut:innen kommunizieren oft per E-Mail
          </p>
        </div>
      )}

      <ConsentSection actor="patient" className="mt-1" />

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBack}
            disabled={disabled}
            className="h-12 px-4 font-medium"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className="h-12 flex-1 px-6 font-semibold shadow-md transition-all hover:shadow-lg"
        >
          Matches ansehen →
        </Button>
      </div>
    </form>
  );
}
