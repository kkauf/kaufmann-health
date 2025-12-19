'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, MessageSquare, Calendar } from 'lucide-react';
import PageAnalytics from '@/components/PageAnalytics';

const REASON_LABELS: Record<string, string> = {
  price_too_high: 'Preis ist zu hoch',
  unsure_which_therapist: 'Unsicher, welche:r Therapeut:in passt',
  need_more_time: 'Brauche mehr Zeit',
  found_alternative: 'Habe andere Lösung gefunden',
  match_dissatisfied: 'Empfehlung passt nicht',
  other: 'Etwas anderes',
};

function FeedbackContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patient') || '';
  const reason = searchParams.get('reason') || 'other';
  const therapistId = searchParams.get('therapist') || '';
  const source = searchParams.get('utm_campaign') || 'direct';

  const [tracked, setTracked] = useState(false);
  const [details, setDetails] = useState('');
  const [detailsSubmitted, setDetailsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Track feedback on mount
  useEffect(() => {
    if (tracked || !patientId) return;
    setTracked(true);

    const payload = {
      type: 'feedback_response',
      properties: {
        subtype: 'quick_survey',
        patient_id: patientId,
        reason,
        ...(therapistId ? { therapist_id: therapistId } : {}),
        source,
      },
    };

    // Use fetch with keepalive for reliability
    fetch('/api/public/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [tracked, patientId, reason, therapistId, source]);

  const handleSubmitDetails = useCallback(async () => {
    if (!details.trim() || !patientId) return;
    setSubmitting(true);

    try {
      await fetch('/api/public/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feedback_details',
          properties: {
            patient_id: patientId,
            reason,
            details: details.trim(),
            source,
          },
        }),
      });
      setDetailsSubmitted(true);
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  }, [details, patientId, reason, source]);

  const reasonLabel = REASON_LABELS[reason] || reason;
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL || 'https://cal.com/kkauf/15min';

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <PageAnalytics qualifier="Feedback-Quick" />
      {/* Thank You Card */}
      <Card className="border-emerald-200/60 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/60 shadow-sm">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
            Danke für dein Feedback
          </CardTitle>
          <CardDescription className="text-base text-gray-600 mt-2">
            Deine Rückmeldung hilft uns, Kaufmann Health zu verbessern.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Reason Badge */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 p-4 border border-slate-200/60">
            <p className="text-sm text-gray-500 mb-1">Deine Antwort:</p>
            <p className="font-medium text-gray-900">{reasonLabel}</p>
          </div>

          {/* Optional Details */}
          {!detailsSubmitted ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                <MessageSquare className="inline h-4 w-4 mr-1.5 text-gray-400" />
                Möchtest du uns mehr mitteilen? (optional)
              </label>
              <Textarea
                placeholder="Was können wir besser machen?"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              {details.trim() && (
                <Button
                  onClick={handleSubmitDetails}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? 'Wird gesendet...' : 'Feedback absenden'}
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-4 border border-emerald-200/60 text-center">
              <p className="text-emerald-700 font-medium">✓ Zusätzliches Feedback gesendet</p>
            </div>
          )}

          {/* Interview CTA */}
          <div className="border-t border-slate-200/60 pt-6">
            <div className="rounded-xl bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-5 border border-indigo-200/50 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200/60 p-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Hast du 15 Minuten für ein kurzes Gespräch?
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Als Dank erhältst du einen <strong className="text-indigo-700">25€ Amazon-Gutschein</strong>.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-medium"
                  >
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        // Track interview interest
                        fetch('/api/public/events', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'interview_interest',
                            properties: {
                              patient_id: patientId,
                              source,
                            },
                          }),
                          keepalive: true,
                        }).catch(() => {});
                      }}
                    >
                      Termin vereinbaren
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Link */}
      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/" className="hover:text-gray-700 underline">
          Zurück zur Startseite
        </Link>
      </p>
    </div>
  );
}

export default function QuickFeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
          <Card className="border-emerald-200/60 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-8 w-48 mx-auto bg-slate-100 rounded animate-pulse" />
            </CardHeader>
          </Card>
        </div>
      }
    >
      <FeedbackContent />
    </Suspense>
  );
}
