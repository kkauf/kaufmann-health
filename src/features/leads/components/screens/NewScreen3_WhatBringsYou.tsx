"use client";

import React from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Lock } from 'lucide-react';

export type NewScreen3Values = {
  additional_info?: string;
};

const MIN_LENGTH = 10; // Minimum characters required

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
  const text = values.additional_info?.trim() || '';
  const isValid = text.length >= MIN_LENGTH;

  return (
    <div className="space-y-6">
      {/* Personal trust message */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white p-4">
        <div className="flex-shrink-0">
          <Image
            src="/profile-pictures/katherine-clear.jpg"
            alt="Katherine Kaufmann"
            width={48}
            height={48}
            className="rounded-full object-cover object-center shadow-sm ring-2 ring-emerald-100"
            style={{ objectPosition: '50% 30%' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
            &bdquo;Ich lese jede Anfrage persönlich und schlage dir Therapeut:innen vor, die wirklich zu deiner Situation passen.&ldquo;
          </p>
          <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
            – Katherine, Gründerin
          </p>
        </div>
      </div>

      {/* Input section */}
      <div className="space-y-3">
        <Label htmlFor="issue" className="text-base font-medium">
          Was bringt dich zur Therapie?
        </Label>
        <Textarea
          id="issue"
          placeholder="z.B. Angst, Trauma, Beziehungsprobleme, Erschöpfung, chronischer Stress..."
          className="min-h-[120px] resize-none text-base"
          value={values.additional_info || ''}
          onChange={(e) => onChange({ additional_info: e.target.value })}
          maxLength={500}
          disabled={disabled}
        />
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Nur Katherine sieht deine Angaben – sie werden nicht an Therapeut:innen weitergegeben.</span>
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
        <Button
          className="h-11"
          onClick={onNext}
          disabled={disabled || !isValid}
          aria-disabled={disabled || !isValid}
        >
          Weiter →
        </Button>
      </div>
    </div>
  );
}
