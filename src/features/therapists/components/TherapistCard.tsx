'use client';

import { useMemo, useState } from 'react';
import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, Calendar, MessageCircle, User, ShieldCheck, CalendarCheck2, ChevronRight } from 'lucide-react';
import type { TherapistData } from './TherapistDirectory';
import { ContactModal } from './ContactModal';
import { getAttribution } from '@/lib/attribution';
import { getModalityInfo } from '@/lib/modalities';

interface TherapistCardProps {
  therapist: TherapistData;
  onViewDetails: () => void;
  // Optional match-specific props
  showModalities?: boolean; // Control whether to show modality badges (default: true)
  matchBadge?: { text: string; className?: string } | null; // Optional badge for top matches
  contactedAt?: string | null; // ISO date string if therapist was already contacted
  onContactClick?: (type: 'booking' | 'consultation') => void; // Custom contact handler
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
  showModalities = true,
  matchBadge = null,
  contactedAt = null,
  onContactClick: customContactHandler,
}: TherapistCardProps) {
  const [imageError, setImageError] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactType, setContactType] = useState<'booking' | 'consultation'>('booking');

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];

  // Normalize session preferences to handle various formats
  const normalizedPrefs = new Set(
    (Array.isArray(sessionPrefs) ? sessionPrefs : []).map(v =>
      String(v).toLowerCase().replace(/[\s-]+/g, '_')
    )
  );
  const hasEither = normalizedPrefs.has('either') || normalizedPrefs.has('both');
  const offersOnline = normalizedPrefs.has('online') || hasEither;
  const offersInPerson = normalizedPrefs.has('in_person') || normalizedPrefs.has('inperson') || hasEither;

  const handleContactClick = (type: 'booking' | 'consultation') => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'contact_cta_clicked', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: type } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {}
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
    } catch {}
    onViewDetails();
  };

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
      <CardContent className="flex flex-1 flex-col p-5 sm:p-7">
        {/* Clickable summary area (opens profile) */}
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
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer rounded-lg hover:bg-slate-50/50 transition-colors"
        >
        {/* Header with avatar and name */}
        <div className="mb-5 flex items-start gap-5">
          <Avatar className="h-20 w-20 ring-2 ring-gray-100">
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
                <Badge variant="outline" title="Profil geprüft: Qualifikation & Lizenzen verifiziert" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verifiziert
                </Badge>
                {therapist.accepting_new ? (
                  <Badge className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
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

        {/* Modalities (conditional based on showModalities prop) */}
        {showModalities && therapist.modalities && therapist.modalities.length > 0 && (
          <div className="mb-3">
            <div className="relative -mx-4">
              <div
                className="min-h-[32px] overflow-x-auto overflow-y-visible whitespace-nowrap px-4 py-1 [scrollbar-width:none] [-ms-overflow-style:none]"
                aria-label="Modalitäten"
              >
                <div className="inline-flex gap-2">
                  {therapist.modalities.slice(0, 3).map((modality, idx) => {
                    const modalityInfo = getModalityInfo(modality);
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
        </div>

        {/* Approach text preview */}
        {therapist.approach_text && (
          <p className="mb-5 line-clamp-3 text-sm text-gray-700">
            {therapist.approach_text}
          </p>
        )}

        {/* Availability (next 3 weeks) */}
        {Array.isArray(therapist.availability) && therapist.availability.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
              <Calendar className="h-4 w-4" />
              Verfügbare Termine
            </div>
            <AvailabilityChips items={therapist.availability} />
          </div>
        )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleContactClick('booking')}
            disabled={!therapist.accepting_new}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {contactedAt ? 'Erneut kontaktieren' : 'Therapeut:in buchen'}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full text-sm"
            onClick={() => handleContactClick('consultation')}
            disabled={!therapist.accepting_new}
          >
            <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">Kostenloses Erstgespräch (15 min)</span>
          </Button>
        </div>
      </CardContent>
      
      {/* Contact modal */}
      <ContactModal
        therapist={{
          id: therapist.id,
          first_name: therapist.first_name,
          last_name: therapist.last_name,
          photo_url: therapist.photo_url,
        }}
        contactType={contactType}
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />
    </Card>
  );
}

function AvailabilityChips({ items }: { items: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items.slice(0, 9) : items.slice(0, 3);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }), []);
  function labelOf(d: string, t: string) {
    try {
      const dt = new Date(`${d}T00:00:00`);
      const day = dayFmt.format(dt); // e.g., Mo, 05.11
      return `${day} ${t}`;
    } catch {
      return `${d} ${t}`;
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((s, idx) => (
        <span
          key={`${s.date_iso}-${s.time_label}-${idx}`}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${s.format === 'online' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
          title={s.format === 'online' ? 'Online (Zoom-Link wird zugesendet)' : 'Vor Ort'}
        >
          {labelOf(s.date_iso, s.time_label)}
          <span className="ml-1 opacity-70">{s.format === 'online' ? '• Online' : '• Vor Ort'}</span>
        </span>
      ))}
      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs underline text-gray-700"
          aria-expanded={expanded}
        >
          {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
        </button>
      )}
    </div>
  );
}
