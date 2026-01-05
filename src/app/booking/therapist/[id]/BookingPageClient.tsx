'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Video,
  User,
  ShieldCheck,
  CalendarCheck2,
  Euro,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';
import { getAttribution } from '@/lib/attribution';
import { formatSessionPrice } from '@/lib/pricing';
import type { CalNormalizedSlot, CalBookingKind } from '@/contracts/cal';

interface BookingPageClientProps {
  therapist: TherapistData;
  bookingKind: CalBookingKind;
  returnTo?: string;
  returnUI?: string;
}

type SlotsByDay = Map<string, CalNormalizedSlot[]>;

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function formatDayLabel(dateIso: string): string {
  const date = new Date(dateIso + 'T00:00:00');
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDayLong(dateIso: string): string {
  const date = new Date(dateIso + 'T00:00:00');
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

const MAX_TIMES_SHOWN = 6;

export function BookingPageClient({
  therapist,
  bookingKind,
  returnTo,
}: BookingPageClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<CalNormalizedSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalNormalizedSlot | null>(null);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [imageError, setImageError] = useState(false);

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];
  const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
  const offersInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');

  const kindLabel = bookingKind === 'intro' ? 'Kostenloses Kennenlernen' : 'Sitzung';
  const kindDuration = bookingKind === 'intro' ? '15 Min.' : '50 Min.';

  // Fetch slots from Cal API proxy
  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      setError(null);

      try {
        // First fetch 7 days
        const today = new Date();
        const start = today.toISOString().split('T')[0];
        const end7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const url = new URL('/api/public/cal/slots', window.location.origin);
        url.searchParams.set('therapist_id', therapist.id);
        url.searchParams.set('kind', bookingKind);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end7);

        const res = await fetch(url.toString());
        const json = await res.json();

        if (json.error) {
          setError(json.error);
          return;
        }

        let fetchedSlots: CalNormalizedSlot[] = json.data?.slots || [];

        // If < 3 slots in 7 days, extend to 14 days
        if (fetchedSlots.length < 3) {
          const end14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          url.searchParams.set('end', end14);
          const res14 = await fetch(url.toString());
          const json14 = await res14.json();

          if (!json14.error && json14.data?.slots) {
            fetchedSlots = json14.data.slots;
          }
        }

        setSlots(fetchedSlots);

        // Track fetch
        try {
          const attrs = getAttribution();
          navigator.sendBeacon?.(
            '/api/events',
            new Blob(
              [
                JSON.stringify({
                  type: 'booking_slots_viewed',
                  ...attrs,
                  properties: {
                    therapist_id: therapist.id,
                    kind: bookingKind,
                    slot_count: fetchedSlots.length,
                  },
                }),
              ],
              { type: 'application/json' }
            )
          );
        } catch {}
      } catch (e) {
        console.error('[BookingPage] Failed to fetch slots:', e);
        setError('Verfügbarkeit konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }

    fetchSlots();
  }, [therapist.id, bookingKind]);

  // Group slots by day
  const slotsByDay = useMemo<SlotsByDay>(() => {
    const map = new Map<string, CalNormalizedSlot[]>();
    for (const slot of slots) {
      const existing = map.get(slot.date_iso) || [];
      existing.push(slot);
      map.set(slot.date_iso, existing);
    }
    return map;
  }, [slots]);

  // Get sorted days
  const sortedDays = useMemo(() => {
    return Array.from(slotsByDay.keys()).sort();
  }, [slotsByDay]);

  // Times for selected day
  const timesForDay = useMemo(() => {
    if (!selectedDay) return [];
    return slotsByDay.get(selectedDay) || [];
  }, [selectedDay, slotsByDay]);

  const visibleTimes = showAllTimes ? timesForDay : timesForDay.slice(0, MAX_TIMES_SHOWN);
  const hasMoreTimes = timesForDay.length > MAX_TIMES_SHOWN;

  // Handle day selection
  const handleDaySelect = useCallback((day: string) => {
    setSelectedDay(day);
    setSelectedSlot(null);
    setShowAllTimes(false);

    try {
      const attrs = getAttribution();
      navigator.sendBeacon?.(
        '/api/events',
        new Blob(
          [
            JSON.stringify({
              type: 'booking_day_selected',
              ...attrs,
              properties: {
                therapist_id: therapist.id,
                kind: bookingKind,
                date_iso: day,
              },
            }),
          ],
          { type: 'application/json' }
        )
      );
    } catch {}
  }, [therapist.id, bookingKind]);

  // Handle time selection
  const handleTimeSelect = useCallback((slot: CalNormalizedSlot) => {
    setSelectedSlot(slot);

    try {
      const attrs = getAttribution();
      navigator.sendBeacon?.(
        '/api/events',
        new Blob(
          [
            JSON.stringify({
              type: 'booking_slot_selected',
              ...attrs,
              properties: {
                therapist_id: therapist.id,
                kind: bookingKind,
                date_iso: slot.date_iso,
                time_label: slot.time_label,
              },
            }),
          ],
          { type: 'application/json' }
        )
      );
    } catch {}
  }, [therapist.id, bookingKind]);

  // Handle booking confirmation (redirect to Cal)
  const handleBooking = useCallback(() => {
    if (!selectedSlot) return;

    const attrs = getAttribution();

    // Track handoff
    try {
      navigator.sendBeacon?.(
        '/api/events',
        new Blob(
          [
            JSON.stringify({
              type: 'cal_handoff_initiated',
              ...attrs,
              properties: {
                therapist_id: therapist.id,
                kind: bookingKind,
                date_iso: selectedSlot.date_iso,
                time_label: selectedSlot.time_label,
              },
            }),
          ],
          { type: 'application/json' }
        )
      );
    } catch {}

    // Build Cal URL with selected date and return-to-origin
    const calUrl = buildCalBookingUrl({
      calUsername: therapist.cal_username!,
      eventType: bookingKind,
      metadata: {
        kh_therapist_id: therapist.id,
        kh_booking_kind: bookingKind,
        kh_source: 'directory',
        kh_gclid: attrs.gclid,
        kh_utm_source: attrs.utm_source,
        kh_utm_medium: attrs.utm_medium,
        kh_utm_campaign: attrs.utm_campaign,
      },
      redirectBack: true,
      returnTo: returnTo || '/therapeuten',
    });

    // Add date param to pre-select in Cal
    const url = new URL(calUrl);
    url.searchParams.set('date', selectedSlot.date_iso);

    // Navigate to Cal
    window.location.href = url.toString();
  }, [selectedSlot, therapist, bookingKind, returnTo]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (returnTo) {
      window.location.href = returnTo;
    } else {
      window.history.back();
    }
  }, [returnTo]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{kindLabel}</h1>
            <p className="text-sm text-gray-500">{kindDuration}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Therapist card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-gray-100 shrink-0">
              {photoSrc ? (
                <AvatarImage
                  src={photoSrc}
                  alt={`${therapist.first_name} ${therapist.last_name}`}
                  onError={() => setImageError(true)}
                />
              ) : (
                <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-xl font-semibold text-white">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {therapist.first_name} {therapist.last_name}
              </h2>

              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                  <ShieldCheck className="h-3 w-3" />
                  Verifiziert
                </Badge>
                <Badge variant="outline" className="gap-1 border-gray-200 bg-gray-50 text-gray-700 text-xs">
                  <MapPin className="h-3 w-3" />
                  {therapist.city}
                </Badge>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {offersOnline && (
                  <Badge variant="outline" className="gap-1 border-sky-200 bg-sky-50 text-sky-700 text-xs">
                    <Video className="h-3 w-3" />
                    Online
                  </Badge>
                )}
                {offersInPerson && (
                  <Badge variant="outline" className="gap-1 border-gray-200 bg-gray-50 text-gray-700 text-xs">
                    <User className="h-3 w-3" />
                    Vor Ort
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Price */}
          {bookingKind === 'full_session' && therapist.typical_rate && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-gray-700">
                <Euro className="h-4 w-4" />
                <span className="font-medium">{formatSessionPrice(therapist.typical_rate)}</span>
              </div>
            </div>
          )}

          {bookingKind === 'intro' && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <CalendarCheck2 className="h-4 w-4" />
                <span className="font-medium">Kostenlos • 15 Minuten</span>
              </div>
            </div>
          )}
        </div>

        {/* Availability picker */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Wähle einen Termin</h3>

          {loading && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-20 rounded-lg shrink-0" />
                ))}
              </div>
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Erneut versuchen
              </Button>
            </div>
          )}

          {!loading && !error && sortedDays.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Aktuell sind keine Termine verfügbar.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Schreibe {therapist.first_name} eine Nachricht für alternative Termine.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = `/therapeuten?therapist=${therapist.id}&contact=consultation`;
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Nachricht schreiben
              </Button>
            </div>
          )}

          {!loading && !error && sortedDays.length > 0 && (
            <>
              {/* Day selector - horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
                {sortedDays.map((day) => {
                  const isSelected = selectedDay === day;
                  const slotCount = slotsByDay.get(day)?.length || 0;

                  return (
                    <button
                      key={day}
                      onClick={() => handleDaySelect(day)}
                      className={`
                        shrink-0 px-4 py-3 rounded-xl border text-center transition-all duration-200
                        ${isSelected
                          ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className={`text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                        {formatDayLabel(day)}
                      </div>
                      <div className={`text-xs mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {slotCount} {slotCount === 1 ? 'Termin' : 'Termine'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Times for selected day */}
              {selectedDay && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 mb-3">
                    Verfügbare Zeiten am {formatDayLong(selectedDay)}:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {visibleTimes.map((slot) => {
                      const isSelected = selectedSlot?.time_utc === slot.time_utc;

                      return (
                        <button
                          key={slot.time_utc}
                          onClick={() => handleTimeSelect(slot)}
                          className={`
                            px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200
                            ${isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                              : 'bg-white border-gray-200 text-gray-900 hover:border-emerald-300 hover:bg-emerald-50'
                            }
                          `}
                        >
                          {slot.time_label}
                        </button>
                      );
                    })}
                  </div>

                  {hasMoreTimes && !showAllTimes && (
                    <button
                      onClick={() => setShowAllTimes(true)}
                      className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      + {timesForDay.length - MAX_TIMES_SHOWN} weitere Zeiten anzeigen
                    </button>
                  )}
                </div>
              )}

              {/* Selected slot summary */}
              {selectedSlot && (
                <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-sm text-emerald-900">
                    <span className="font-medium">Gewählter Termin:</span>{' '}
                    {formatDayLong(selectedSlot.date_iso)} um {selectedSlot.time_label} Uhr
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Sticky footer with CTA */}
      {selectedSlot && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleBooking}
              className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Termin bestätigen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
