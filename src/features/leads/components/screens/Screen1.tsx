"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getEmailError } from '@/lib/validation';

export type Screen1Values = {
  name: string;
  email: string;
};

export default function Screen1({
  values,
  onChange,
  onNext,
  disabled,
}: {
  values: Screen1Values;
  onChange: (patch: Partial<Screen1Values>) => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const [emailError, setEmailError] = React.useState<string | null>(null);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const err = getEmailError(values.email);
        setEmailError(err);
        if (!err) onNext();
      }}
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

      <div className="space-y-2">
        <Label htmlFor="email" className="text-base">Deine E-Mail für die Therapievorschläge</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          placeholder="deine@email.de"
          className="h-11"
          value={values.email}
          onChange={(e) => {
            onChange({ email: e.target.value });
          }}
          onBlur={() => setEmailError(getEmailError(values.email))}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-sm text-red-600">{emailError}</p>
        )}
        <p className="text-sm text-muted-foreground">Wir schicken dir passende Therapeut:innen</p>
      </div>

      <div>
        <Button type="submit" data-testid="wizard-next" className="h-12 w-full text-base" disabled={disabled} aria-disabled={disabled}>
          Passende Therapeut:innen finden →
        </Button>
      </div>
    </form>
  );
}
