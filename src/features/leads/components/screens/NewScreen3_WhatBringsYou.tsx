"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type NewScreen3Values = {
  additional_info?: string;
};

export default function NewScreen3_WhatBringsYou({
  values,
  onChange,
  onNext,
  onBack,
  disabled,
}: {
  values: NewScreen3Values;
  onChange: (patch: Partial<NewScreen3Values>) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="issue" className="text-base">
          Was bringt dich zur Therapie? (Optional)
        </Label>
        <Textarea
          id="issue"
          placeholder="z.B. Angst, Trauma, Beziehungsprobleme..."
          className="min-h-[120px] resize-none"
          value={values.additional_info || ''}
          onChange={(e) => onChange({ additional_info: e.target.value })}
          maxLength={500}
          disabled={disabled}
        />
        <p className="text-sm text-muted-foreground">
          Hilft uns, passendere Therapeut:innen zu finden. Du kannst dies auch überspringen.
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          className="h-11"
          onClick={onBack}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Zurück
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="h-11"
            onClick={onNext}
            disabled={disabled}
            aria-disabled={disabled}
          >
            Überspringen
          </Button>
          <Button
            className="h-11"
            onClick={onNext}
            disabled={disabled}
            aria-disabled={disabled}
          >
            Weiter →
          </Button>
        </div>
      </div>
    </div>
  );
}
