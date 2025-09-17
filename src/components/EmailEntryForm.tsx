'use client';

import { useCallback, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { track } from '@vercel/analytics';
import { getOrCreateSessionId } from '@/lib/attribution';

export function EmailEntryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
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
    const email = String(data.get('email') || '').trim().toLowerCase();
    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = 'Bitte geben Sie Ihren Namen an.';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nextErrors.email = 'Bitte geben Sie eine gültige E‑Mail-Adresse ein.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Forward campaign variant v from current URL if present
      const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
      const v = url?.searchParams.get('v');
      const fetchUrl = `/api/leads${v ? `?v=${encodeURIComponent(v)}` : ''}`;

      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'patient', name, email, session_id: getOrCreateSessionId() }),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || 'Fehlgeschlagen');

      const leadId = (json?.data?.id as string | undefined) || undefined;
      try {
        if (leadId && typeof window !== 'undefined') {
          window.localStorage.setItem('leadId', leadId);
          window.localStorage.setItem('leadEmail', email);
        }
      } catch {}

      setSubmitted(true);
      setSubmittedEmail(email);
      try { track('Lead Submitted'); } catch {}
      form.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  if (submitted) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Fast geschafft</CardTitle>
          <CardDescription>
            Wir haben Ihnen eine Bestätigungs‑E‑Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet. Bitte bestätigen Sie Ihre E‑Mail‑Adresse, damit wir passende Therapeut:in‑Empfehlungen für Sie finden können.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <p className="text-xs text-gray-600">Hinweis: Der Link ist 24 Stunden gültig. Prüfen Sie ggf. Ihren SPAM‑Ordner.</p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="name">Wie dürfen wir Sie ansprechen?</Label>
        <Input id="name" name="name" placeholder="Vorname oder Spitzname" aria-invalid={Boolean(errors.name)} className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E‑Mail-Adresse</Label>
        <Input id="email" name="email" type="email" placeholder="dein.name@example.com" aria-invalid={Boolean(errors.email)} className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>{submitting ? 'Senden…' : 'Kostenlose Empfehlung erhalten →'}</Button>
      </div>

      <p className="mt-1 text-xs text-gray-600">
        100% kostenlos & unverbindlich. Ihre Daten werden ausschließlich zur Erstellung der Empfehlungen verwendet.
      </p>
    </form>
  );
}
