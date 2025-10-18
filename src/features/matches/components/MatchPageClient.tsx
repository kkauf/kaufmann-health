'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactModal } from '@/features/therapists/components/ContactModal';
import { TherapistDetailModal } from '@/features/therapists/components/TherapistDetailModal';
import { TherapistCard } from '@/features/therapists/components/TherapistCard';
import { CheckCircle, Sparkles } from 'lucide-react';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { computeMismatches, type PatientMeta } from '@/features/leads/lib/match';
import CtaLink from '@/components/CtaLink';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

const TherapyModalityExplanations = dynamic(() => import('@/components/TherapyModalityExplanations'), {
  ssr: true,
});

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-gray-600">Lade Empfehlungen…</div>
      </div>
    );
  }

  if (error) {
    const expired = error?.toLowerCase().includes('expired');
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
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
                <CtaLink href="/therapeuten" eventType="cta_click" eventId="alle-therapeuten" data-cta="alle-therapeuten">
                  Alle Therapeuten ansehen
                </CtaLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!therapists.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <Card>
          <CardHeader>
            <CardTitle>Keine Empfehlungen verfügbar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Keine passende Person? Schau dir unser vollständiges Verzeichnis an.</p>
            <div className="mt-4">
              <Button asChild>
                <CtaLink href="/therapeuten" eventType="cta_click" eventId="alle-therapeuten" data-cta="alle-therapeuten">
                  Alle Therapeuten ansehen
                </CtaLink>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {(() => {
            const name = (data?.patient?.name || '').trim();
            if (!name) return 'Deine persönlichen Empfehlungen';
            const first = name.split(/\s+/)[0];
            return `${first}, deine persönlichen Empfehlungen`;
          })()}
        </h1>
        <p className="mt-2 text-gray-600">
          Katherine und Konstantin haben basierend auf deiner Anfrage {therapistsWithQuality.length} Therapeut:innen für dich ausgewählt.
        </p>
      </div>

      {/* Preferences summary box */}
      {data && (
        <div className="mb-8 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-md">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            Deine Kriterien
          </h3>
          <div className="flex flex-wrap gap-2 text-sm text-gray-700">
            {(() => {
              const chips: string[] = [];
              const issue = (data.patient.issue || '').trim();
              if (issue) chips.push(issue);

              const sps = (data.patient.session_preferences && Array.isArray(data.patient.session_preferences))
                ? data.patient.session_preferences
                : (data.patient.session_preference ? [data.patient.session_preference] : []);
              const online = sps.includes('online');
              const inPerson = sps.includes('in_person');
              if (online && inPerson) chips.push('Online & Vor Ort');
              else if (online) chips.push('Online');
              else if (inPerson) chips.push('Vor Ort');

              const city = (data.patient.city || '').trim();
              if (city && inPerson) chips.push(city);

              if (data.patient.modality_matters) {
                const rawSpecs = (data.patient.specializations || []) as string[];
                const labels = rawSpecs.map((s) => getModalityDisplay(String(s)).label);
                if (labels.length > 0) {
                  let summary = labels.slice(0, 2).join(', ');
                  if (labels.length > 2) summary += ` +${labels.length - 2}`;
                  chips.push(`Methoden: ${summary}`);
                }
              } else {
                chips.push('Methode: von uns empfohlen');
              }

              const gp = data.patient.gender_preference;
              if (gp === 'male') chips.push('Therapeut:in: männlich');
              else if (gp === 'female') chips.push('Therapeut:in: weiblich');

              const urgent = data.patient.start_timing === 'Innerhalb der nächsten Woche';
              if (urgent) chips.push('Schnelle Verfügbarkeit wichtig');
              else if ((data.patient.start_timing || '').trim()) chips.push(`Start: ${String(data.patient.start_timing)}`);

              return chips.map((c, i) => (
                <span key={i} className="text-gray-800">{c}{i < chips.length - 1 ? ' •' : ''}</span>
              ));
            })()}
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
            <span>Die Auswahl basiert auf deinen individuellen Präferenzen und Bedürfnissen.</span>
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
        <p className="mt-4 font-semibold text-gray-900">Eine Auswahl, der du vertrauen kannst.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {therapistsWithQuality.map((t, idx) => {
          const isTopMatch = idx === 0 || t.matchQuality.isPerfect;

          // Convert TherapistItem to TherapistData for the card component
          const therapistData: TherapistData = {
            id: t.id,
            first_name: t.first_name,
            last_name: t.last_name,
            photo_url: t.photo_url || undefined,
            city: t.city || '',
            accepting_new: t.accepting_new ?? true,
            modalities: t.modalities || [],
            session_preferences: t.session_preferences || [],
            approach_text: t.approach_text || '',
          };

          return (
            <TherapistCard
              key={t.id}
              therapist={therapistData}
              onViewDetails={() => setDetailModalTherapist(t)}
              showModalities={data?.patient?.modality_matters ?? false}
              matchBadge={isTopMatch ? {
                text: t.matchQuality.isPerfect ? '⭐ Perfekte Übereinstimmung' : 'Top-Empfehlung',
                className: 'mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
              } : null}
              contactedAt={t.contacted_at || null}
              onContactClick={(type) => handleOpen(t, type)}
            />
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
          <CtaLink href="/therapeuten" eventType="cta_click" eventId="alle-therapeuten" data-cta="alle-therapeuten">
            Alle Therapeuten ansehen
          </CtaLink>
        </Button>
      </div>

      {/* Modality explanations */}
      {data?.patient?.modality_matters && (
        <TherapyModalityExplanations />
      )}

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

      <FloatingWhatsApp />
    </div>
  );
}
