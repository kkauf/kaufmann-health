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
import { isCalBookingEnabled, assertCalFieldsPresent } from '@/lib/cal/booking-url';
import CtaLink from '@/components/CtaLink';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import { getAttribution } from '@/lib/attribution';

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
  schwerpunkte?: string[];
  session_preferences?: string[];
  approach_text?: string;
  gender?: string;
  availability?: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[];
  /** Rich profile data for detail modal (qualification, sections, pricing) */
  metadata?: {
    profile?: {
      qualification?: string;
      approach_text?: string;
      who_comes_to_me?: string;
      session_focus?: string;
      first_session?: string;
      about_me?: string;
      approach_text_sections?: Record<string, string>;
      practice_address?: string;
      pricing?: string;
      languages?: string[];
      years_experience?: number;
    };
    [k: string]: unknown;
  };
  // Cal.com integration fields
  cal_username?: string;
  cal_enabled?: boolean;
  cal_bookings_live?: boolean;
};

type MatchApiData = {
  patient: {
    name?: string | null;
    issue?: string | null;
    session_preference?: 'online' | 'in_person' | null;
    city?: string;
    session_preferences?: ('online' | 'in_person')[];
    specializations?: string[];
    schwerpunkte?: string[];
    gender_preference?: 'male' | 'female' | 'no_preference';
    start_timing?: string;
    modality_matters?: boolean;
    status?: string | null;
    time_slots?: string[];
  };
  therapists: TherapistItem[];
  metadata?: { match_type?: 'exact' | 'partial' | 'none' };
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
  const [modalFor, setModalFor] = useState<{
    therapist: TherapistItem;
    type: 'booking' | 'consultation';
    selectedSlot?: { date_iso: string; time_label: string; format: 'online' | 'in_person' };
  } | null>(null);
  const [detailModalTherapist, setDetailModalTherapist] = useState<TherapistItem | null>(null);
  const [autoOpenedTherapist, setAutoOpenedTherapist] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/public/matches/${encodeURIComponent(uuid)}`);
        const json = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setError(json?.error || 'Fehler beim Laden');
            setData(null);
          }
        } else {
          if (!cancelled) setData(json.data as MatchApiData);
        }
      } catch {
        if (!cancelled) {
          setError('Netzwerkfehler');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  const therapists = useMemo(() => {
    const list = data?.therapists || [];
    // Assert Cal.com fields are present on all therapists (fail loudly if API response is wrong)
    if (process.env.NODE_ENV !== 'production') {
      list.forEach(t => assertCalFieldsPresent(t as Record<string, unknown>, 'MatchPageClient'));
    }
    return list;
  }, [data]);
  const _isVerified = useMemo(() => {
    const s = (data?.patient?.status || '').toLowerCase();
    return s === 'email_confirmed' || s === 'new';
  }, [data?.patient?.status]);
  const matchType = data?.metadata?.match_type || 'exact';

  // Auto-open therapist profile modal when ?therapist=<id> param is present (from rich email)
  useEffect(() => {
    if (!data || autoOpenedTherapist || loading) return;
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    const therapistId = params.get('therapist');
    if (!therapistId) return;

    const therapist = therapists.find(t => t.id === therapistId);
    if (therapist) {
      setDetailModalTherapist(therapist);
      setAutoOpenedTherapist(true);
      
      // Track auto-open event
      try {
        const attrs = getAttribution();
        const payload = {
          type: 'therapist_profile_auto_opened',
          ...attrs,
          properties: { 
            page_path: window.location.pathname,
            therapist_id: therapistId,
            source: params.get('utm_campaign') || 'unknown',
          },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  }, [data, therapists, autoOpenedTherapist, loading]);

  // Compute match quality for each therapist (used for badges and contradiction checks)
  const therapistsWithQuality = useMemo(() => {
    if (!data) return [] as Array<TherapistItem & { matchQuality: ReturnType<typeof computeMismatches> }>;
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

  // Find the SINGLE best therapist to highlight with premium styling
  // Priority: 1) Email link (?therapist=...) - always highlight that one
  //           2) Perfect match with booking slots
  //           3) First perfect match
  const highlightedTherapistId = useMemo(() => {
    // Check for email link - if ?therapist= param present, highlight that therapist
    if (typeof window !== 'undefined') {
      const emailTherapistId = new URLSearchParams(window.location.search).get('therapist');
      if (emailTherapistId && therapistsWithQuality.some(t => t.id === emailTherapistId)) {
        return emailTherapistId;
      }
    }
    
    // Otherwise, find best perfect match
    const perfectMatches = therapistsWithQuality.filter(t => t.matchQuality?.isPerfect === true);
    if (perfectMatches.length === 0) return null;
    if (perfectMatches.length === 1) return perfectMatches[0].id;
    
    // Multiple perfect matches - prefer one with booking slots
    const withSlots = perfectMatches.filter(t => 
      Array.isArray(t.availability) && t.availability.length > 0
    );
    if (withSlots.length > 0) return withSlots[0].id;
    
    // No slots available, return first perfect match
    return perfectMatches[0].id;
  }, [therapistsWithQuality]);
  
  // Track page view - include secure_uuid for linking to match session
  useEffect(() => {
    if (data) {
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = {
          type: 'match_page_view',
          ...attrs,
          properties: { 
            page_path: pagePath, 
            therapist_count: therapists.length,
            secure_uuid: uuid, // For linking to specific match session
          },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  }, [data, therapists.length, uuid]);

  // Track preferences summary shown (non-PII)
  useEffect(() => {
    if (data) {
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const sp = data.patient.session_preferences || (data.patient.session_preference ? [data.patient.session_preference] : []);
        const payload = {
          type: 'match_page_preferences_shown',
          ...attrs,
          properties: {
            page_path: pagePath,
            has_issue: Boolean((data.patient.issue || '').trim()),
            session_online: Array.isArray(sp) && sp.includes('online'),
            session_in_person: Array.isArray(sp) && sp.includes('in_person'),
            urgent: data.patient.start_timing === 'Innerhalb der nächsten Woche',
            modality_matters: Boolean(data.patient.modality_matters),
          },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  }, [data]);

  // Track match quality - separate events for partial vs none
  useEffect(() => {
    if (matchType === 'none') {
      // True "no matches" - zero therapists found
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = {
          type: 'form_no_therapists_found',
          ...attrs,
          properties: { page_path: pagePath, match_type: 'none' },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    } else if (matchType === 'partial') {
      // Partial matches - therapists found but not perfect fit
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = {
          type: 'form_partial_match',
          ...attrs,
          properties: { page_path: pagePath, match_type: 'partial', therapist_count: therapists.length },
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  }, [matchType, therapists.length]);

  const handleOpen = useCallback((t: TherapistItem, type: 'booking' | 'consultation', selectedSlot?: { date_iso: string; time_label: string; format: 'online' | 'in_person' }) => {
    // For Cal.com-enabled therapists, open TherapistDetailModal with booking UI
    // Otherwise, open ContactModal for message-based contact
    if (isCalBookingEnabled(t)) {
      setDetailModalTherapist(t);
    } else {
      setModalFor({ therapist: t, type, selectedSlot });
    }
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
    // Simple spinner - no elaborate animation here
    // The "searching" animation belongs in /fragebogen during form completion, not here
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
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
                <a href="/fragebogen?restart=1">Neue Empfehlungen anfordern</a>
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
    // True "no matches" state - be helpful and offer alternatives
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader>
            <CardTitle className="text-xl">Aktuell keine freien Kapazitäten für deine genauen Kriterien</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Wir haben leider gerade keine Therapeut:innen mit freien Terminen, die alle deine Wünsche erfüllen. Das kann sich aber schnell ändern!
            </p>
            
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-medium text-emerald-800 mb-2">Was du jetzt tun kannst:</p>
              <ul className="space-y-2 text-sm text-emerald-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Schau dir alle Therapeut:innen an – vielleicht passt jemand, den wir nicht automatisch vorgeschlagen haben</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Kontaktiere uns per WhatsApp – wir helfen dir persönlich bei der Suche</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <CtaLink href="/therapeuten" eventType="cta_click" eventId="no-match-browse-all" data-cta="no-match-browse-all">
                  Alle Therapeut:innen ansehen
                </CtaLink>
              </Button>
              <Button variant="outline" asChild>
                <a href="/fragebogen?restart=1">
                  Kriterien anpassen
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <FloatingWhatsApp />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {(() => {
            const name = (data?.patient?.name || '').trim();
            if (!name) return 'Deine passenden Therapeut:innen';
            const first = name.split(/\s+/)[0];
            return `${first}, deine passenden Therapeut:innen`;
          })()}
        </h1>
        <p className="mt-2 text-gray-600">
          Buche jetzt ein kostenloses Online-Kennenlernen (15 min) – unverbindlich und ohne Risiko.
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

              // Display schwerpunkte (focus areas) if patient selected any
              const patientSchwerpunkte = data.patient.schwerpunkte || [];
              if (patientSchwerpunkte.length > 0) {
                // Import getSchwerpunktLabel would create circular dep, use simple mapping
                const schwerpunktLabels: Record<string, string> = {
                  'trauma': 'Trauma / PTBS',
                  'angst': 'Angst / Panik',
                  'depression': 'Depression / Erschöpfung',
                  'selbstwert': 'Selbstwert / Scham',
                  'stress': 'Stress / Burnout',
                  'schmerzen': 'Chronische Schmerzen',
                  'essstoerungen': 'Essstörungen',
                  'sucht': 'Sucht / Abhängigkeit',
                  'schlaf': 'Schlafprobleme',
                  'psychosomatik': 'Psychosomatik',
                  'beziehung': 'Beziehungsprobleme',
                  'familie': 'Paare / Familie',
                  'einsamkeit': 'Einsamkeit',
                  'bindung': 'Bindung / Nähe',
                  'sexualitaet': 'Sexualität / Intimität',
                  'lebenskrisen': 'Lebenskrisen',
                  'trauer': 'Trauer / Verlust',
                  'identitaet': 'Identität / Sinnfindung',
                  'persoenliche-entwicklung': 'Persönliche Entwicklung',
                  'spiritualitaet': 'Spiritualität',
                };
                const labels = patientSchwerpunkte.slice(0, 3).map(id => schwerpunktLabels[id] || id);
                let summary = labels.join(', ');
                if (patientSchwerpunkte.length > 3) summary += ` +${patientSchwerpunkte.length - 3}`;
                chips.push(`Schwerpunkte: ${summary}`);
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

      {/* Trust line - concise */}
      <p className="mb-6 text-sm text-gray-600 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <span>Qualifikationen geprüft · Online-Kennenlernen kostenlos</span>
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Sort so highlighted/recommended therapist appears first */}
        {[...therapistsWithQuality].sort((a, b) => {
          if (a.id === highlightedTherapistId) return -1;
          if (b.id === highlightedTherapistId) return 1;
          return 0;
        }).map((t) => {
          const isHighlighted = t.id === highlightedTherapistId;

          // Convert TherapistItem to TherapistData for the card component
          const therapistData: TherapistData = {
            id: t.id,
            first_name: t.first_name,
            last_name: t.last_name,
            photo_url: t.photo_url || undefined,
            city: t.city || '',
            accepting_new: t.accepting_new ?? true,
            modalities: t.modalities || [],
            schwerpunkte: t.schwerpunkte || [],
            session_preferences: t.session_preferences || [],
            approach_text: t.approach_text || '',
            availability: Array.isArray(t.availability) ? t.availability as { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[] : [],
            metadata: t.metadata,
          };

          return (
            <TherapistCard
              key={t.id}
              therapist={therapistData}
              onViewDetails={() => setDetailModalTherapist(t)}
              patientModalities={data?.patient?.specializations || []}
              showSchwerpunkte={true}
              patientSchwerpunkte={data?.patient?.schwerpunkte || []}
              highlighted={isHighlighted}
              contactedAt={t.contacted_at || null}
              onContactClick={(type) => handleOpen(t, type)}
              patientCity={data?.patient?.city}
            />
          );
        })}
      </div>

      {/* Contact modal (pre-auth) */}
      {modalFor && (
        <ContactModal
          key={modalFor.therapist.id}
          therapist={{
            id: modalFor.therapist.id,
            first_name: modalFor.therapist.first_name,
            last_name: modalFor.therapist.last_name,
            photo_url: modalFor.therapist.photo_url || undefined,
            availability: modalFor.therapist.availability || [],
            accepting_new: true,
          }}
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
          selectedSlot={modalFor.selectedSlot}
          requireVerification={false}
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
          key={detailModalTherapist.id}
          therapist={{
            id: detailModalTherapist.id,
            first_name: detailModalTherapist.first_name,
            last_name: detailModalTherapist.last_name,
            photo_url: detailModalTherapist.photo_url,
            availability: Array.isArray(detailModalTherapist.availability) ? detailModalTherapist.availability as { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[] : [],
            modalities: detailModalTherapist.modalities || [],
            schwerpunkte: detailModalTherapist.schwerpunkte || [],
            session_preferences: detailModalTherapist.session_preferences || [],
            approach_text: detailModalTherapist.approach_text || '',
            accepting_new: detailModalTherapist.accepting_new ?? true,
            city: detailModalTherapist.city || '',
            // Include metadata for rich profile display (qualification, sections, pricing)
            metadata: detailModalTherapist.metadata,
            // Cal.com integration fields for booking UI
            cal_username: detailModalTherapist.cal_username,
            cal_enabled: detailModalTherapist.cal_enabled,
            cal_bookings_live: detailModalTherapist.cal_bookings_live,
          } as TherapistData}
          open={!!detailModalTherapist}
          onClose={() => setDetailModalTherapist(null)}
          onOpenContactModal={(therapistFromProfile: TherapistData, type: 'booking' | 'consultation', selectedSlot?: { date_iso: string; time_label: string; format: 'online' | 'in_person' }) => {
            // Map TherapistData → TherapistItem minimal fields and open ContactModal
            const t: TherapistItem = {
              id: therapistFromProfile.id,
              first_name: therapistFromProfile.first_name,
              last_name: therapistFromProfile.last_name,
              photo_url: therapistFromProfile.photo_url,
              city: therapistFromProfile.city,
              accepting_new: therapistFromProfile.accepting_new,
              modalities: therapistFromProfile.modalities,
              session_preferences: therapistFromProfile.session_preferences,
              approach_text: therapistFromProfile.approach_text,
              availability: Array.isArray(therapistFromProfile.availability) ? therapistFromProfile.availability : [],
            };
            setDetailModalTherapist(null);
            handleOpen(t, type, selectedSlot);
          }}
        />
      )}
    </div>
  );
}
