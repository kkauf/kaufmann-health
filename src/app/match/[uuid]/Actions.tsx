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
  sessionPreference,
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
  sessionPreference?: string;
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
    
    // Determine if online based on sessionPreference
    const isOnline = sessionPreference?.toLowerCase().includes('online') && !sessionPreference?.toLowerCase().includes('vor ort');
    const isInPerson = sessionPreference?.toLowerCase().includes('vor ort') && !sessionPreference?.toLowerCase().includes('online');
    const isBoth = sessionPreference?.toLowerCase().includes('online') && sessionPreference?.toLowerCase().includes('vor ort');
    
    if (contactType === 'booking') {
      body += `Gerne vereinbaren wir einen Termin. Bitte wähle einen der folgenden Zeitslots:\n\n`;
      body += `Option 1: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 2: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 3: [Tag, Datum, Uhrzeit]\n\n`;
      
      if (isOnline) {
        body += `Der Termin findet online statt:\n[Link zum Video-Call / Zoom / Skype]\n\n`;
      } else if (isInPerson) {
        body += `Adresse meiner Praxis:\n[Straße, Hausnummer]\n[PLZ Stadt]\n\n`;
      } else {
        // Both or unknown - show both options
        body += `Adresse meiner Praxis:\n[Straße, Hausnummer]\n[PLZ Stadt]\n\nODER für Online-Termin:\n[Link zum Video-Call / Zoom / Skype]\n\n`;
      }
      
      body += `Bitte bestätige deinen Wunschtermin innerhalb von 48 Stunden. Falls ich nichts von dir höre, gebe ich die Slots wieder frei.\n\n`;
    } else if (contactType === 'consultation') {
      body += `Gerne biete ich dir ein kostenloses 15-Minuten-Erstgespräch an. Bitte wähle einen der folgenden Zeitslots:\n\n`;
      body += `Option 1: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 2: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 3: [Tag, Datum, Uhrzeit]\n\n`;
      
      if (isOnline) {
        body += `Das Gespräch findet online statt:\n[Link zum Video-Call / Zoom / Skype]\n\n`;
      } else if (isInPerson) {
        body += `Das Gespräch findet in meiner Praxis statt:\n[Straße, Hausnummer]\n[PLZ Stadt]\n\n`;
      } else {
        // Both or unknown
        body += `Das Gespräch findet statt:\n[Telefonisch ODER per Video-Call ODER in meiner Praxis]\n\nAdresse (falls vor Ort):\n[Straße, Hausnummer]\n[PLZ Stadt]\n\n`;
      }
      
      body += `Bitte bestätige deinen Wunschtermin innerhalb von 48 Stunden.\n\n`;
    } else {
      body += `Gerne können wir einen Termin vereinbaren. Bitte wähle einen der folgenden Zeitslots:\n\n`;
      body += `Option 1: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 2: [Tag, Datum, Uhrzeit]\n`;
      body += `Option 3: [Tag, Datum, Uhrzeit]\n\n`;
      body += `Bitte bestätige innerhalb von 48 Stunden.\n\n`;
    }
    
    body += `Viele Grüße`;
    if (therapistName) {
      body += `,\n${therapistName}`;
    }
    
    return `mailto:${contact.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  if (isFinal) {
    return (
      <div className="space-y-4">
        {status === 'accepted' ? (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600">
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-emerald-900">Anfrage angenommen!</h3>
                  <p className="text-sm text-emerald-800 mt-1">
                    Nächster Schritt: Kontaktiere {contact?.name || 'den/die Klient:in'} innerhalb von <strong>24 Stunden</strong>
                  </p>
                  {sessionPreference ? (
                    <p className="text-sm text-emerald-700 mt-2 font-medium">
                      📍 {sessionPreference}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {contact ? (
              <div className="space-y-3">
                {/* Primary CTA - Email draft or phone */}
                {contact.email && contactType ? (
                  <Button asChild size="lg" className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30">
                    <a href={generateMailto() || '#'}>
                      E-Mail-Entwurf öffnen →
                    </a>
                  </Button>
                ) : null}
                {contact.phone && !contact.email ? (
                  <div className="space-y-3">
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm">
                      <p className="font-medium text-blue-900">📱 Klient:in bevorzugt Anruf/SMS</p>
                      <p className="text-blue-800 mt-1">
                        Rufe direkt an oder sende eine SMS mit deinen Terminvorschlägen.
                      </p>
                    </div>
                    <Button asChild size="lg" className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700">
                      <a href={`tel:${contact.phone}`}>
                        {contact.phone} anrufen →
                      </a>
                    </Button>
                  </div>
                ) : null}

                {/* Actionable guidance for therapists */}
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
                  <p className="font-semibold text-indigo-900 mb-2">
                    📋 {contact.email ? 'In deiner E-Mail' : 'Bei Kontakt'} bitte angeben:
                  </p>
                  <ul className="space-y-1.5 text-indigo-800">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span><strong>3 Terminoptionen</strong> (Tag, Datum, Uhrzeit)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>
                        {sessionPreference?.toLowerCase().includes('online') && !sessionPreference?.toLowerCase().includes('vor ort') ? (
                          <><strong>Online-Meeting-Link</strong> (Zoom, Skype, etc.)</>
                        ) : sessionPreference?.toLowerCase().includes('vor ort') && !sessionPreference?.toLowerCase().includes('online') ? (
                          <><strong>Praxisadresse</strong> (Straße, PLZ, Stadt)</>
                        ) : (
                          <><strong>Praxisadresse</strong> oder <strong>Online-Meeting-Link</strong></>
                        )}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span><strong>Frist:</strong> Klient:in muss innerhalb von 48h bestätigen</span>
                    </li>
                  </ul>
                  {contact.phone && contact.email ? (
                    <p className="mt-3 pt-3 border-t border-indigo-200 text-indigo-700 text-xs">
                      💡 <strong>Tipp:</strong> Falls keine E-Mail-Antwort kommt, sende eine SMS an {contact.phone}
                    </p>
                  ) : null}
                </div>

                {/* Contact details card (secondary) */}
                <div className="rounded-md border border-gray-200 bg-white p-4 text-sm space-y-2">
                  <p className="font-medium text-gray-900">Kontaktdaten</p>
                  {contact.name ? <p className="text-gray-700">Name: {contact.name}</p> : null}
                  {contact.email ? (
                    <p className="text-gray-700">
                      E-Mail:{' '}
                      <a className="underline text-emerald-600 hover:text-emerald-700" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </p>
                  ) : null}
                  {contact.phone ? (
                    <p className="text-gray-700">
                      Telefon:{' '}
                      <a className="underline text-emerald-600 hover:text-emerald-700" href={`tel:${contact.phone}`}>
                        {contact.phone}
                      </a>
                    </p>
                  ) : null}
                </div>

                {/* Privacy reminder */}
                <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                  <p>
                    🔒 Bitte behandle diese Kontaktdaten vertraulich. Antworte innerhalb von <strong>24 Stunden</strong>, um eine gute Erfahrung für den/die Klient:in sicherzustellen.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Kontaktdaten werden geladen …</p>
            )}
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

