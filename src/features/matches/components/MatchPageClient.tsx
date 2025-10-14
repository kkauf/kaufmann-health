'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactModal } from '@/features/therapists/components/ContactModal';
import { TherapistDetailModal } from '@/features/therapists/components/TherapistDetailModal';
import { Calendar, MessageCircle, MapPin, Video, CheckCircle, Sparkles } from 'lucide-react';
import { ModalityLogoStrip } from '@/features/landing/components/ModalityLogoStrip';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { computeMismatches, type PatientMeta } from '@/features/leads/lib/match';

type TherapistItem = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  city?: string | null;
  accepting_new?: boolean | null;
  contacted_at?: string | null;
  modalities?: string[];
  session_preferences?: string[];
  approach_text?: string;
  gender?: string;
};

type MatchApiData = {
  patient: { 
    name?: string | null; 
    issue?: string | null; 
    session_preference?: 'online' | 'in_person' | null;
    city?: string;
    session_preferences?: ('online' | 'in_person')[];
    specializations?: string[];
    gender_preference?: 'male' | 'female' | 'no_preference';
    start_timing?: string;
    modality_matters?: boolean;
  };
  therapists: TherapistItem[];
};

const MODALITY_MAP: Record<string, { label: string; color: string }> = {
  'narm': { label: 'NARM', color: 'bg-teal-700' },
  'somatic-experiencing': { label: 'Somatic Experiencing', color: 'bg-orange-600' },
  'hakomi': { label: 'Hakomi', color: 'bg-emerald-700' },
  'core-energetics': { label: 'Core Energetics', color: 'bg-fuchsia-700' },
};

function normalizeModality(m: string): string {
  return m.toLowerCase().replace(/\s+/g, '-');
}

function getModalityDisplay(m: string): { label: string; color: string } {
  const normalized = normalizeModality(m);
  return MODALITY_MAP[normalized] || { label: m, color: 'bg-slate-700' };
}

