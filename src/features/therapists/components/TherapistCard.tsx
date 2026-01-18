'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, Calendar, MessageCircle, User, ShieldCheck, ChevronRight, Globe, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TherapistData } from './TherapistDirectory';
import { ContactModal } from './ContactModal';
import { getAttribution } from '@/lib/attribution';
import { getModalityInfo } from '@/lib/modalities';
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from '@/lib/schwerpunkte';
import { isCalBookingAvailable, isSessionBookingAvailable } from '@/lib/cal/booking-availability';

interface TherapistCardProps {
  therapist: TherapistData;
  onViewDetails: () => void;
  // Optional match-specific props
  /** @deprecated Use patientModalities instead for conditional display */
  showModalities?: boolean;
  /** @deprecated Use patientSchwerpunkte instead for conditional display */
  showSchwerpunkte?: boolean;
  /** Patient's selected modalities - if non-empty, shows matching modality badges */
  patientModalities?: string[];
  /** Patient's selected schwerpunkte - if non-empty, shows matching schwerpunkte badges */
  patientSchwerpunkte?: string[];
  matchBadge?: { text: string; className?: string } | null; // Optional badge for top matches
  contactedAt?: string | null; // ISO date string if therapist was already contacted
  onContactClick?: (type: 'booking' | 'consultation') => void; // Custom contact handler
  /** Highlight as the single best/perfect match with premium styling */
  highlighted?: boolean;
  /** Patient's city for match context - when provided, in-person badge only shows if cities match */
  patientCity?: string;
  /** Whether therapist requires intro before allowing full session booking */
  requiresIntroBeforeBooking?: boolean;
  /** Whether patient has completed an intro session with this therapist */
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


export function TherapistCard({
  therapist,
  onViewDetails,
  showModalities: _legacyShowModalities,
  showSchwerpunkte: _legacyShowSchwerpunkte,
  patientModalities = [],
  patientSchwerpunkte = [],
  matchBadge = null,
  contactedAt = null,
  onContactClick: customContactHandler,
  highlighted = false,
  patientCity,
  requiresIntroBeforeBooking = false,
  hasCompletedIntro = false,
}: TherapistCardProps) {
  const [imageError, setImageError] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactType, setContactType] = useState<'booking' | 'consultation'>('booking');

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  // EARTH-225: Derive format badges from actual availability slots when present,
  // fall back to session_preferences when no slots exist (e.g., message-only therapists)
  // When patientCity is provided (match context), only show in-person if cities match
  const { offersOnline, offersInPerson } = useMemo(() => {
    const availability = therapist.availability || [];
    const hasSlots = Array.isArray(availability) && availability.length > 0;

    // Check if in-person is relevant for this patient (city match)
    const cityMatches = !patientCity || 
      (therapist.city && patientCity.toLowerCase().trim() === therapist.city.toLowerCase().trim());

    if (hasSlots) {
      // Derive from actual slot availability
      const hasOnlineSlots = availability.some(s => s.format === 'online');
      const hasInPersonSlots = availability.some(s => s.format === 'in_person');
      return {
        offersOnline: hasOnlineSlots,
        // Only show in-person badge if city matches (or no patientCity filter)
        offersInPerson: hasInPersonSlots && cityMatches,
      };
    }

    // Fallback to session preferences when no slots available
    const sessionPrefs = therapist.session_preferences || [];
    const normalizedPrefs = new Set(
      (Array.isArray(sessionPrefs) ? sessionPrefs : []).map(v =>
        String(v).toLowerCase().replace(/[\s-]+/g, '_')
      )
    );
    const hasEither = normalizedPrefs.has('either') || normalizedPrefs.has('both');
    return {
      offersOnline: normalizedPrefs.has('online') || hasEither,
      // Only show in-person badge if city matches (or no patientCity filter)
      offersInPerson: (normalizedPrefs.has('in_person') || normalizedPrefs.has('inperson') || hasEither) && cityMatches,
    };
  }, [therapist.availability, therapist.session_preferences, therapist.city, patientCity]);

  // Memoize modality info lookups to prevent recalculation on every render
  const modalityInfos = useMemo(() => {
    return (therapist.modalities || []).slice(0, 3).map(m => getModalityInfo(m));
  }, [therapist.modalities]);

  // Conditional display: show modalities if patient has modality preferences
  const shouldShowModalities = patientModalities.length > 0 && therapist.modalities && therapist.modalities.length > 0;
  // Show schwerpunkte if: legacy prop is true (directory) OR patient selected any (matches page)
  const shouldShowSchwerpunkte = (_legacyShowSchwerpunkte || patientSchwerpunkte.length > 0) && therapist.schwerpunkte && therapist.schwerpunkte.length > 0;

