'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// Keep in sync with Datenschutz version
const PRIVACY_VERSION = '2025-09-01.v1';

type Props = { leadId: string };

export function PreferencesForm({ leadId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setMessage(null);
    setErrors({});

    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const city = String(data.get('city') || '').trim();
    const issue = String(data.get('issue') || '').trim();
    const sessionPref = String(data.get('session_preference') || '').trim();
    const consent = data.get('consent') === 'on';

    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = 'Bitte geben Sie Ihren Namen an.';
    if (!city) nextErrors.city = 'Bitte geben Sie Ihre Stadt an.';
    if (!consent) nextErrors.consent = 'Bitte stimmen Sie der Weitergabe Ihrer Daten zu.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          city,
          issue: issue || undefined,
          session_preference: sessionPref || undefined,
          consent_share_with_therapists: true,
          privacy_version: PRIVACY_VERSION,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || 'Fehlgeschlagen');
      setSubmitted(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }, [leadId, submitting]);

  const ConsentHint = useMemo(() => (
    <p className="mt-2 text-xs text-gray-600">
      Durch Absenden stimmen Sie der Weitergabe Ihrer Daten an passende Therapeut:innen zu. Details: {' '}
      <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>
    </p>
  ), []);

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Danke! Wir machen uns an die Arbeit</CardTitle>
          <CardDescription>
            Wir prüfen Ihre Angaben und senden Ihnen innerhalb von 24–48 Stunden eine persönliche Auswahl an passenden Therapeut:innen.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/" className="underline text-sm">Zur Startseite</Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="name">Wie dürfen wir Sie ansprechen?</Label>
        <Input id="name" name="name" placeholder="Vorname oder Spitzname" aria-invalid={Boolean(errors.name)} className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="city">Ihre Stadt</Label>
        <Input id="city" name="city" placeholder="z.B. Berlin" aria-invalid={Boolean(errors.city)} className={errors.city ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="issue">Was belastet dich? (optional)</Label>
        <textarea id="issue" name="issue" rows={3} className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 w-full rounded-md border bg-white px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" placeholder="Optional, aber hilft uns bei der Einordnung." />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="session_preference">Bevorzugte Sitzungsform</Label>
        <select id="session_preference" name="session_preference" className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm">
          <option value="">Keine Präferenz</option>
          <option value="online">Online</option>
          <option value="in_person">Vor Ort (Praxis)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input id="consent" name="consent" type="checkbox" />
        <Label htmlFor="consent" className="text-sm">Ich bin einverstanden, dass meine Angaben an passende Therapeut:innen weitergegeben werden.</Label>
      </div>
      {errors.consent && <p className="text-xs text-red-600">{errors.consent}</p>}
      {ConsentHint}

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>{submitting ? 'Speichern…' : 'Weiter'}</Button>
        <Link href="/" className="underline text-sm">Abbrechen</Link>
      </div>
    </form>
  );
}
