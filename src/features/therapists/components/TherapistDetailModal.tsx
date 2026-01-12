'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { MapPin, Video, User, Calendar, MessageCircle, Globe, ShieldCheck, CalendarCheck2, X, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, Euro, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { TherapistData } from './TherapistDirectory';
import { getAttribution } from '@/lib/attribution';
import { getModalityInfo } from '@/lib/modalities';
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from '@/lib/schwerpunkte';
import { cn } from '@/lib/utils';
import { formatSessionPrice } from '@/lib/pricing';
import { isCalBookingEnabled } from '@/lib/cal/booking-url';
import { useCalBooking, groupSlotsByDay } from '../hooks/useCalBooking';
import { CalVerificationForm } from './CalVerificationForm';
import { Skeleton } from '@/components/ui/skeleton';
import type { CalBookingKind } from '@/contracts/cal';

interface TherapistDetailModalProps {
  therapist: TherapistData;
  open: boolean;
  onClose: () => void;
  initialScrollTarget?: string;
  /** When true, hides contact CTAs and booking - used for therapist/admin previews */
  previewMode?: boolean;
  /** Initial view mode when modal opens (default: 'profile') */
  initialViewMode?: ViewMode;
  /** Initial Cal booking kind when opening in cal-booking mode */
  initialCalBookingKind?: CalBookingKind;
  onOpenContactModal?: (
    therapist: TherapistData,
    type: 'booking' | 'consultation',
    selectedSlot?: { date_iso: string; time_label: string; format: 'online' | 'in_person' }
  ) => void;
}

type Slot = { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string };
type ViewMode = 'profile' | 'booking' | 'cal-booking';

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

