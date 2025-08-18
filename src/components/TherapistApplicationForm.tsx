'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TherapistApplicationForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = new FormData(e.currentTarget);
    // Honeypot field: if filled, silently accept and bail
    const honeypot = form.get('company')?.toString() || '';
    if (honeypot) {
      setMessage('Danke! Wir melden uns zeitnah.');
      return;
    }

    // Client-side validation (German messages)
    const email = form.get('email')?.toString().trim() || '';
    if (!email) {
      setMessage('Bitte geben Sie Ihre E‑Mail-Adresse ein.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMessage('Bitte geben Sie eine gültige E‑Mail-Adresse ein.');
      return;
    }
    const qualification = form.get('qualification')?.toString() || '';
    if (!qualification) {
      setMessage('Bitte wählen Sie Ihre Qualifikation.');
      return;
    }
    const experience = form.get('experience')?.toString() || '';
    if (!experience) {
      setMessage('Bitte wählen Sie Ihre Berufserfahrung.');
      return;
    }

    // Normalize website: auto-prefix https:// if missing
    let website = form.get('website')?.toString().trim();
    if (website) {
      // Treat bare protocol as empty
      if (/^https?:\/\/$/i.test(website)) {
        website = '';
      } else if (!/^https?:\/\//i.test(website)) {
        website = `https://${website}`;
      }
    }

    const specializations = form.getAll('specializations').map((v) => v.toString());
    const payload = {
      type: 'therapist' as const,
      name: form.get('name')?.toString() || undefined,
      email,
      phone: form.get('phone')?.toString() || undefined,
      city: form.get('city')?.toString() || undefined,
      qualification,
      experience,
      website: website || undefined,
      notes: form.get('notes')?.toString() || undefined,
      specializations: specializations.length ? specializations : undefined,
    };

    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Request failed');

      // Lightweight conversion tracking
      try {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'therapist_apply_submitted', id: 'fuer-therapeuten-form-submit' }),
          keepalive: true,
        });
      } catch {}

      setMessage('Danke! Wir melden uns zeitnah.');
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      const map: Record<string, string> = {
        'Invalid email': 'Bitte geben Sie eine gültige E‑Mail-Adresse ein.',
        'Rate limited': 'Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.',
        'Failed to save lead': 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        'Invalid JSON': 'Ungültige Eingabe. Bitte Formular prüfen.',
      };
      if (map[msg]) msg = map[msg];
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form id="apply-form" onSubmit={onSubmit} noValidate className="space-y-6 max-w-2xl scroll-mt-28">
      <div>
        <h3 className="text-xl font-semibold">Aufnahme-Anfrage</h3>
        <p className="mt-1 text-sm text-gray-600">Unverbindlich und kostenfrei. Wir prüfen, ob Sie in unser Verzeichnis passen.</p>
      </div>

      {/* Honeypot field (leave empty) */}
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="company">Firma</Label>
        <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Ihr Name</Label>
        <Input id="name" name="name" placeholder="Vor- und Nachname" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" name="email" type="email" placeholder="E-Mail-Adresse" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input id="phone" name="phone" type="tel" placeholder="Telefonnummer" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Ihre Stadt</Label>
          <Input id="city" name="city" placeholder="z.B. Berlin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Webseite (optional)</Label>
          <Input id="website" name="website" type="text" defaultValue="https://" />
          <p className="text-xs text-gray-500">Geben Sie nur die Adresse ein, z. B. „www.beispiel.de“. „https://“ fügen wir automatisch hinzu.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="qualification">Qualifikation</Label>
          <select
            id="qualification"
            name="qualification"
            defaultValue=""
            className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="Heilpraktiker für Psychotherapie">Heilpraktiker für Psychotherapie</option>
            <option value="Approbierter Psychotherapeut">Approbierter Psychotherapeut</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="experience">Berufserfahrung</Label>
          <select
            id="experience"
            name="experience"
            defaultValue=""
            className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="< 2 Jahre">Weniger als 2 Jahre</option>
            <option value="2-4 Jahre">2–4 Jahre</option>
            <option value="> 4 Jahre">Mehr als 4 Jahre</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Schwerpunkte (optional)</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="specializations" value="narm" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            NARM
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="specializations" value="hakomi" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Hakomi
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="specializations" value="somatic-experiencing" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Somatic Experiencing
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="specializations" value="core-energetics" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Core Energetics
          </label>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">Bemerkungen (optional)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Kurze Notiz (z.B. Spezialisierung, Verfügbarkeit)"
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Senden…' : 'Anfrage senden'}
      </Button>
      <small className="block text-xs text-gray-600">Erfolgsbasierte Konditionen. Keine Mindestlaufzeit.</small>

      <div aria-live="polite" role="status">
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>
    </form>
  );
}
