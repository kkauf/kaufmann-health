'use client';

import { useCallback, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { track } from '@vercel/analytics';
import { getOrCreateSessionId } from '@/lib/attribution';

// Minimal client-side Google Ads conversion for legacy flow (no email confirmation):
// Fire only when the API indicates requiresConfirmation === false, meaning the lead became active ('new') on initial submit.
function fireGoogleAdsClientConversion(leadId?: string) {
  try {
    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const label = process.env.NEXT_PUBLIC_GAD_CONV_CLIENT;
    if (!adsId || !label) return;
    if (typeof window === 'undefined') return;

    const dedupeKey = leadId ? `ga_conv_client_registration${leadId}` : 'ga_conv_client_registration';
    try {
      if (window.sessionStorage.getItem(dedupeKey) === '1') return;
      if (window.localStorage.getItem(dedupeKey) === '1') return;
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    const sendTo = `${adsId}/${label}`;
    const payload: Record<string, unknown> = { send_to: sendTo, value: 10, currency: 'EUR' };
    if (leadId) payload.transaction_id = leadId;

    if (typeof g === 'function') {
      g('event', 'conversion', payload);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(['event', 'conversion', payload]);
    }

    try {
      window.sessionStorage.setItem(dedupeKey, '1');
      window.localStorage.setItem(dedupeKey, '1');
    } catch {}
  } catch {}
}

export function EmailEntryForm({ defaultSessionPreference }: { defaultSessionPreference?: 'online' | 'in_person' }) {
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
    if (!name) nextErrors.name = 'Bitte gib deinen Namen an.';
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nextErrors.email = 'Bitte gib eine gültige E‑Mail-Adresse ein.';
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
        body: JSON.stringify({
          type: 'patient',
          name,
          email,
          session_id: getOrCreateSessionId(),
          ...(defaultSessionPreference ? { session_preference: defaultSessionPreference } : {}),
        }),
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

      // Fire client-side Google Ads conversion immediately only in legacy flow (no confirmation required)
      try {
        if (json?.data && (json.data as { requiresConfirmation?: boolean }).requiresConfirmation === false) {
          fireGoogleAdsClientConversion(leadId);
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
  }, [submitting, defaultSessionPreference]);

  if (submitted) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Fast geschafft</CardTitle>
          <CardDescription>
            Wir haben dir eine Bestätigungs‑E‑Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet. Bitte bestätige deine E‑Mail‑Adresse, damit wir passende Therapeut:innen‑Empfehlungen für dich finden können.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
            <p className="text-xs text-amber-800">
              Hinweis: Der Link ist 24 Stunden gültig. Prüfe ggf. deinen SPAM‑Ordner.
            </p>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="name">Wie dürfen wir dich ansprechen?</Label>
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
        <Button type="submit" disabled={submitting}>{submitting ? 'Senden…' : 'Passende Therapeut:innen finden'}</Button>
      </div>

      <p className="mt-1 text-xs text-gray-600">
        100% kostenlos & unverbindlich. Deine Daten werden ausschließlich zur Erstellung der Empfehlungen verwendet.
      </p>
    </form>
  );
}