export function TherapistDetailModal({
  therapist,
  open,
  onClose,
  initialScrollTarget,
  onOpenContactModal,
  previewMode = false,
  initialViewMode = 'profile',
  initialCalBookingKind = 'intro',
}: TherapistDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [sessionFormat, setSessionFormat] = useState<'online' | 'in_person' | ''>('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [weekIndex, setWeekIndex] = useState(0);

  // Cal.com booking state (EARTH-256)
  const [calBookingKind, setCalBookingKind] = useState<CalBookingKind>(initialCalBookingKind);
  const [calWeekIndex, setCalWeekIndex] = useState(0);
  // Progressive disclosure for slot picker
  const [showAllDays, setShowAllDays] = useState(false);
  const INITIAL_DAYS_TO_SHOW = 3;
  const isCalEnabled = isCalBookingEnabled(therapist);

  // Reset viewMode to initial when modal opens with new therapist or initial mode
  useEffect(() => {
    if (open) {
      setViewMode(initialViewMode);
      setCalBookingKind(initialCalBookingKind);
    }
  }, [open, initialViewMode, initialCalBookingKind]);

  // Build redirect path for email magic link - returns user to therapist modal with booking flow
  const calEmailRedirectPath = useMemo(() => {
    return `/therapeuten?tid=${therapist.id}&view=cal-booking&kind=${calBookingKind}`;
  }, [therapist.id, calBookingKind]);

  const [calState, calActions] = useCalBooking({
    therapistId: therapist.id,
    calUsername: therapist.cal_username || '',
    bookingKind: calBookingKind,
    enabled: isCalEnabled && open, // Fetch slots when modal is open, not just when in cal-booking view
    emailRedirectPath: calEmailRedirectPath,
  });

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];
  const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
  const offersInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');

  const profile = therapist.metadata?.profile;
  const schwerpunkte = Array.isArray(therapist.schwerpunkte) ? therapist.schwerpunkte : [];
  // Use top-level languages (from mapper), fallback to profile.languages for backwards compat
  const languages = therapist.languages || profile?.languages || [];
  const yearsExperience = profile?.years_experience;
  const practiceAddress = (profile?.practice_address || '').toString().trim();
  const hasStructuredProfileContent = Boolean(
    profile?.who_comes_to_me ||
    profile?.session_focus ||
    profile?.first_session ||
    profile?.about_me ||
    (Array.isArray(languages) && languages.length > 0) ||
    yearsExperience ||
    practiceAddress
  );
  const showLegacyApproachText = Boolean(therapist.approach_text && !hasStructuredProfileContent);

  const handleContactClick = (type: 'booking' | 'consultation') => {
    if (previewMode || !onOpenContactModal) return;
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'contact_cta_clicked', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: type } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch { }

    if (type === 'booking') {
      // Check if therapist has available slots
      const hasSlots = selectableSlots.length > 0;

      if (hasSlots) {
        // Has slots: switch to booking mode with slot picker
        setViewMode('booking');
        setSessionFormat('');
        setSelectedSlot(null);
        setWeekIndex(0);
      } else {
        // No slots: open ContactModal for messaging
        onOpenContactModal?.(therapist, 'booking', undefined);
      }
    } else {
      // For consultation, call parent to open ContactModal
      onOpenContactModal?.(therapist, type, undefined);
    }
  };

  const handleBackToProfile = useCallback(() => {
    setViewMode('profile');
    setSessionFormat('');
    setSelectedSlot(null);
    setWeekIndex(0);
  }, []);

  const handleProceedToVerification = useCallback(() => {
    if (!selectedSlot) return;
    if (previewMode || !onOpenContactModal) return;
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = {
        type: 'booking_proceed_to_verification',
        ...attrs,
        properties: {
          page_path: pagePath,
          therapist_id: therapist.id,
          date_iso: selectedSlot.date_iso,
          time_label: selectedSlot.time_label,
          format: selectedSlot.format
        }
      };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch { }
    // Close this modal and open ContactModal with selected slot
    // This creates a smoother transition since Contact Modal shows the same therapist header + slot
    onOpenContactModal?.(therapist, 'booking', {
      date_iso: selectedSlot.date_iso,
      time_label: selectedSlot.time_label,
      format: selectedSlot.format
    });
  }, [selectedSlot, therapist, onOpenContactModal, previewMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = { type: 'profile_modal_opened', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }

      // Track price viewed in profile
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = {
          type: 'profile_price_viewed',
          ...attrs,
          properties: {
            page_path: pagePath,
            therapist_id: therapist.id,
            has_custom_price: Boolean(therapist.typical_rate),
            price_amount: therapist.typical_rate || null,
            price_position: 'bottom_of_bio'
          }
        };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }

      // Scroll to initial target if provided
      if (initialScrollTarget) {
        setTimeout(() => {
          const element = document.getElementById(initialScrollTarget);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [open, therapist.id, therapist.typical_rate, initialScrollTarget]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imageViewerOpen) {
        setImageViewerOpen(false);
      }
    };

    if (imageViewerOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [imageViewerOpen]);

  // Close viewer on any click while it's open
  useEffect(() => {
    if (!imageViewerOpen) return;

    const handleClick = () => {
      setImageViewerOpen(false);
    };

    // Small delay to avoid closing immediately on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [imageViewerOpen]);

  const handleImageClick = () => {
    if (photoSrc) {
      setImageViewerOpen(true);
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = { type: 'profile_image_expanded', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  };

  const closeViewer = () => {
    setImageViewerOpen(false);
  };

  // Booking slot logic (extracted from ContactModal)
  const allSlots = useMemo<Slot[]>(() => Array.isArray(therapist.availability) ? (therapist.availability as Slot[]) : [], [therapist.availability]);
  const minSelectable = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);

  function slotDate(s: Slot) {
    const [h, m] = (s.time_label || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
    const d = new Date(s.date_iso + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  }

  const selectableSlots = useMemo<Slot[]>(() => allSlots.filter(s => slotDate(s) >= minSelectable), [allSlots, minSelectable]);

  const slotsByWeek = useMemo(() => {
    const map = new Map<string, { label: string; start: Date; slots: Slot[] }>();
    selectableSlots.forEach(s => {
      const dt = slotDate(s);
      const day = dt.getDay();
      const deltaToMon = (day === 0 ? -6 : 1 - day);
      const start = new Date(dt);
      start.setDate(dt.getDate() + deltaToMon);
      start.setHours(0, 0, 0, 0);
      const key = start.toISOString().slice(0, 10);
      if (!map.has(key)) {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const label = `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
        map.set(key, { label, start, slots: [] });
      }
      map.get(key)!.slots.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].start.getTime() - b[1].start.getTime());
  }, [selectableSlots]);

  useEffect(() => {
    if (weekIndex >= slotsByWeek.length) setWeekIndex(0);
  }, [slotsByWeek.length, weekIndex]);

  const hasOnlineSlots = allSlots.some(s => s.format === 'online');
  const hasInPersonSlots = allSlots.some(s => s.format === 'in_person');
  const slotsForWeek: Slot[] = slotsByWeek[weekIndex]?.[1]?.slots || [];
  const filteredSlots: Slot[] = sessionFormat ? slotsForWeek.filter((s) => s.format === sessionFormat) : slotsForWeek;
  const resolvedAddress = sessionFormat === 'in_person' ? (selectedSlot?.address || therapist.metadata?.profile?.practice_address || '') : '';

  const handleSlotSelect = useCallback((slot: Slot) => {
    setSelectedSlot(slot);
    if (!sessionFormat) setSessionFormat(slot.format);
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = {
        type: 'booking_slot_selected',
        ...attrs,
        properties: {
          page_path: pagePath,
          therapist_id: therapist.id,
          date_iso: slot.date_iso,
          time_label: slot.time_label,
          format: slot.format,
          address_present: Boolean(slot.address || therapist.metadata?.profile?.practice_address),
          week_index: weekIndex,
          price_amount: therapist.typical_rate || null,
        },
      };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

      // Track price viewed in booking confirmation
      const pricePayload = {
        type: 'booking_price_viewed',
        ...attrs,
        properties: {
          page_path: pagePath,
          therapist_id: therapist.id,
          price_amount: therapist.typical_rate || null,
          date_iso: slot.date_iso,
          time_label: slot.time_label,
          format: slot.format,
        },
      };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(pricePayload)], { type: 'application/json' }));
    } catch { }
  }, [sessionFormat, weekIndex, therapist.id, therapist.typical_rate, therapist.metadata?.profile?.practice_address]);

  const handleModalClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // Track abandonment if user viewed price but didn't complete booking
      if (selectedSlot) {
        try {
          const attrs = getAttribution();
          const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
          const payload = {
            type: 'booking_abandoned_after_price',
            ...attrs,
            properties: {
              page_path: pagePath,
              therapist_id: therapist.id,
              price_amount: therapist.typical_rate || null,
              had_selected_slot: Boolean(selectedSlot),
              viewed_price_in_profile: true,
              viewed_price_in_booking: Boolean(selectedSlot && sessionFormat),
            },
          };
          navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        } catch { }
      }

      // Reset to profile view when closing
      setViewMode('profile');
      setSessionFormat('');
      setSelectedSlot(null);
      setWeekIndex(0);
      // Reset Cal booking state
      setCalWeekIndex(0);
      setShowAllDays(false);
      calActions.reset();
      onClose();
    }
  }, [onClose, selectedSlot, sessionFormat, therapist.id, therapist.typical_rate, calActions]);

  // Cal slots grouped by day
  const calSlotsByDay = useMemo(() => groupSlotsByDay(calState.slots), [calState.slots]);
  const calSortedDays = useMemo(() => Array.from(calSlotsByDay.keys()).sort(), [calSlotsByDay]);

  // Handle opening Cal booking view
  const handleOpenCalBooking = useCallback((kind: CalBookingKind) => {
    setCalBookingKind(kind);
    setViewMode('cal-booking');
    calActions.reset();
    setCalWeekIndex(0);
    setShowAllDays(false);
  }, [calActions]);

  // Handle back from Cal booking
  const handleBackFromCalBooking = useCallback(() => {
    setViewMode('profile');
    calActions.reset();
    setCalWeekIndex(0);
  }, [calActions]);

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:max-w-3xl"
        onInteractOutside={(e) => {
          // While image viewer is open, prevent dialog from closing on outside clicks
          if (imageViewerOpen) {
            e.preventDefault();
            closeViewer();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">
            Profil von {therapist.first_name} {therapist.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Hero section with avatar and basic info */}
        <div className="flex flex-col items-center gap-4 border-b pb-6 sm:flex-row sm:items-start">
          <Avatar
            className={`h-32 w-32 shrink-0 ring-4 ring-gray-100 transition-all duration-200 ${photoSrc ? 'cursor-pointer hover:ring-emerald-300 hover:ring-offset-2 hover:shadow-lg' : ''
              }`}
            onClick={handleImageClick}
            role={photoSrc ? 'button' : undefined}
            tabIndex={photoSrc ? 0 : undefined}
            onKeyDown={(e) => {
              if (photoSrc && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleImageClick();
              }
            }}
            aria-label={photoSrc ? `Profilbild von ${therapist.first_name} ${therapist.last_name} vergrößern` : undefined}
          >
            {photoSrc ? (
              <AvatarImage
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                onError={() => setImageError(true)}
              />
            ) : (
              <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-4xl font-semibold text-white">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="break-words text-2xl font-bold text-gray-900">
              {therapist.first_name} {therapist.last_name}
            </h2>

            {/* Trust + Availability badges */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verifiziert
              </Badge>
              {therapist.accepting_new ? (
                <Badge className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Verfügbar</span>
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Keine Kapazität</Badge>
              )}
            </div>

            {/* Location & Session Format pills */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                <MapPin className="h-3.5 w-3.5" />
                {therapist.city}
              </Badge>
              {offersInPerson && practiceAddress && (
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700" title="Praxis-Adresse">
                  <MapPin className="h-3.5 w-3.5" />
                  {practiceAddress}
                </Badge>
              )}

              {offersOnline && (
                <Badge variant="outline" className="gap-1.5 border-sky-200 bg-sky-50 text-sky-700">
                  <Video className="h-3.5 w-3.5" />
                  Online-Therapie
                </Badge>
              )}
              {offersInPerson && (
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                  <User className="h-3.5 w-3.5" />
                  Vor-Ort-Therapie
                </Badge>
              )}
            </div>

            {/* Languages & Experience pills */}
            {(languages.length > 0 || yearsExperience) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {languages.length > 0 && (
                  <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {languages.join(', ')}
                  </Badge>
                )}
                {yearsExperience && (
                  <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                    <Globe className="h-3.5 w-3.5" />
                    {yearsExperience} Jahre Erfahrung
                  </Badge>
                )}
              </div>
            )}
            {/* Modalities (Hero) */}
            {therapist.modalities && therapist.modalities.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {therapist.modalities.map((modality, idx) => {
                  const modalityInfo = getModalityInfo(modality);
                  const scrollToDescription = () => {
                    const element = document.getElementById(`modality-${modalityInfo.id}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  };
                  return (
                    <Badge
                      key={idx}
                      variant="outline"
                      role="button"
                      tabIndex={0}
                      onClick={scrollToDescription}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          scrollToDescription();
                        }
                      }}
                      className={`rounded-full gap-1.5 shadow-sm cursor-pointer ${modalityInfo.cls} transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md active:shadow-sm active:translate-y-0`}
                      aria-label={`Zur Beschreibung von ${modalityInfo.label} springen`}
                    >
                      <modalityInfo.Icon className="h-3 w-3 opacity-90" />
                      {modalityInfo.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {viewMode === 'profile' && (
          <>

            {schwerpunkte.length > 0 && (
              <div className="border-b pb-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Spezialisierungen</h3>
                <div className="flex flex-wrap gap-2">
                  {schwerpunkte.map((id) => (
                    <Badge
                      key={id}
                      variant="outline"
                      className={cn('rounded-full border transition-all hover:shadow-sm', getSchwerpunktColorClasses(id))}
                    >
                      {getSchwerpunktLabel(id)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(profile?.who_comes_to_me || profile?.session_focus || profile?.first_session || profile?.about_me) && (() => {
              // Check if therapist offers German - if not, use English labels
              const offersGerman = languages.some(l => l === 'Deutsch') || languages.length === 0;
              return (
                <div className="border-b pb-6">
                  <h3 className="mb-3 text-lg font-semibold text-gray-900">{offersGerman ? 'Profil' : 'Profile'}</h3>
                  <div className="space-y-5">
                    {profile?.who_comes_to_me && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{offersGerman ? 'Zu mir kommen Menschen, die' : 'People who come to me'}</h4>
                        <p className="mt-1 text-sm text-gray-700 break-words">{profile.who_comes_to_me}</p>
                      </div>
                    )}
                    {profile?.session_focus && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{offersGerman ? 'In unserer Arbeit' : 'In our work together'}</h4>
                        <p className="mt-1 text-sm text-gray-700 break-words">{profile.session_focus}</p>
                      </div>
                    )}
                    {profile?.first_session && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{offersGerman ? 'Das erste Gespräch' : 'The first session'}</h4>
                        <p className="mt-1 text-sm text-gray-700 break-words">{profile.first_session}</p>
                      </div>
                    )}
                    {profile?.about_me && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{offersGerman ? 'Über mich' : 'About me'}</h4>
                        <p className="mt-1 text-sm text-gray-700 break-words">{profile.about_me}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Approach text */}
            {(showLegacyApproachText || therapist.typical_rate != null) && (
              <div className="border-b pb-6">
                {showLegacyApproachText && (
                  <>
                    <h3 className="mb-3 text-lg font-semibold text-gray-900">Über mich & meinen Ansatz</h3>
                    <div className="prose prose-sm max-w-none overflow-wrap-anywhere text-gray-700">
                      {therapist.approach_text.split('\n').map((paragraph, idx) => (
                        paragraph.trim() && <p key={idx} className="mb-3 break-words">{paragraph}</p>
                      ))}
                    </div>
                  </>
                )}
                {/* Session price badge */}
                {therapist.typical_rate != null && (
                  <div className={showLegacyApproachText ? 'mt-4' : undefined}>
                    <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                      <Euro className="h-3.5 w-3.5" />
                      {formatSessionPrice(therapist.typical_rate)}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Modality Descriptions */}
            {therapist.modalities && therapist.modalities.length > 0 && (
              <div className="border-b pb-6">
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Methoden, mit denen {therapist.first_name} arbeitet</h3>
                <p className="mb-5 text-sm font-medium text-emerald-700/90 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  {profile?.qualification || 'Therapeut:in'} · Ausbildungen verifiziert
                </p>
                <div className="space-y-5">
                  {therapist.modalities.map((modality, idx) => {
                    const modalityInfo = getModalityInfo(modality);
                    if (!modalityInfo.description) return null;
                    return (
                      <div
                        key={idx}
                        id={`modality-${modalityInfo.id}`}
                        className="scroll-mt-4 rounded-xl border border-gray-200/60 bg-gradient-to-br from-white to-gray-50/30 p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className={`shrink-0 rounded-lg bg-gradient-to-br p-2.5 shadow-sm ${modalityInfo.cls.replace('hover:border-', 'border-').replace('hover:bg-', 'bg-')}`}>
                            <modalityInfo.Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900">{modalityInfo.label}</h4>
                            {modalityInfo.subtitle && (
                              <p className="text-sm font-medium mt-0.5" style={{ color: modalityInfo.cls.match(/text-(\w+)-\d+/)?.[0].replace('text-', '') || 'inherit' }}>
                                {modalityInfo.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-gray-600">
                          {modalityInfo.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {viewMode === 'booking' && (
          <>
            {/* Booking mode: slot picker (for non-Cal therapists only) */}
            <div className="space-y-5 border-b pb-6">
              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToProfile}
                className="gap-2 -ml-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück zum Profil
              </Button>

              {/* Session format selector */}
              {(hasOnlineSlots || hasInPersonSlots) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Format *</Label>
                  <div className="flex gap-2 max-w-md mx-auto">
                    {hasOnlineSlots && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSessionFormat('online')}
                        className={cn(
                          'flex-1 h-11 gap-2',
                          'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
                          sessionFormat === 'online' && 'ring-2 ring-emerald-400 border-emerald-400'
                        )}
                      >
                        <Video className="h-4 w-4" />
                        Online
                      </Button>
                    )}
                    {hasInPersonSlots && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSessionFormat('in_person')}
                        className={cn(
                          'flex-1 h-11 gap-2',
                          'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                          sessionFormat === 'in_person' && 'ring-2 ring-emerald-400 border-emerald-400'
                        )}
                      >
                        <User className="h-4 w-4" />
                        Vor Ort
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed text-center">
                    Soll der Termin online oder vor Ort stattfinden?
                  </p>
                  {sessionFormat === 'in_person' && resolvedAddress && (
                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 shadow-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[18rem]" title={resolvedAddress}>{resolvedAddress}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Week navigation and slot picker */}
              {slotsByWeek.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between max-w-sm mx-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                      disabled={weekIndex <= 0}
                      aria-label="Vorherige Woche"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium text-gray-900">
                      {slotsByWeek[weekIndex]?.[1]?.label || ''}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setWeekIndex((i) => Math.min(slotsByWeek.length - 1, i + 1))}
                      disabled={weekIndex >= slotsByWeek.length - 1}
                      aria-label="Nächste Woche"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {filteredSlots.map((s: Slot, idx: number) => {
                      const dt = slotDate(s);
                      const disabled = dt < minSelectable || (sessionFormat ? (s.format !== sessionFormat) : false);
                      const selected = !!selectedSlot && selectedSlot.date_iso === s.date_iso && selectedSlot.time_label === s.time_label && selectedSlot.format === s.format;
                      const base = selected
                        ? 'ring-2 ring-emerald-400 border-2 border-emerald-400 bg-emerald-50 text-emerald-900 shadow-md scale-105'
                        : s.format === 'online'
                          ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100';
                      const cls = `h-11 px-3 inline-flex items-center gap-1.5 rounded-full border text-sm font-medium shadow-sm transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow'} ${base}`;
                      const day = dt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                      return (
                        <button
                          key={`${s.date_iso}-${s.time_label}-${idx}`}
                          type="button"
                          className={cls}
                          disabled={disabled}
                          onClick={() => handleSlotSelect(s)}
                          title={s.format === 'online' ? 'Online' : 'Vor Ort'}
                        >
                          <span>{day} {s.time_label}</span>
                        </button>
                      );
                    })}
                    {filteredSlots.length === 0 && (
                      <div className="text-sm text-gray-600">
                        Keine Termine in dieser Woche für das gewählte Format.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {slotsByWeek.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm">Momentan sind keine Termine verfügbar.</p>
                </div>
              )}

              {/* Booking summary with price */}
              {selectedSlot && sessionFormat && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm text-gray-900">
                    Du buchst deine {sessionFormat === 'online' ? 'Online' : 'Vor-Ort'}‑Sitzung{' '}
                    {(() => {
                      const d = new Date(selectedSlot.date_iso + 'T00:00:00');
                      return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
                    })()}{' '}
                    {selectedSlot.time_label} bei {therapist.first_name} {therapist.last_name}
                  </p>
                  <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700">
                    <Euro className="h-3.5 w-3.5" />
                    {formatSessionPrice(therapist.typical_rate)}
                  </Badge>
                </div>
              )}
            </div>
          </>
        )}

        {/* Cal.com booking view (EARTH-256) */}
        {viewMode === 'cal-booking' && (
          <>
            {/* Header with back button */}
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={handleBackFromCalBooking} className="shrink-0 -ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {calBookingKind === 'intro' ? 'Kostenloses Kennenlernen' : 'Sitzung buchen'}
                </h3>
                <p className="text-sm text-gray-500">
                  {calBookingKind === 'intro' ? '15 Min. • Kostenlos' : `50 Min. • ${formatSessionPrice(therapist.typical_rate)}`}
                </p>
              </div>
            </div>

            {/* Verification form for unverified users */}
            {calState.step !== 'slots' ? (
              <CalVerificationForm
                state={calState}
                actions={calActions}
                slotSummary={calState.selectedSlot && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mb-2">
                    <p className="text-sm text-emerald-900">
                      <span className="font-medium">Termin:</span>{' '}
                      {(() => {
                        const d = new Date(calState.selectedSlot.date_iso + 'T00:00:00');
                        return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
                      })()}{' '}
                      um {calState.selectedSlot.time_label} Uhr
                    </p>
                  </div>
                )}
              />
            ) : (
              /* Slot picker */
              <div className="space-y-4">
                {calState.slotsLoading && (
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-14 w-20 rounded-lg shrink-0" />
                      ))}
                    </div>
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </div>
                )}

                {/* EARTH-262: Show fallback UI when Cal.com is unavailable */}
                {calState.slotsUnavailable && (
                  <div className="text-center py-6 space-y-4">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Terminkalender vorübergehend nicht verfügbar
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Schreiben Sie {therapist.first_name} direkt eine Nachricht.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 max-w-xs mx-auto">
                      <Button
                        onClick={() => {
                          handleBackFromCalBooking();
                          onOpenContactModal?.(therapist, 'consultation', undefined);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Direkt kontaktieren
                      </Button>
                      <Button
                        variant="outline"
                        onClick={calActions.retrySlotsFetch}
                        className="text-gray-600"
                      >
                        Erneut versuchen
                      </Button>
                    </div>
                  </div>
                )}

                {calState.slotsError && !calState.slotsUnavailable && (
                  <div className="text-center py-6">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">{calState.slotsError}</p>
                  </div>
                )}

                {!calState.slotsLoading && !calState.slotsError && !calState.slotsUnavailable && calSortedDays.length === 0 && (
                  <div className="text-center py-6 space-y-4">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Aktuell sind keine Termine verfügbar.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleBackFromCalBooking();
                        onOpenContactModal?.(therapist, 'consultation', undefined);
                      }}
                      className="text-gray-600"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {therapist.first_name} direkt kontaktieren
                    </Button>
                  </div>
                )}

                {!calState.slotsLoading && !calState.slotsError && calSortedDays.length > 0 && (
                  <>
                    {/* Day chips */}
                    <div className="overflow-x-auto scrollbar-hide -mx-4">
                      <div className="flex gap-3 px-4 py-4">
                        {calSortedDays.map((day) => {
                          const isSelected = calState.selectedSlot?.date_iso === day;
                          const slotCount = calSlotsByDay.get(day)?.length || 0;
                          const d = new Date(day + 'T00:00:00');

                          return (
                            <button
                              key={day}
                              onClick={() => {
                                const firstSlot = calSlotsByDay.get(day)?.[0];
                                if (firstSlot && calState.selectedSlot?.date_iso !== day) {
                                  calActions.selectSlot(firstSlot);
                                }
                              }}
                              className={cn(
                                'shrink-0 px-3 py-2 rounded-lg border-2 text-center transition-all',
                                isSelected
                                  ? 'bg-emerald-50 border-emerald-400 shadow-lg shadow-emerald-200/50'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className={cn('text-sm font-medium', isSelected ? 'text-emerald-900' : 'text-gray-900')}>
                                {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </div>
                              <div className={cn('text-xs', isSelected ? 'text-emerald-600' : 'text-gray-500')}>
                                {slotCount} {slotCount === 1 ? 'Termin' : 'Termine'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time slots for selected day */}
                    {calState.selectedSlot && (
                      <div className="pt-2">
                        <p className="text-sm text-gray-600 mb-2">
                          Verfügbare Zeiten am {(() => {
                            const d = new Date(calState.selectedSlot.date_iso + 'T00:00:00');
                            return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
                          })()}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {calSlotsByDay.get(calState.selectedSlot.date_iso)?.map((slot) => {
                            const isSelected = calState.selectedSlot?.time_utc === slot.time_utc;
                            return (
                              <button
                                key={slot.time_utc}
                                onClick={() => calActions.selectSlot(slot)}
                                className={cn(
                                  'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white border-gray-200 text-gray-900 hover:border-emerald-300'
                                )}
                              >
                                {slot.time_label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Selected slot summary */}
                    {calState.selectedSlot && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-sm text-emerald-900">
                          <span className="font-medium">Gewählter Termin:</span>{' '}
                          {(() => {
                            const d = new Date(calState.selectedSlot.date_iso + 'T00:00:00');
                            return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
                          })()}{' '}
                          um {calState.selectedSlot.time_label} Uhr
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        {viewMode === 'profile' ? (
          <div className="sticky bottom-0 flex flex-col gap-3 pt-4 sm:flex-row">
            {/* Cal.com booking CTAs when enabled - open in-modal booking view (EARTH-256) */}
            {isCalEnabled ? (
              <>
                <Button
                  className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] rounded-md"
                  onClick={() => handleOpenCalBooking('intro')}
                  disabled={!therapist.accepting_new}
                >
                  <Video className="mr-2 h-5 w-5 shrink-0" />
                  <span className="break-words">Kostenloses Kennenlernen · Online (15 min)</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-md"
                  onClick={() => handleOpenCalBooking('full_session')}
                  disabled={!therapist.accepting_new}
                >
                  <CalendarCheck2 className="mr-2 h-5 w-5 shrink-0" />
                  <span className="break-words">Sitzung buchen</span>
                </Button>
              </>
            ) : (
              <>
                {/* Fallback: existing KH booking flow - consultation (free intro) is primary */}
                <Button
                  className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] rounded-md"
                  onClick={() => handleContactClick('consultation')}
                  disabled={!therapist.accepting_new}
                >
                  <Video className="mr-2 h-5 w-5 shrink-0" />
                  <span className="break-words">Kostenloses Kennenlernen · Online (15 min)</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-md"
                  onClick={() => handleContactClick('booking')}
                  disabled={!therapist.accepting_new}
                >
                  <Calendar className="mr-2 h-5 w-5 shrink-0" />
                  <span className="break-words">Direkt buchen</span>
                </Button>
              </>
            )}
          </div>
        ) : viewMode === 'booking' ? (
          <div className="sticky bottom-0 flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleBackToProfile}
              className="flex-1 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleProceedToVerification}
              disabled={!sessionFormat || !selectedSlot}
              className="flex-1 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Termin buchen
            </Button>
          </div>
        ) : viewMode === 'cal-booking' && calState.step === 'slots' ? (
          <div className="sticky bottom-0 flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleBackFromCalBooking}
              className="flex-1 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold"
            >
              Zurück
            </Button>
            <Button
              onClick={calActions.handleBooking}
              disabled={!calState.selectedSlot || calState.sessionLoading}
              className="flex-1 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Termin bestätigen
            </Button>
          </div>
        ) : null}
      </DialogContent>

      {/* Image viewer (card-like, tap-to-close anywhere via portal) */}
      {mounted && imageViewerOpen && photoSrc && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-150 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößertes Profilbild"
        >
          {/* Close button */}
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 rounded-full bg-white shadow-md p-2 text-slate-700 transition hover:shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Card container */}
          <div className="relative w-[min(92vw,560px)] sm:w-[min(85vw,680px)] max-h-[85vh] rounded-2xl bg-white p-3 sm:p-4 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
                draggable={false}
              />
            </div>

            {/* Name caption */}
            <div className="pt-3 text-center">
              <p className="text-base font-semibold text-slate-900">
                {therapist.first_name} {therapist.last_name}
              </p>
            </div>

            {/* Mobile hint */}
            <div className="mt-2 text-center text-xs text-slate-500 sm:hidden">
              Tippe um zu schließen.
            </div>
          </div>
        </div>,
        document.body
      )}
    </Dialog>
  );
}
