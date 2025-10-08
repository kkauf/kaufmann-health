'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactModal } from '@/features/therapists/components/ContactModal';
import { Calendar, MessageCircle } from 'lucide-react';

type TherapistItem = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  city?: string | null;
  accepting_new?: boolean | null;
  contacted_at?: string | null;
};

type MatchApiData = {
  patient: { name?: string | null; issue?: string | null; session_preference?: 'online' | 'in_person' | null };
  therapists: TherapistItem[];
};

export function MatchPageClient({ uuid }: { uuid: string }) {
  const [data, setData] = useState<MatchApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalFor, setModalFor] = useState<{ therapist: TherapistItem; type: 'booking' | 'consultation' } | null>(null);

  const initials = (t: TherapistItem) => `${t.first_name?.[0] || ''}${t.last_name?.[0] || ''}`.toUpperCase();
  const avatarColor = (t: TherapistItem) => `hsl(${Math.abs(hashCode(t.id)) % 360}, 70%, 50%)`;
  function hashCode(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }
  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-DE');
    } catch {
      return iso;
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/matches/${encodeURIComponent(uuid)}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error || 'Fehler beim Laden');
          setData(null);
        } else {
          if (!cancelled) setData(json.data as MatchApiData);
        }
      } catch (e) {
        setError('Netzwerkfehler');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  const therapists = useMemo(() => data?.therapists || [], [data]);

  const handleOpen = useCallback((t: TherapistItem, type: 'booking' | 'consultation') => {
    setModalFor({ therapist: t, type });
  }, []);

  const handleSuccess = useCallback(() => {
    // Mark as contacted locally to reflect state
    if (!modalFor) return;
    const tId = modalFor.therapist.id;
    setData((prev) =>
      prev
        ? { ...prev, therapists: prev.therapists.map((t) => (t.id === tId ? { ...t, contacted_at: new Date().toISOString() } : t)) }
        : prev
    );
    setModalFor(null);
  }, [modalFor]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-gray-600">Lade Empfehlungen…</div>
      </div>
    );
  }

  if (error) {
    const expired = error?.toLowerCase().includes('expired');
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{expired ? 'Link abgelaufen' : 'Nicht gefunden'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {expired
                ? 'Dieser Link ist abgelaufen.'
                : 'Dieser Link ist ungültig oder wurde bereits verwendet.'}
            </p>
            <div className="mt-4 flex gap-3">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <a href="/therapie-finden">Neue Empfehlungen anfordern</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/therapeuten">Alle Therapeuten ansehen</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!therapists.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Keine Empfehlungen verfügbar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Keine passende Person? Schau dir unser vollständiges Verzeichnis an.</p>
            <div className="mt-4">
              <Button asChild>
                <a href="/therapeuten">Alle Therapeuten ansehen</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ihre persönlichen Empfehlungen</h1>
        {data?.patient?.issue ? (
          <p className="mt-2 text-gray-600">Basierend auf Ihrem Anliegen: {data.patient.issue}</p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {therapists.map((t, idx) => (
          <Card key={t.id} className="group relative flex h-full flex-col overflow-hidden">
            <CardContent className="flex flex-1 flex-col p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-4">
                <Avatar className="h-20 w-20 ring-2 ring-gray-100">
                  {t.photo_url ? (
                    <AvatarImage src={t.photo_url} alt={`${t.first_name} ${t.last_name}`} />
                  ) : (
                    <AvatarFallback style={{ backgroundColor: avatarColor(t) }} className="text-xl font-semibold text-white">
                      {initials(t)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {t.first_name} {t.last_name}
                    </h3>
                    {idx === 0 ? (
                      <Badge className="bg-amber-100 text-amber-800">Top‑Empfehlung</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{t.city || ''}</div>
                  {t.contacted_at ? (
                    <div className="mt-1 text-xs text-emerald-700">Bereits kontaktiert am {fmtDate(t.contacted_at)}</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-4">
                <Button
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleOpen(t, 'booking')}
                  disabled={t.accepting_new === false}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {t.contacted_at ? 'Erneut senden' : 'Therapeut:in buchen'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-sm"
                  onClick={() => handleOpen(t, 'consultation')}
                  disabled={t.accepting_new === false}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Kostenloses Erstgespräch (15 min)
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contact modal (pre-auth) */}
      {modalFor && (
        <ContactModal
          therapist={{ id: modalFor.therapist.id, first_name: modalFor.therapist.first_name, last_name: modalFor.therapist.last_name, photo_url: modalFor.therapist.photo_url || undefined }}
          contactType={modalFor.type}
          open={!!modalFor}
          onClose={() => setModalFor(null)}
          onSuccess={handleSuccess}
          preAuth={{ uuid, patientName: data?.patient?.name || undefined, defaultReason: data?.patient?.issue || undefined }}
        />
      )}

      <div className="mt-10 flex gap-3">
        <Button variant="outline" asChild>
          <a href="/therapeuten">Alle Therapeuten ansehen</a>
        </Button>
      </div>
    </div>
  );
}
