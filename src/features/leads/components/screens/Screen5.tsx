"use client";

import React from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type Screen5Values = {
  additional_info?: string;
  consent_share_with_therapists?: boolean;
};

export default function Screen5({
  values,
  onChange,
  onBack,
  onNext,
  disabled,
  consentError,
}: {
  values: Screen5Values;
  onChange: (patch: Partial<Screen5Values>) => void;
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
  consentError?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Label className="text-base">Gibt es noch etwas, was wir wissen sollten?</Label>
        <div className="space-y-2">
          <Label htmlFor="info" className="text-sm">Z.B. spezielle Themen, Zeitdruck, oder andere Wünsche</Label>
          <textarea
            id="info"
            className="min-h-[120px] w-full rounded border border-gray-300 px-3 py-2"
            placeholder="Optional"
            value={values.additional_info || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ additional_info: e.target.value })}
            disabled={!!disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="inline-flex items-start gap-3 select-none">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-gray-300"
            checked={!!values.consent_share_with_therapists}
            onChange={(e) => onChange({ consent_share_with_therapists: e.target.checked })}
            disabled={!!disabled}
            aria-invalid={consentError || undefined}
          />
          <span className="text-sm leading-5 text-muted-foreground">
            Ich willige ein, dass Kaufmann Health meine Angaben an passende Therapeut:innen weitergibt, um ein Kennenlerngespräch zu ermöglichen. Details stehen in der{' '}
            <Link href="/datenschutz" className="underline" target="_blank" rel="noreferrer">
              Datenschutzerklärung
            </Link>
            .
          </span>
        </label>
        {consentError && <p className="text-sm text-red-600">Bitte bestätige die Einwilligung, damit wir deine Angaben weitergeben dürfen.</p>}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack} disabled={!!disabled} aria-disabled={disabled}>Zurück</Button>
        <Button className="h-11" onClick={onNext} disabled={!!disabled} aria-disabled={disabled}>Weiter →</Button>
      </div>
    </div>
  );
}
