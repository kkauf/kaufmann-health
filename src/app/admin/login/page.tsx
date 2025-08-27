"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

type LoginResponse = {
  data?: { ok?: boolean; redirect?: string } | null;
  error?: string | null;
  message?: string | null;
};

function AdminLoginInner() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextParam = searchParams.get('next');
  const next = typeof nextParam === 'string' && nextParam.startsWith('/') ? nextParam : '/admin';

  useEffect(() => {
    // Clear error only when the user changes the password after an error.
    // Avoid clearing immediately after submit.
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/login?next=${encodeURIComponent(next)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      let json: LoginResponse | null = null;
      try {
        json = await res.json();
      } catch {
        // ignore parse errors; we'll fallback below
      }
      if (!res.ok) {
        if (res.status === 401) {
          setError('Falsches Passwort');
          return;
        }
        if (res.status === 429) {
          const retry = res.headers.get('Retry-After');
          setError(`Zu viele Versuche. Bitte in ${retry ?? 'einigen'} Sekunden erneut versuchen.`);
          return;
        }
        setError((json && (json.error || json.message)) || 'Login fehlgeschlagen');
        return;
      }
      const redirect = json?.data?.redirect || '/admin';
      window.location.href = redirect;
    } catch {
      setError('Unerwarteter Fehler. Bitte später erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-md p-6">
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">Passwort</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Admin-Passwort"
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert" aria-live="polite">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-6">Lädt…</main>}>
      <AdminLoginInner />
    </Suspense>
  );
}