export function MatchPageClient({ uuid }: { uuid: string }) {
  const [data, setData] = useState<MatchApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalFor, setModalFor] = useState<{ therapist: TherapistItem; type: 'booking' | 'consultation' } | null>(null);
  const [detailModalTherapist, setDetailModalTherapist] = useState<TherapistItem | null>(null);

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

  // Compute match quality for each therapist
  const therapistsWithQuality = useMemo(() => {
    if (!data) return [];
    const patientMeta: PatientMeta = {
      city: data.patient.city,
      session_preference: data.patient.session_preference || undefined,
      session_preferences: data.patient.session_preferences,
      issue: data.patient.issue || undefined,
      specializations: data.patient.specializations,
      gender_preference: data.patient.gender_preference,
    };
    return therapists.map(t => {
      const result = computeMismatches(patientMeta, {
        id: t.id,
        gender: t.gender || null,
        city: t.city || null,
        session_preferences: t.session_preferences,
        modalities: t.modalities,
      });
      return { ...t, matchQuality: result };
    });
  }, [data, therapists]);

  // Track page view
  useEffect(() => {
    if (data) {
      try {
        const payload = { type: 'match_page_view', properties: { therapist_count: therapists.length } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {}
    }
  }, [data, therapists.length]);

  // Track preferences summary shown (non-PII)
  useEffect(() => {
    if (data) {
      try {
        const sp = data.patient.session_preferences || (data.patient.session_preference ? [data.patient.session_preference] : []);
        const payload = {
          type: 'match_page_preferences_shown',
          properties: {
            has_issue: Boolean((data.patient.issue || '').trim()),
            session_online: Array.isArray(sp) && sp.includes('online'),
            session_in_person: Array.isArray(sp) && sp.includes('in_person'),
            urgent: data.patient.start_timing === 'Innerhalb der nächsten Woche',
            modality_matters: Boolean(data.patient.modality_matters),
          },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {}
    }
  }, [data]);

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
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Deine persönlichen Empfehlungen</h1>
        <p className="mt-2 text-gray-600">
          Katherine und Konstantin haben basierend auf deiner Anfrage {therapistsWithQuality.length} Therapeut:innen für dich ausgewählt.
        </p>
      </div>

      {/* Preferences summary bar */}
      {data && (
        <div className="mb-6 rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
          <div className="flex items-start gap-2 text-sm text-gray-800">
            <span className="inline-flex items-center font-semibold text-gray-900"><Sparkles className="mr-1 h-4 w-4 text-emerald-600" />Basierend auf deinen Antworten:</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(() => {
                const chips: string[] = [];
                const issue = (data.patient.issue || '').trim();
                if (issue) chips.push(issue);
                const sp = data.patient.session_preferences || (data.patient.session_preference ? [data.patient.session_preference] : []);
                if (Array.isArray(sp) && sp.length) {
                  const online = sp.includes('online');
                  const inPerson = sp.includes('in_person');
                  if (online && inPerson) chips.push('Online & Vor Ort');
                  else if (online) chips.push('Online');
                  else if (inPerson) chips.push('Vor Ort');
                }
                const urgent = data.patient.start_timing === 'Innerhalb der nächsten Woche';
                if (urgent) chips.push('Schnelle Verfügbarkeit wichtig');
                return chips.map((c, i) => (
                  <span key={i} className="text-gray-800">{c}{i < chips.length - 1 ? ' •' : ''}</span>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Trust & Quality Box */}
      <div className="mb-8 rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white p-6 shadow-md">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          Warum diese Auswahl?
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span>Wir haben uns deiner Anfrage persönlich angenommen.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span>Auf Basis deiner Präferenzen ausgewählt (z. B. online oder vor Ort).</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span>Wir prüfen die Qualifikationen der Therapeut:innen gründlich.</span>
          </li>
          {data?.patient?.modality_matters && (
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>Spezielle Ausbildungen (NARM, Somatic Experiencing, Hakomi, Core Energetics) sind in den farbigen Abzeichen sichtbar.</span>
            </li>
          )}
        </ul>
        <p className="mt-4 font-semibold text-gray-900">Sie können dieser Auswahl guten Gewissens vertrauen.</p>
      </div>

      {data?.patient?.modality_matters && (
        <div className="mb-8">
          <ModalityLogoStrip />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {therapistsWithQuality.map((t, idx) => {
          const sessionPrefs = t.session_preferences || [];
          const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
          const isTopMatch = idx === 0 || t.matchQuality.isPerfect;
          
          return (
            <Card key={t.id} className="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
              <CardContent className="flex flex-1 flex-col p-4 sm:p-6">
                {/* Header with avatar and name */}
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
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t.first_name} {t.last_name}
                    </h3>

                    {/* Match quality badge */}
                    {isTopMatch && (
                      <Badge className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        {t.matchQuality.isPerfect ? '⭐ Perfekte Übereinstimmung' : 'Top-Empfehlung'}
                      </Badge>
                    )}

                    {/* Availability badge */}
                    {!isTopMatch && (
                      <div className="mt-1">
                        {t.accepting_new ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Verfügbar
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            Keine Kapazität
                          </Badge>
                        )}
                      </div>
                    )}

                    {t.contacted_at && (
                      <div className="mt-1 text-xs text-emerald-700">Bereits kontaktiert am {fmtDate(t.contacted_at)}</div>
                    )}
                  </div>
                </div>

                {/* Modalities (conditional) */}
                {data?.patient?.modality_matters && t.modalities && t.modalities.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {t.modalities.slice(0, 3).map((modality, midx) => {
                      const { label, color } = getModalityDisplay(modality);
                      return (
                        <Badge key={midx} className={`${color} text-white hover:opacity-90`}>
                          {label}
                        </Badge>
                      );
                    })}
                    {t.modalities.length > 3 && (
                      <Badge variant="secondary">+{t.modalities.length - 3}</Badge>
                    )}
                  </div>
                )}

                {/* Location and format info */}
                <div className="mb-4 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{t.city || ''}</span>
                    {offersOnline && (
                      <Badge variant="secondary" className="ml-1 gap-1 bg-sky-50 text-sky-700 hover:bg-sky-100">
                        <Video className="h-3 w-3" />
                        Online
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Approach text preview */}
                {t.approach_text && (
                  <p className="mb-4 line-clamp-3 text-sm text-gray-700">
                    {t.approach_text}
                  </p>
                )}

                {/* Action buttons */}
                <div className="mt-auto flex flex-col gap-2 pt-4">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => setDetailModalTherapist(t)}
                  >
                    Profil ansehen
                  </Button>

                  <Button
                    size="lg"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleOpen(t, 'booking')}
                    disabled={t.accepting_new === false}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {t.contacted_at ? 'Erneut kontaktieren' : 'Therapeut:in buchen'}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full text-sm"
                    onClick={() => handleOpen(t, 'consultation')}
                    disabled={t.accepting_new === false}
                  >
                    <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Kostenloses Erstgespräch (15 min)</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Contact modal (pre-auth) */}
      {modalFor && (
        <ContactModal
          therapist={{ id: modalFor.therapist.id, first_name: modalFor.therapist.first_name, last_name: modalFor.therapist.last_name, photo_url: modalFor.therapist.photo_url || undefined }}
          contactType={modalFor.type}
          open={!!modalFor}
          onClose={() => setModalFor(null)}
          onSuccess={handleSuccess}
          preAuth={{
            uuid,
            patientName: data?.patient?.name || undefined,
            defaultReason: data?.patient?.issue || undefined,
            sessionPreference: data?.patient?.session_preference || undefined,
          }}
        />
      )}

      {/* Footer CTA */}
      <div className="mt-10 rounded-xl border border-gray-200/60 bg-slate-50/60 p-6 text-center">
        <p className="text-sm text-gray-600">Keine passende Person dabei?</p>
        <Button variant="outline" asChild className="mt-3">
          <a href="/therapeuten">Alle Therapeuten ansehen</a>
        </Button>
      </div>

      {/* Detail modal */}
      {detailModalTherapist && (
        <TherapistDetailModal
          therapist={{
            id: detailModalTherapist.id,
            first_name: detailModalTherapist.first_name,
            last_name: detailModalTherapist.last_name,
            photo_url: detailModalTherapist.photo_url,
            modalities: data?.patient?.modality_matters ? (detailModalTherapist.modalities || []) : [],
            session_preferences: detailModalTherapist.session_preferences || [],
            approach_text: detailModalTherapist.approach_text || '',
            accepting_new: detailModalTherapist.accepting_new ?? false,
            city: detailModalTherapist.city || '',
          } as TherapistData}
          open={!!detailModalTherapist}
          onClose={() => setDetailModalTherapist(null)}
        />
      )}
    </div>
  );
}
