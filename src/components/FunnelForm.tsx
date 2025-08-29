'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateSessionId } from '@/lib/attribution';
import Link from 'next/link';
import { getEmailError } from '@/lib/validation';

export type LeadForm = {
  name?: string;
  email: string;
  phone?: string;
  notes?: string;
  // Optional modality preferences; sanitized on server in /api/leads
  specializations?: string[];
};

export default function FunnelForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    const form = new FormData(e.currentTarget);
    const payload: LeadForm = {
      name: form.get('name')?.toString() || undefined,
      email: form.get('email')?.toString() || '',
      phone: form.get('phone')?.toString() || undefined,
      notes: form.get('notes')?.toString() || undefined,
      // Optional modality preferences; sanitized on server in /api/leads
      specializations: (form.getAll('specializations') || []).map((v) => String(v)),
    };
    // Attach session for server-side attribution (not stored in DB, used for events)
    type LeadFormWithSession = LeadForm & { session_id?: string };
    const extendedPayload: LeadFormWithSession = { ...payload, session_id: getOrCreateSessionId() };

    // Minimal client validation: email required + format
    const emailErr = getEmailError(payload.email);
    if (emailErr) {
      setErrors({ email: emailErr });
      return;
    }
    const email = (payload.email || '').trim();

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extendedPayload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setSubmitted(true);
      setSubmittedEmail(email);
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      const map: Record<string, string> = {
        'Invalid email': 'Bitte geben Sie eine gültige E‑Mail-Adresse ein.',
        'Rate limited': 'Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.',
        'Failed to save lead': 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        'Invalid JSON': 'Ungültige Eingabe. Bitte Formular prüfen.',
      };
      if (map[msg]) {
        const friendly = map[msg];
        if (friendly.includes('E‑Mail-Adresse')) {
          setErrors({ email: friendly });
          setMessage(null);
        } else {
          setMessage(friendly);
        }
      } else {
        setMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {submitted && (
        <Card ref={statusRef} tabIndex={-1} className="max-w-md scroll-mt-28 mb-6">
          <CardHeader>
            <CardTitle>Anfrage erfolgreich</CardTitle>
            <CardDescription>Wir haben Ihre Anfrage erhalten.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Wir haben Ihnen eine Bestätigungs-E‑Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet. Bitte prüfen Sie auch Ihren SPAM‑Ordner, sollten Sie die E‑Mail nicht erhalten haben.
            </p>
            <p className="text-sm mt-3">
              Falls Ihre E‑Mail-Adresse falsch ist, schreiben Sie uns direkt: <a className="underline" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/" className="underline text-sm">Zur Startseite</Link>
          </CardFooter>
        </Card>
      )}
      <form onSubmit={onSubmit} className="space-y-4 max-w-md" hidden={submitted}>
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input name="name" className="mt-1 w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium">E-Mail</label>
        <input name="email" type="email" required aria-invalid={Boolean(errors.email)}
               className={`mt-1 w-full border p-2 rounded ${errors.email ? 'border-red-500 ring-1 ring-red-500' : ''}`} />
        {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium">Telefon</label>
        <input name="phone" className="mt-1 w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium">Notizen</label>
        <textarea name="notes" rows={4} className="mt-1 w-full border p-2 rounded" />
      </div>
      {/* Modality preferences (optional) */}
      <div>
        <span className="block text-sm font-medium">Bevorzugte Methoden (optional)</span>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="specializations" value="narm" className="h-4 w-4" />
            <span>NARM</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="specializations" value="hakomi" className="h-4 w-4" />
            <span>Hakomi</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="specializations" value="somatic-experiencing" className="h-4 w-4" />
            <span>Somatic Experiencing</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="specializations" value="core-energetics" className="h-4 w-4" />
            <span>Core Energetics</span>
          </label>
        </div>
      </div>
      <button type="submit" disabled={loading} className="bg-black text-white px-4 py-2 rounded">
        {loading ? 'Senden…' : 'Anfrage senden'}
      </button>
      {/* Non-success inline status */}
      {!submitted && message && <p className="text-sm mt-2 text-red-600">{message}</p>}
    </form>
    </>
  );
}
