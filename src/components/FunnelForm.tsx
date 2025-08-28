'use client';

import { useState } from 'react';
import { getOrCreateSessionId } from '@/lib/attribution';

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: LeadForm = {
      name: form.get('name')?.toString() || undefined,
      email: form.get('email')?.toString() || '',
      phone: form.get('phone')?.toString() || undefined,
      notes: form.get('notes')?.toString() || undefined,
      specializations: (form.getAll('specializations') || []).map((v) => String(v)),
    };
    // Attach session for server-side attribution (not stored in DB, used for events)
    type LeadFormWithSession = LeadForm & { session_id?: string };
    const extendedPayload: LeadFormWithSession = { ...payload, session_id: getOrCreateSessionId() };

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
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input name="name" className="mt-1 w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium">E-Mail</label>
        <input name="email" type="email" required className="mt-1 w-full border p-2 rounded" />
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
      {message && <p className="text-sm mt-2">{message}</p>}
    </form>
  );
}
