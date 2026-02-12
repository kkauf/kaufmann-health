'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Check } from 'lucide-react';
import { getSchwerpunktLabel } from '@/lib/schwerpunkte';

interface MatchPreview {
  firstName: string;
  photoUrl: string | null;
  schwerpunkte: string[];
}

interface ScreenMatchPreviewProps {
  matchCount: number;
  matchPreviews: MatchPreview[];
  matchQuality: 'exact' | 'partial' | 'none';
  patientSchwerpunkte: string[];
  onNext: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

function sendEvent(type: string, properties: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ type, properties });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    }
  } catch {}
}

/** Find overlapping schwerpunkte between patient and therapist, return human labels */
function getOverlapLabels(patientIds: string[], therapistIds: string[]): string[] {
  const patientSet = new Set(patientIds);
  return therapistIds
    .filter((id) => patientSet.has(id))
    .slice(0, 2)
    .map(getSchwerpunktLabel);
}

export default function ScreenMatchPreview({
  matchCount,
  matchPreviews,
  matchQuality,
  patientSchwerpunkte,
  onNext,
  onBack,
  disabled = false,
}: ScreenMatchPreviewProps) {
  const hasMatches = matchCount > 0;

  // Analytics: track screen shown
  React.useEffect(() => {
    sendEvent('match_preview_shown', { match_count: matchCount, match_quality: matchQuality });
  }, [matchCount, matchQuality]);

  const handleCTA = () => {
    sendEvent('match_preview_cta_clicked', { match_count: matchCount });
    onNext();
  };

  return (
    <div className="space-y-6">
      {hasMatches ? (
        <>
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <Sparkles className="h-4 w-4" />
              <span>Ergebnisse gefunden</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              <span className="text-emerald-600">{matchCount}</span> passende Therapeut:innen warten auf dich
            </h2>
          </div>

          {/* Therapist preview cards */}
          <div className="space-y-3">
            {matchPreviews.slice(0, 3).map((preview, i) => {
              const overlapLabels = getOverlapLabels(patientSchwerpunkte, preview.schwerpunkte);
              return (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Photo or initial fallback */}
                    {preview.photoUrl ? (
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-emerald-100">
                        <Image
                          src={preview.photoUrl}
                          alt={preview.firstName}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-lg font-semibold text-emerald-700 ring-2 ring-emerald-100">
                        {preview.firstName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-900">{preview.firstName}</p>
                      {overlapLabels.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {overlapLabels.map((label) => (
                            <span key={label} className="inline-flex items-center gap-1 text-sm text-emerald-700">
                              <Check className="h-3.5 w-3.5" />
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {matchCount > 3 && (
            <p className="text-center text-sm text-gray-500">
              + {matchCount - 3} weitere Therapeut:innen
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Wir suchen weiter
          </h2>
          <p className="text-base text-gray-600">
            Noch kein perfektes Match — aber hinterlasse deine Kontaktdaten
            und wir benachrichtigen dich, sobald eine passende Therapeut:in verfügbar ist.
          </p>
        </div>
      )}

      {/* CTA + Back */}
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
          type="button"
          size="lg"
          onClick={handleCTA}
          disabled={disabled}
          className="h-12 flex-1 bg-emerald-600 px-6 font-semibold shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
        >
          {hasMatches ? 'Ergebnisse freischalten →' : 'Kontaktdaten hinterlassen →'}
        </Button>
      </div>
    </div>
  );
}
