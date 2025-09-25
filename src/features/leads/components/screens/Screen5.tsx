"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export type Screen5Values = {
  additional_info?: string;
};

export default function Screen5({
  values,
  onChange,
  onBack,
  onNext,
}: {
  values: Screen5Values;
  onChange: (patch: Partial<Screen5Values>) => void;
  onBack: () => void;
  onNext: () => void;
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
            onChange={(e) => onChange({ additional_info: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" className="h-11" onClick={onBack}>Zurück</Button>
        <Button className="h-11" onClick={onNext}>Weiter →</Button>
      </div>
    </div>
  );
}
