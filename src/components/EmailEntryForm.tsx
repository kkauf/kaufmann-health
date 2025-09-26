'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { track } from '@vercel/analytics';

// Note: Google Ads conversions are handled at Fragebogen completion (client + server).

export function EmailEntryForm({ defaultSessionPreference }: { defaultSessionPreference?: 'online' | 'in_person' }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
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
      // Persist to wizard localStorage for seamless handoff to /fragebogen
      try {
        const LS_KEY = 'kh_wizard_data';
        const LS_STEP = 'kh_wizard_step';
        const existing = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
        const parsed = existing ? JSON.parse(existing) : {};
        const merged = {
          ...(parsed && typeof parsed === 'object' ? parsed : {}),
          name,
          email,
          consent_share_with_therapists: true,
          ...(defaultSessionPreference ? { session_preference: defaultSessionPreference } : {}),
        } as Record<string, unknown>;
        window.localStorage.setItem(LS_KEY, JSON.stringify(merged));
        window.localStorage.setItem(LS_STEP, '1');
      } catch {}

      // Navigate to the Fragebogen, preserving variant (?v=) if present
      const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
      const v = url?.searchParams.get('v');
      const next = v ? `/fragebogen?v=${encodeURIComponent(v)}` : '/fragebogen';
      try { track('Lead Started'); } catch {}
      if (typeof window !== 'undefined') window.location.assign(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, defaultSessionPreference]);

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

      <p className="mt-2 text-xs text-gray-600">
        Mit dem Absenden bestätigst du die{' '}
        <a href="/datenschutz" className="underline">Datenschutzerklärung</a>{' '}und die{' '}
        <a href="/agb" className="underline">AGB</a> sowie die Weitergabe deiner Angaben an passende Therapeut:innen zur Kontaktaufnahme.
      </p>

      <p className="mt-1 text-xs text-gray-600">
        100% kostenlos & unverbindlich. Deine Daten werden ausschließlich zur Erstellung der Empfehlungen verwendet.
      </p>
    </form>
  );
}