  // Sort schwerpunkte: patient-matching ones first, then others
  const sortedSchwerpunkte = useMemo(() => {
    if (!therapist.schwerpunkte) return [];
    const patientSet = new Set(patientSchwerpunkte);
    return [...therapist.schwerpunkte].sort((a, b) => {
      const aMatches = patientSet.has(a);
      const bMatches = patientSet.has(b);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  }, [therapist.schwerpunkte, patientSchwerpunkte]);

  const handleContactClick = (type: 'booking' | 'consultation') => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'contact_cta_clicked', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: type } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch { }

    // Cal-enabled therapists use modal flow (EARTH-256)
    // TherapistDetailModal handles the Cal booking view internally

    if (customContactHandler) {
      customContactHandler(type);
    } else {
      setContactType(type);
      setContactModalOpen(true);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('de-DE');
    } catch {
      return iso;
    }
  };

  const openDetails = () => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'profile_cta_clicked', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch { }
    onViewDetails();
  };

  return (
    <Card className={`group relative flex h-full flex-col overflow-hidden shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
      highlighted 
        ? 'border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 ring-2 ring-emerald-200/50 shadow-emerald-100/50' 
        : 'border border-gray-200/60 bg-white/80 backdrop-blur-sm'
    }`}>
      {/* Premium highlight banner for recommended match */}
      {highlighted && (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-4 py-2 text-center">
          <span className="text-sm font-semibold text-white tracking-wide flex items-center justify-center gap-2">
            <span className="text-base">⭐</span>
            Für dich empfohlen
          </span>
        </div>
      )}
      <CardContent className="flex flex-1 flex-col p-5 sm:p-7">
        {/* Clickable summary area (opens profile) - flex-1 ensures buttons stay at bottom */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Profil von ${therapist.first_name} ${therapist.last_name} ansehen`}
          onClick={openDetails}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetails();
            }
          }}
          className="flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer rounded-lg hover:bg-slate-50/50 transition-colors"
        >
          {/* Header with avatar and name */}
          <div className="mb-5 flex items-start gap-5">
            <Avatar className="h-20 w-20 ring-2 ring-gray-100">
              {photoSrc ? (
                <AvatarImage
                  src={photoSrc}
                  alt={`${therapist.first_name} ${therapist.last_name}`}
                  loading="lazy"
                  decoding="async"
                  onError={() => setImageError(true)}
                />
              ) : (
                <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-xl font-semibold text-white">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-1.5">
                <span>
                  {therapist.first_name} {therapist.last_name}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400 transition-all duration-200 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:-translate-x-0" aria-hidden="true" />
              </h3>

              {/* Match quality badge (takes priority if provided) */}
              {matchBadge ? (
                <Badge className={matchBadge.className || "mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                  {matchBadge.text}
                </Badge>
              ) : (
                /* Trust + Availability */
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {/* Trust + Qualification Badge */}
                  <Badge variant="outline" title="Profil geprüft: Qualifikation & Lizenzen verifiziert" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 whitespace-nowrap">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none">{therapist.metadata?.profile?.qualification || 'Verifiziert'}</span>
                  </Badge>
                  {therapist.accepting_new ? (
                    <Badge className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Verfügbar</span>
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                      Keine Kapazität
                    </Badge>
                  )}
                </div>
              )}

              {/* Contacted date */}
              {contactedAt && (
                <div className="mt-1 text-xs text-emerald-700">
                  Bereits kontaktiert am {fmtDate(contactedAt)}
                </div>
              )}
            </div>
          </div>

          {/* Modalities FIRST (shown when patient has modality preferences) */}
          {shouldShowModalities && (
            <div className="mb-3">
              <div className="relative -mx-4">
                <div
                  className="min-h-[32px] overflow-x-auto overflow-y-visible whitespace-nowrap px-4 py-1 [scrollbar-width:none] [-ms-overflow-style:none]"
                  aria-label="Modalitäten"
                >
                  <div className="inline-flex gap-2">
                    {modalityInfos.map((modalityInfo, idx) => {
                      const handleModalityClick = (e: React.MouseEvent | React.KeyboardEvent) => {
                        e.stopPropagation();
                        openDetails();
                        // Small delay to allow modal to open before scrolling
                        setTimeout(() => {
                          const element = document.getElementById(`modality-${modalityInfo.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 300);
                      };
                      return (
                        <Badge
                          key={idx}
                          variant="outline"
                          role="button"
                          tabIndex={0}
                          onClick={handleModalityClick}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleModalityClick(e);
                            }
                          }}
                          className={`rounded-full gap-1.5 shadow-sm cursor-pointer ${modalityInfo.cls} transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md active:shadow-sm active:translate-y-0`}
                          aria-label={`Profil öffnen und zu ${modalityInfo.label} springen`}
                        >
                          <modalityInfo.Icon className="h-3 w-3 opacity-90" />
                          {modalityInfo.label}
                        </Badge>
                      );
                    })}
                    {therapist.modalities.length > 3 && (
                      <Badge variant="secondary">+{therapist.modalities.length - 3}</Badge>
                    )}
                  </div>
                </div>
                {/* Edge fades */}
                <div className="pointer-events-none absolute left-0 top-0 h-full w-4 bg-gradient-to-r from-white to-transparent"></div>
                <div className="pointer-events-none absolute right-0 top-0 h-full w-4 bg-gradient-to-l from-white to-transparent"></div>
              </div>
            </div>
          )}

          {/* Schwerpunkte SECOND (sorted: patient-matching first) */}
          {shouldShowSchwerpunkte && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                {sortedSchwerpunkte.slice(0, 3).map((id) => (
                  <Badge
                    key={id}
                    variant="outline"
                    className={`rounded-full border cursor-pointer transition-all hover:shadow-sm ${getSchwerpunktColorClasses(id)}`}
                    onClick={(e) => { e.stopPropagation(); openDetails(); }}
                  >
                    {getSchwerpunktLabel(id)}
                  </Badge>
                ))}
                {therapist.schwerpunkte!.length > 3 && (
                  <Badge variant="secondary" className="rounded-full">+{therapist.schwerpunkte!.length - 3}</Badge>
                )}
              </div>
            </div>
          )}

          {/* Location and format info */}
          <div className="mb-5 space-y-2.5 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{therapist.city}</span>
            </div>
            {(offersOnline || offersInPerson) && (
              <div className="flex flex-wrap items-center gap-2">
                {offersOnline && (
                  <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700 hover:bg-sky-100">
                    <Video className="h-3 w-3" />
                    Online-Therapie
                  </Badge>
                )}
                {offersInPerson && (
                  <Badge variant="secondary" className="gap-1 bg-slate-50 text-slate-700 hover:bg-slate-100">
                    <User className="h-3 w-3" />
                    Vor-Ort-Therapie
                  </Badge>
                )}
              </div>
            )}
            {/* Languages - only show if non-German languages available */}
            {therapist.languages && therapist.languages.length > 0 && !therapist.languages.every(l => l === 'Deutsch') && (
              <div className="flex flex-wrap items-center gap-2">
                {therapist.languages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="gap-1 bg-violet-50 text-violet-700 hover:bg-violet-100">
                    <Globe className="h-3 w-3" />
                    {lang}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Profile text preview - prefer new structured fields, fallback to legacy */}
          {/* min-h ensures consistent card height even when no text */}
          <div className="mb-4 min-h-[4.5rem]">
            {(() => {
              const profile = therapist.metadata?.profile;
              // Check if therapist offers German - if not, use English labels
              const offersGerman = therapist.languages?.some(l => l === 'Deutsch') ?? true;
              // Prefer who_comes_to_me with prefix for context
              if (profile?.who_comes_to_me) {
                return (
                  <p className="line-clamp-3 text-sm text-gray-700">
                    <span className="font-medium">{offersGerman ? 'Zu mir kommen Menschen, die ' : 'People who come to me '}</span>
                    {profile.who_comes_to_me}
                  </p>
                );
              }
              // Fallback to session_focus or legacy approach_text
              const fallbackText = profile?.session_focus || profile?.about_me || therapist.approach_text;
              if (!fallbackText) return null;
              return (
                <p className="line-clamp-3 text-sm text-gray-700">
                  {fallbackText}
                </p>
              );
            })()}
          </div>

        </div>

        {/* Action buttons - differentiate based on slot availability */}
        {(() => {
          // Check intro slot availability for the primary "Kennenlernen" button
          const hasIntroSlots = isCalBookingAvailable(therapist);
          // Check full-session slot availability for the "Direkt buchen" button
          const hasSessionSlots = isSessionBookingAvailable(therapist);
          // Hide direct booking button if therapist requires intro and patient hasn't completed one
          const hideDirectBooking = requiresIntroBeforeBooking && !hasCompletedIntro;
          return (
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Button
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleContactClick('consultation')}
                disabled={!therapist.accepting_new}
              >
                {hasIntroSlots ? (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Online-Kennenlernen (15 min)
                  </>
                ) : (
                  <>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Kennenlernen anfragen
                  </>
                )}
              </Button>

              {/* Direct booking button - disabled with tooltip if intro required */}
              {hideDirectBooking ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Wrap in span to allow tooltip on disabled button */}
                      <span className="w-full" tabIndex={0}>
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full text-sm opacity-50 cursor-not-allowed pointer-events-none"
                          disabled
                          tabIndex={-1}
                        >
                          <Calendar className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">Direkt buchen</span>
                          <Info className="ml-1.5 h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-center">
                      <p>Erst nach Kennenlernen buchbar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-sm"
                  onClick={() => handleContactClick('booking')}
                  disabled={!therapist.accepting_new}
                >
                  {hasSessionSlots ? (
                    <>
                      <Calendar className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{contactedAt ? 'Erneut buchen' : 'Direkt buchen'}</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">Anfragen</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })()}
      </CardContent>

      {/* Contact modal */}
      <ContactModal
        therapist={{
          id: therapist.id,
          first_name: therapist.first_name,
          last_name: therapist.last_name,
          photo_url: therapist.photo_url,
          availability: therapist.availability,
          metadata: therapist.metadata,
          accepting_new: therapist.accepting_new,
        }}
        contactType={contactType}
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />
    </Card>
  );
}
