'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateSessionId } from '@/lib/attribution';
import Link from 'next/link';
import { getEmailError } from '@/lib/validation';
// CTA form for Therapie-Finder landing

export default function TherapieFinderForm() {
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
    const payload = {
      name: form.get('name')?.toString() || undefined,
      email: form.get('email')?.toString() || '',
      phone: form.get('phone')?.toString() || undefined,
      city: form.get('city')?.toString() || undefined,
      session_preference: form.get('session_preference')?.toString() || undefined,
      issue: form.get('issue')?.toString() || undefined,
      // Collect selected modalities as slugs the API expects
      specializations: (form.getAll('specializations') || []).map((v) => String(v)),
      session_id: getOrCreateSessionId(),
    };

    // Client-side validation
    const nextErrors: Record<string, string> = {};
    const email = (payload.email || '').trim();
    const emailErr = getEmailError(payload.email);
    if (emailErr) nextErrors.email = emailErr;
    if (!payload.name) nextErrors.name = 'Bitte geben Sie Ihren Namen ein.';
    if (!payload.city) nextErrors.city = 'Bitte geben Sie Ihre Stadt ein.';
    if (!payload.session_preference) nextErrors.session_preference = 'Bitte wählen Sie die Sitzungsform.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        <Card ref={statusRef} tabIndex={-1} className="max-w-xl scroll-mt-28 mb-6">
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
      <form id="top-form" onSubmit={onSubmit} className="space-y-6 max-w-xl" hidden={submitted}>
      <div>
        <h2 className="text-xl font-semibold">Kostenloses Therapeuten-Verzeichnis</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Spitzname oder Vorname</Label>
        <Input id="name" name="name" placeholder="Wie dürfen wir Sie ansprechen?" aria-invalid={Boolean(errors.name)} className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined} required />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">Ihre Stadt</Label>
        <Input id="city" name="city" placeholder="Ihre Stadt (z.B. Berlin)" aria-invalid={Boolean(errors.city)} className={errors.city ? 'border-red-500 focus-visible:ring-red-500' : undefined} required />
        {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" name="email" type="email" placeholder="E-Mail-Adresse" aria-invalid={Boolean(errors.email)} className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined} required />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer (optional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="Telefonnummer (optional)" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="session_preference">Bevorzugte Sitzungsform</Label>
        <select
          id="session_preference"
          name="session_preference"
          required
          className={
            "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
            (errors.session_preference ? ' border-red-500 focus-visible:ring-red-500' : '')
          }
          defaultValue=""
        >
          <option value="">Bitte auswählen</option>
          <option value="online">Online</option>
          <option value="in_person">Vor Ort (Praxis)</option>
        </select>
        {errors.session_preference && <p className="text-xs text-red-600">{errors.session_preference}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="issue">Was belastet Sie? (optional)</Label>
        <select
          id="issue"
          name="issue"
          className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
          defaultValue=""
        >
          <option value="">Was belastet Sie? (optional)</option>
          <option value="Entwicklungstrauma">Entwicklungstrauma</option>
          <option value="Beziehungsthemen">Beziehungsthemen</option>
          <option value="Angst/Panik">Angst/Panik</option>
          <option value="Depression/Erschöpfung">Depression/Erschöpfung</option>
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </div>

      {/* Modality preferences (optional) */}
      <div className="space-y-2">
        <Label>Bevorzugte Methoden (optional)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="specializations" value="narm" className="h-4 w-4" />
            <span>NARM</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="specializations" value="hakomi" className="h-4 w-4" />
            <span>Hakomi</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="specializations" value="somatic-experiencing" className="h-4 w-4" />
            <span>Somatic Experiencing</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="specializations" value="core-energetics" className="h-4 w-4" />
            <span>Core Energetics</span>
          </label>
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Senden…' : 'Therapeuten in meiner Nähe anzeigen →'}
      </Button>
      <small className="block text-xs text-gray-600">100% kostenlos & unverbindlich für Patienten</small>

      {/* Non-success inline status */}
      {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
    </form>
    </>
  );
}
