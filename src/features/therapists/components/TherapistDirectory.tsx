'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X, ShieldCheck } from 'lucide-react';
import { TherapistCard } from './TherapistCard';
import { getAttribution } from '@/lib/attribution';
import { TherapistDetailModal } from './TherapistDetailModal';
import { ContactModal } from './ContactModal';

export type TherapistData = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  modalities: string[];
  session_preferences?: string[];
  approach_text: string;
  accepting_new: boolean;
  city: string;
  metadata?: {
    profile?: {
      approach_text?: string;
      languages?: string[];
      years_experience?: number;
    };
  };
};

export function TherapistDirectory() {
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModality, setSelectedModality] = useState<string>('all');
  const [onlineOnly, setOnlineOnly] = useState<boolean | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistData | null>(null);
  // Pagination: show first 5, reveal more on demand
  const [visibleCount, setVisibleCount] = useState<number>(5);
  // Auto contact (EARTH-204): when returning from email magic link with redirect
  const [autoContactTherapist, setAutoContactTherapist] = useState<TherapistData | null>(null);
  const [autoContactOpen, setAutoContactOpen] = useState(false);
  const [autoContactType, setAutoContactType] = useState<'booking' | 'consultation'>('booking');
  
  // Mobile filter sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftModality, setDraftModality] = useState<string>('all');
  const [draftOnlineOnly, setDraftOnlineOnly] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchTherapists() {
      try {
        setLoading(true);
        const res = await fetch('/api/public/therapists');
        if (!res.ok) throw new Error('Failed to fetch therapists');
        const data = await res.json();
        const therapistList = data.therapists || [];
        console.log('Fetched therapists:', therapistList);
        console.log('Sample metadata:', therapistList[0]?.metadata);
        setTherapists(therapistList);
      } catch (err) {
        console.error('Error fetching therapists:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTherapists();
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const raw = (url.searchParams.get('format') || '').toLowerCase();
      if (raw === 'online') setOnlineOnly(true);
      else if (raw === 'inperson' || raw === 'in-person' || raw === 'vor-ort' || raw === 'vorort') setOnlineOnly(false);
      else if (raw === 'unsure' || raw === 'all' || raw === 'alle') setOnlineOnly(null);
    } catch {
      // ignore
    }
  }, []);

  // When therapists are loaded, check query params and auto-open the ContactModal in compose step.
  // We rely on EARTH-204 cookie to treat the user as verified when returning via magic link.
  useEffect(() => {
    if (loading) return;
    try {
      const url = new URL(window.location.href);
      const contact = url.searchParams.get('contact');
      const tid = url.searchParams.get('tid');
      const t = (url.searchParams.get('type') || 'booking').toLowerCase();
      const type = t === 'consultation' ? 'consultation' : 'booking';
      if (contact === 'compose' && tid) {
        const th = therapists.find(x => x.id === tid) || null;
        if (th) {
          setAutoContactTherapist(th);
          setAutoContactType(type);
          setAutoContactOpen(true);
        }
        // Clean the URL so we don't reopen on navigation
        url.searchParams.delete('contact');
        url.searchParams.delete('tid');
        url.searchParams.delete('type');
        const cleaned = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
        window.history.replaceState({}, '', cleaned);
      }
    } catch {
      // ignore
    }
  }, [loading, therapists]);

  const normalizeModality = (m: string): string => {
    return m.toLowerCase().replace(/\s+/g, '-');
  };

  const getModalityLabel = (m: string): string => {
    const map: Record<string, string> = {
      'narm': 'NARM',
      'somatic-experiencing': 'Somatic Experiencing',
      'hakomi': 'Hakomi',
      'core-energetics': 'Core Energetics',
    };
    const normalized = normalizeModality(m);
    return map[normalized] || m;
  };

  const allModalities = useMemo(() => {
    const modalitySet = new Set<string>();
    therapists.forEach(t => {
      t.modalities?.forEach(m => modalitySet.add(m));
    });
    return Array.from(modalitySet).sort();
  }, [therapists]);

  const filteredTherapists = useMemo(() => {
    const filtered = therapists.filter(t => {
      // Filter by modality
      if (selectedModality !== 'all' && !t.modalities?.includes(selectedModality)) {
        return false;
      }

      // Filter by online availability (strict)
      if (onlineOnly !== null) {
        const raw = Array.isArray(t.session_preferences) ? (t.session_preferences as string[]) : [];
        const normalized = new Set(
          raw.map(v => String(v).toLowerCase().replace(/[\s-]+/g, '_'))
        );
        const hasEither = normalized.has('either') || normalized.has('both');
        const hasOnline = normalized.has('online') || hasEither;
        const hasInPerson = normalized.has('in_person') || normalized.has('inperson') || hasEither;
        if (onlineOnly && !hasOnline) return false;
        if (!onlineOnly && !hasInPerson) return false;
      }

      return true;
    });

    // Sort: therapists with photos first, then without photos
    return filtered.sort((a, b) => {
      const aHasPhoto = !!a.photo_url;
      const bHasPhoto = !!b.photo_url;

      if (aHasPhoto && !bHasPhoto) return -1;
      if (!aHasPhoto && bHasPhoto) return 1;
      return 0;
    });
  }, [therapists, selectedModality, onlineOnly]);

  const visibleTherapists = useMemo(() => filteredTherapists.slice(0, Math.max(0, visibleCount)), [filteredTherapists, visibleCount]);
  const hasMore = filteredTherapists.length > visibleCount;

  const handleLoadMore = () => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'directory_load_more_clicked', ...attrs, properties: { page_path: pagePath, total: filteredTherapists.length, visible_before: visibleCount } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {}
    // Reveal all remaining in one step (simple behavior for now)
    setVisibleCount(filteredTherapists.length);
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedModality !== 'all') count++;
    if (onlineOnly !== null) count++;
    return count;
  }, [selectedModality, onlineOnly]);

  // Sheet handlers
  const handleOpenSheet = () => {
    setDraftModality(selectedModality);
    setDraftOnlineOnly(onlineOnly);
    setSheetOpen(true);
  };

  const handleApplyFilters = () => {
    setSelectedModality(draftModality);
    setOnlineOnly(draftOnlineOnly);
    setSheetOpen(false);
  };

  const handleResetFilters = () => {
    setDraftModality('all');
    setDraftOnlineOnly(null);
    setSelectedModality('all');
    setOnlineOnly(null);
    setSheetOpen(false);
  };

  const handleClearAllFilters = () => {
    setSelectedModality('all');
    setOnlineOnly(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Lade Therapeuten...</div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Compact filter button */}
      <div className="mb-4 md:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleOpenSheet}
            className="flex-1 justify-between h-11"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
            </span>
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearAllFilters}
              aria-label="Alle Filter löschen"
              className="h-11 w-11"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Desktop: Inline filters (sticky) */}
      <div className="mb-8 hidden md:flex flex-col gap-4 md:flex-row md:items-center md:gap-6 md:sticky md:top-0 md:z-20 md:bg-white/95 md:backdrop-blur supports-[backdrop-filter]:md:bg-white/70 md:py-3 md:border-b">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Modalität
          </label>
          <Select value={selectedModality} onValueChange={setSelectedModality}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Alle Modalitäten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Modalitäten</SelectItem>
              {allModalities.map(m => (
                <SelectItem key={m} value={m}>
                  {getModalityLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Therapieformat
          </label>
          <div className="flex gap-2">
            <Button
              variant={onlineOnly === null ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(null)}
              className="flex-1"
            >
              Alle
            </Button>
            <Button
              variant={onlineOnly === true ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(true)}
              className="flex-1"
            >
              Online
            </Button>
            <Button
              variant={onlineOnly === false ? 'default' : 'outline'}
              onClick={() => setOnlineOnly(false)}
              className="flex-1"
            >
              Vor Ort
            </Button>
          </div>
        </div>
      </div>

      {/* Results header: count + compact trust note */}
      <div className="mb-4 flex flex-col items-start justify-between gap-2 text-sm text-gray-700 sm:flex-row sm:items-center">
        <div>
          {filteredTherapists.length} {filteredTherapists.length === 1 ? 'Therapeut:in' : 'Therapeut:innen'} gefunden
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          <span className="leading-none">Alle Profile verifiziert</span>
          <span className="sr-only">– Qualifikation & Lizenzen geprüft</span>
        </div>
      </div>

      {/* Therapist grid */}
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {visibleTherapists.map(therapist => (
          <TherapistCard
            key={therapist.id}
            therapist={therapist}
            onViewDetails={() => setSelectedTherapist(therapist)}
          />
        ))}
        {/* Desktop/Tablet: Load more tile occupies a grid cell */}
        {hasMore && (
          <Card className="hidden md:flex h-full items-center justify-center border-dashed">
            <CardContent className="flex w-full items-center justify-center p-6">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base font-semibold" onClick={handleLoadMore}>
                Mehr anzeigen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile: compact load more below grid (smaller than a full card) */}
      {hasMore && (
        <div className="mt-4 md:hidden">
          <Button variant="outline" className="w-full h-10 text-sm" onClick={handleLoadMore}>
            Mehr anzeigen
          </Button>
        </div>
      )}

      {filteredTherapists.length === 0 && (
        <div className="py-12 text-center text-gray-600">
          Keine Therapeut:innen gefunden. Bitte passe deine Filter an.
        </div>
      )}

      {/* Detail modal */}
      {selectedTherapist && (
        <TherapistDetailModal
          therapist={selectedTherapist}
          open={!!selectedTherapist}
          onClose={() => setSelectedTherapist(null)}
        />
      )}

      {/* Auto-open ContactModal when returning from magic link (verified state handled by EARTH-204 cookie). */}
      {autoContactTherapist && (
        <ContactModal
          therapist={autoContactTherapist}
          contactType={autoContactType}
          open={autoContactOpen}
          onClose={() => setAutoContactOpen(false)}
          verified={true}
        />
      )}

      {/* Mobile filter sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] p-0">
          <div className="flex flex-col h-full max-h-[85vh]">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle>Filter</SheetTitle>
              <SheetDescription>
                Finde die passende Therapeut:in
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {/* Modality filter */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-gray-900">
                  Modalität
                </label>
                <Select value={draftModality} onValueChange={setDraftModality}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Alle Modalitäten" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Modalitäten</SelectItem>
                    {allModalities.map(m => (
                      <SelectItem key={m} value={m}>
                        {getModalityLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format filter */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-gray-900">
                  Therapieformat
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={draftOnlineOnly === null ? 'default' : 'outline'}
                    onClick={() => setDraftOnlineOnly(null)}
                    className="h-12"
                  >
                    Alle
                  </Button>
                  <Button
                    variant={draftOnlineOnly === true ? 'default' : 'outline'}
                    onClick={() => setDraftOnlineOnly(true)}
                    className="h-12"
                  >
                    Online
                  </Button>
                  <Button
                    variant={draftOnlineOnly === false ? 'default' : 'outline'}
                    onClick={() => setDraftOnlineOnly(false)}
                    className="h-12"
                  >
                    Vor Ort
                  </Button>
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row gap-2 px-4 pb-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="flex-1 h-12"
              >
                Zurücksetzen
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex-1 h-12"
              >
                Anwenden
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
