'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// CTA form for Therapie-Finder landing

export default function TherapieFinderForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get('name')?.toString() || undefined,
      email: form.get('email')?.toString() || '',
      phone: form.get('phone')?.toString() || undefined,
      city: form.get('city')?.toString() || undefined,
      issue: form.get('issue')?.toString() || undefined,
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
      setMessage('Danke! Wir melden uns bald.');
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form id="top-form" onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-semibold">Kostenloses Therapeuten-Verzeichnis</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">Ihre Stadt</Label>
        <Input id="city" name="city" placeholder="Ihre Stadt (z.B. Berlin)" required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" name="email" type="email" placeholder="E-Mail-Adresse" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input id="phone" name="phone" type="tel" placeholder="Telefonnummer" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="issue">Was belastet Sie? (optional)</Label>
        <select
          id="issue"
          name="issue"
          className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
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

      <Button type="submit" disabled={loading}>
        {loading ? 'Senden…' : 'Therapeuten in meiner Nähe anzeigen →'}
      </Button>
      <small className="block text-xs text-gray-600">100% kostenlos & unverbindlich für Patienten</small>

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </form>
  );
}
