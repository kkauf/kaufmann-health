'use client';

import { useCallback, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function ResendConfirmationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/leads/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMessage('E‑Mail versendet. Bitte Posteingang prüfen.');
      } else {
        setMessage('Bitte später erneut versuchen.');
      }
    } catch {
      setMessage('Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-4 grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="email">E‑Mail</Label>
        <Input id="email" name="email" type="email" required placeholder="dein.name@example.com" />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          Bestätigungs‑E‑Mail erneut senden
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">{message}</span>
      </div>
    </form>
  );
}
