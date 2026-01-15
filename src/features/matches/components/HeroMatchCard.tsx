'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, User, ShieldCheck, Globe, Clock, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { getModalityInfo } from '@/lib/modalities';
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from '@/lib/schwerpunkte';
import { isCalBookingAvailable } from '@/lib/cal/booking-availability';
import { useCalBooking, groupSlotsByDay } from '@/features/therapists/hooks/useCalBooking';
import { Skeleton } from '@/components/ui/skeleton';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import type { CalNormalizedSlot } from '@/contracts/cal';

interface HeroMatchCardProps {
  therapist: TherapistData;
  patientModalities?: string[];
  patientSchwerpunkte?: string[];
  patientCity?: string;
  onBookIntro: () => void;
  onViewProfile: () => void;
  requiresIntroBeforeBooking?: boolean;
  hasCompletedIntro?: boolean;
}

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

export function HeroMatchCard({
  therapist,
  patientModalities = [],
  patientSchwerpunkte = [],
  patientCity,
  onBookIntro,
  onViewProfile,
  requiresIntroBeforeBooking = false,
  hasCompletedIntro = false,
}: HeroMatchCardProps) {
  const [imageError, setImageError] = useState(false);
  const [weekIndex, setWeekIndex] = useState(0);

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const isCalLive = isCalBookingAvailable(therapist);

  // Cal.com slots for embedded calendar
  const [calState] = useCalBooking({
    therapistId: therapist.id,
    calUsername: therapist.cal_username || '',
    bookingKind: 'intro',
    enabled: isCalLive,
  });

  // Convert Map to array for easier rendering
  type DayGroup = { dateIso: string; slots: CalNormalizedSlot[] };
  const slotsByDay = useMemo((): DayGroup[] => {
    if (!calState.slots || calState.slots.length === 0) return [];
    const map = groupSlotsByDay(calState.slots);
    const result: DayGroup[] = [];
    map.forEach((slots, dateIso) => {
      result.push({ dateIso, slots });
    });
    // Sort by date
    result.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    return result;
  }, [calState.slots]);

  // Show 3 days at a time
  const DAYS_PER_VIEW = 3;
  const days = slotsByDay as DayGroup[];
  const visibleDays = days.slice(weekIndex * DAYS_PER_VIEW, (weekIndex + 1) * DAYS_PER_VIEW);
  const hasMoreDays = days.length > (weekIndex + 1) * DAYS_PER_VIEW;
  const hasPrevDays = weekIndex > 0;

  // Format preferences badges
  const { offersOnline, offersInPerson } = useMemo(() => {
    const availability = therapist.availability || [];
    const hasSlots = Array.isArray(availability) && availability.length > 0;
    const cityMatches = !patientCity || 
      (therapist.city && patientCity.toLowerCase().trim() === therapist.city.toLowerCase().trim());

    if (hasSlots) {
      const hasOnlineSlots = availability.some(s => s.format === 'online');
      const hasInPersonSlots = availability.some(s => s.format === 'in_person');
      return {
        offersOnline: hasOnlineSlots,
        offersInPerson: hasInPersonSlots && cityMatches,
      };
    }

    const sessionPrefs = therapist.session_preferences || [];
    const normalizedPrefs = new Set(
      (Array.isArray(sessionPrefs) ? sessionPrefs : []).map(v =>
        String(v).toLowerCase().replace(/[\s-]+/g, '_')
      )
    );
    const hasEither = normalizedPrefs.has('either') || normalizedPrefs.has('both');
    return {
      offersOnline: normalizedPrefs.has('online') || hasEither,
      offersInPerson: (normalizedPrefs.has('in_person') || normalizedPrefs.has('inperson') || hasEither) && cityMatches,
    };
  }, [therapist.availability, therapist.session_preferences, therapist.city, patientCity]);

  // Matching modalities
  const matchingModalities = useMemo(() => {
    if (patientModalities.length === 0 || !therapist.modalities) return [];
    return therapist.modalities.filter(m => 
      patientModalities.some(pm => pm.toLowerCase() === m.toLowerCase())
    ).slice(0, 3);
  }, [therapist.modalities, patientModalities]);

  // Matching schwerpunkte
  const matchingSchwerpunkte = useMemo(() => {
    if (patientSchwerpunkte.length === 0 || !therapist.schwerpunkte) return [];
    const patientSet = new Set(patientSchwerpunkte);
    return therapist.schwerpunkte.filter(s => patientSet.has(s)).slice(0, 4);
  }, [therapist.schwerpunkte, patientSchwerpunkte]);

  const profile = therapist.metadata?.profile;
  const qualification = profile?.qualification || 'Geprüfte:r Therapeut:in';
  const whoComesToMe = profile?.who_comes_to_me;
  const sessionFocus = profile?.session_focus;

  return (
    <Card className="border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 ring-2 ring-emerald-200/50 shadow-xl overflow-hidden">
      {/* Premium header banner */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-6 py-3 text-center">
        <span className="text-base font-semibold text-white tracking-wide flex items-center justify-center gap-2">
          <Star className="h-5 w-5 fill-white" />
          Dein bester Match
        </span>
      </div>

      <CardContent className="p-6 sm:p-8">
        {/* Header with large avatar */}
        <div className="flex flex-col sm:flex-row gap-6 mb-6">
          <Avatar className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-emerald-100 shadow-lg mx-auto sm:mx-0">
            {photoSrc ? (
              <AvatarImage
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                loading="eager"
                onError={() => setImageError(true)}
              />
            ) : (
              <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-3xl font-semibold text-white">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {therapist.first_name} {therapist.last_name}
            </h2>
            
            {/* Verification badge */}
            <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 mb-3">
              <ShieldCheck className="h-4 w-4" />
              {qualification}
            </Badge>

            {/* Location and format */}
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 text-sm text-gray-600">
              {therapist.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {therapist.city}
                </span>
              )}
              {offersOnline && (
                <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700">
                  <Video className="h-3 w-3" />
                  Online
                </Badge>
              )}
              {offersInPerson && (
                <Badge variant="secondary" className="gap-1 bg-slate-50 text-slate-700">
                  <User className="h-3 w-3" />
                  Vor Ort
                </Badge>
              )}
              {therapist.languages && therapist.languages.length > 0 && !therapist.languages.every(l => l === 'Deutsch') && (
                <Badge variant="secondary" className="gap-1 bg-violet-50 text-violet-700">
                  <Globe className="h-3 w-3" />
                  {therapist.languages.filter(l => l !== 'Deutsch').join(', ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Matching tags */}
        {(matchingModalities.length > 0 || matchingSchwerpunkte.length > 0) && (
          <div className="mb-6 space-y-3">
            {matchingModalities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {matchingModalities.map(m => {
                  const info = getModalityInfo(m);
                  return (
                    <Badge key={m} variant="outline" className={`rounded-full gap-1.5 ${info.cls}`}>
                      <info.Icon className="h-3 w-3" />
                      {info.label}
                    </Badge>
                  );
                })}
              </div>
            )}
            {matchingSchwerpunkte.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {matchingSchwerpunkte.map(id => (
                  <Badge key={id} variant="outline" className={`rounded-full border ${getSchwerpunktColorClasses(id)}`}>
                    {getSchwerpunktLabel(id)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile content */}
        <div className="space-y-4 mb-6">
          {whoComesToMe && (
            <div>
              <p className="text-gray-700">
                <span className="font-medium">Zu mir kommen Menschen, die </span>
                {whoComesToMe}
              </p>
            </div>
          )}
          {sessionFocus && !whoComesToMe && (
            <p className="text-gray-700">{sessionFocus}</p>
          )}
        </div>

        {/* Embedded calendar preview */}
        {isCalLive && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Nächste freie Intro-Termine (15 min, kostenlos)
            </h3>
            
            {calState.slotsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : slotsByDay.length === 0 ? (
              <p className="text-sm text-gray-500">Termine werden geladen...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {visibleDays.map((day: DayGroup) => (
                    <div key={day.dateIso} className="text-center">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {new Date(day.dateIso + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1">
                        {day.slots.slice(0, 4).map((slot: CalNormalizedSlot, idx: number) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-xs px-2 py-1 h-auto border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400"
                            onClick={onBookIntro}
                          >
                            {slot.time_label}
                          </Button>
                        ))}
                        {day.slots.length > 4 && (
                          <span className="text-xs text-gray-400 self-center">+{day.slots.length - 4}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Navigation */}
                {(hasPrevDays || hasMoreDays) && (
                  <div className="flex justify-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWeekIndex(w => w - 1)}
                      disabled={!hasPrevDays}
                      className="text-xs"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Früher
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWeekIndex(w => w + 1)}
                      disabled={!hasMoreDays}
                      className="text-xs"
                    >
                      Später
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-base py-6"
            onClick={onBookIntro}
            disabled={!therapist.accepting_new}
          >
            <Video className="mr-2 h-5 w-5" />
            Online-Kennenlernen buchen (kostenlos)
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="sm:w-auto text-base py-6"
            onClick={onViewProfile}
          >
            Profil ansehen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
