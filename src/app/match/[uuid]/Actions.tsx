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
  contactType,
  patientName,
  patientReason,
  contactMethod,
  therapistName,
}: {
  uuid: string;
  matchId: string;
  expired: boolean;
  initialStatus: string;
  initialContact?: { name?: string | null; email?: string | null; phone?: string | null };
  contactType?: 'booking' | 'consultation';
  patientName?: string;
  patientReason?: string;
  contactMethod?: 'email' | 'phone';
  therapistName?: string;
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
        <p className="text-sm text-muted-foreground">Dieser Link ist abgelaufen. Bitte wende dich an Kaufmann Health, falls weiterhin Interesse besteht.</p>
      </div>
    );
  }

  // EARTH-205: Generate mailto link for accepted contact requests
  const generateMailto = () => {
    if (!contact?.email) return null;
    
    const subject = encodeURIComponent('Re: Ihre Anfrage bei Kaufmann Health');
    const name = contact.name || patientName || 'dort';
    const firstName = name.split(' ')[0] || name;
    
    let body = `Guten Tag ${firstName},\n\nvielen Dank für deine Nachricht über Kaufmann Health.\n\n`;
    
    if (contactType === 'booking') {
      body += `Gerne können wir einen Termin vereinbaren. Wann passt es dir am besten?\n\n`;
      body += `[Ihre Praxis-Adresse hier einfügen]\n\n`;
    } else if (contactType === 'consultation') {
      body += `Gerne können wir einen Termin vereinbaren. Wann passt es dir am besten?\n\n`;
      body += `Das kostenlose Erstgespräch dauert 15 Minuten und dient zum gegenseitigen Kennenlernen.\n\n`;
    } else {
      body += `Gerne können wir einen Termin vereinbaren. Wann passt es dir am besten?\n\n`;
    }
    
    body += `Viele Grüße`;
    if (therapistName) {
      body += `,\n${therapistName}`;
    }
    
    return `mailto:${contact.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  if (isFinal) {
    return (
      <div className="space-y-3">
        {status === 'accepted' ? (
          <div className="space-y-2">
            <p className="text-sm">Vielen Dank! Du hast die Anfrage angenommen.</p>
            {contact ? (
              <div className="space-y-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">Kontaktdaten</p>
                  {contact.name ? <p>Name: {contact.name}</p> : null}
                  {contact.email ? (
                    <p>
                      E-Mail{' '}
                      <a className="underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </p>
                  ) : null}
                  {contact.phone ? (
                    <p>
                      Telefon{' '}
                      <a className="underline" href={`tel:${contact.phone}`}>
                        {contact.phone}
                      </a>
                    </p>
                  ) : null}
                </div>
                {/* EARTH-205: Mailto button for patient-initiated contacts */}
                {contact.email && contactType ? (
                  <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <a href={generateMailto() || '#'}>
                      E-Mail-Entwurf öffnen
                    </a>
                  </Button>
                ) : null}
                {contact.phone && !contact.email ? (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
                    <p className="font-medium text-amber-900">Patient bevorzugt SMS/Anruf</p>
                    <p className="text-amber-700 mt-1">
                      Bitte kontaktiere den/die Klient:in direkt unter der angegebenen Telefonnummer.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Kontaktdaten werden geladen …</p>
            )}
            <p className="text-xs text-muted-foreground">
              Bitte behandle diese Kontaktdaten vertraulich. Kontaktiere den/die Klient:in idealerweise innerhalb von 48&nbsp;Stunden.
            </p>
          </div>
        ) : (
          <p className="text-sm">Vielen Dank! Du hast die Anfrage abgelehnt.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Button 
          onClick={() => respond('accept')} 
          disabled={!!loading}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {loading === 'accept' ? 'Bitte warten…' : (contactType ? 'Annehmen und antworten' : 'Annehmen')}
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

