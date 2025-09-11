"use client";

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

async function postEvent(type: string, props?: Record<string, unknown>) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, properties: props || {} }),
      keepalive: true,
    });
  } catch {}
}

export function Actions({
  uuid,
  matchId,
  expired: expiredInitial,
  initialStatus,
  initialContact,
}: {
  uuid: string;
  matchId: string;
  expired: boolean;
  initialStatus: string;
  initialContact?: { name?: string | null; email?: string | null; phone?: string | null };
}) {
  const [status, setStatus] = useState(initialStatus);
  const [expired, setExpired] = useState(expiredInitial);
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(
    initialContact || null,
  );

  const isFinal = useMemo(() => status === 'accepted' || status === 'declined', [status]);

  useEffect(() => {
    postEvent(expired ? 'link_expired_view' : 'magic_link_opened', { match_id: matchId, uuid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(action: 'accept' | 'decline') {
    setError(null);
    setLoading(action);
    try {
      const res = await fetch(`/api/match/${encodeURIComponent(uuid)}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.error === 'Link expired') {
          setExpired(true);
          setStatus('proposed');
          return;
        }
        throw new Error(json?.error || 'Fehler');
      }
      const newStatus = String(json?.data?.status || '').toLowerCase();
      if (newStatus === 'accepted' || newStatus === 'declined') {
        setStatus(newStatus);
      }
      // If accepted, try to reveal contact info
      if (newStatus === 'accepted') {
        const revealed = json?.data?.contact;
        if (revealed && (revealed.email || revealed.phone)) {
          setContact(revealed);
        } else {
          // Best-effort: call again idempotently with reveal=1 to fetch contact
          try {
            const res2 = await fetch(`/api/match/${encodeURIComponent(uuid)}/respond?reveal=1`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: 'accept' }),
            });
            if (res2.ok) {
              const j2 = await res2.json();
              const c = j2?.data?.contact;
              if (c && (c.email || c.phone)) setContact(c);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      let msg = 'Etwas ist schief gelaufen';
      if (e instanceof Error) msg = e.message;
      else if (typeof e === 'string') msg = e;
      setError(msg);
    } finally {
      setLoading(null);
    }
  }

  if (expired) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Dieser Link ist abgelaufen. Bitte wenden Sie sich an Kaufmann Health, falls weiterhin Interesse besteht.</p>
      </div>
    );
  }

  if (isFinal) {
    return (
      <div className="space-y-3">
        {status === 'accepted' ? (
          <div className="space-y-2">
            <p className="text-sm">Vielen Dank! Sie haben die Anfrage angenommen.</p>
            {contact ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Kontaktdaten</p>
                {contact.name ? <p>Name: {contact.name}</p> : null}
                {contact.email ? (
                  <p>
                    E-Mail:{' '}
                    <a className="underline" href={`mailto:${contact.email}`}>
                      {contact.email}
                    </a>
                  </p>
                ) : null}
                {contact.phone ? (
                  <p>
                    Telefon:{' '}
                    <a className="underline" href={`tel:${contact.phone}`}>
                      {contact.phone}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Kontaktdaten werden geladen …</p>
            )}
            <p className="text-xs text-muted-foreground">
              Bitte behandeln Sie diese Kontaktdaten vertraulich. Kontaktieren Sie den/die Klient:in idealerweise innerhalb von 48&nbsp;Stunden.
            </p>
          </div>
        ) : (
          <p className="text-sm">Vielen Dank! Sie haben die Anfrage abgelehnt.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <Button onClick={() => respond('accept')} disabled={!!loading}>
          {loading === 'accept' ? 'Bitte warten…' : 'Annehmen'}
        </Button>
        <Button variant="outline" onClick={() => respond('decline')} disabled={!!loading}>
          {loading === 'decline' ? 'Bitte warten…' : 'Ablehnen'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Datenschutz: Wir setzen keine Cookies oder Tracker. Dieser Link läuft aus Sicherheitsgründen nach 72&nbsp;Stunden automatisch ab. Mehr Infos unter{' '}
        <a href="/datenschutz#cookies" className="underline">Datenschutz</a>.
      </p>
    </div>
  );
}

