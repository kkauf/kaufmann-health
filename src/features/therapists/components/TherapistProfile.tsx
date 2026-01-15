'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, User, MessageCircle, Globe, ShieldCheck, CalendarCheck2, Euro } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { TherapistData } from './TherapistDirectory';
import { getModalityInfo } from '@/lib/modalities';
import { getSchwerpunktLabel, getSchwerpunktColorClasses } from '@/lib/schwerpunkte';
import { cn } from '@/lib/utils';
import { formatSessionPrice } from '@/lib/pricing';
import { isCalBookingEnabled } from '@/lib/cal/booking-url';
import { X } from 'lucide-react';

export interface TherapistProfileProps {
  therapist: TherapistData;
  /** When true, hides contact CTAs - used for previews */
  previewMode?: boolean;
  /** Whether therapist requires intro before allowing full session booking */
  requiresIntroBeforeBooking?: boolean;
  /** Whether patient has completed an intro session with this therapist */
  hasCompletedIntro?: boolean;
  /** Callback for booking intro */
  onBookIntro?: () => void;
  /** Callback for booking full session */
  onBookSession?: () => void;
  /** Additional className for container */
  className?: string;
  /** Compact mode hides some sections for smaller displays */
  compact?: boolean;
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

export function TherapistProfile({
  therapist,
  previewMode = false,
  requiresIntroBeforeBooking = false,
  hasCompletedIntro = false,
  onBookIntro,
  onBookSession,
  className,
  compact = false,
}: TherapistProfileProps) {
  const [imageError, setImageError] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount check for portal
  useState(() => {
    setMounted(true);
  });

  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];
  const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
  const offersInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');

  const profile = therapist.metadata?.profile;
  const schwerpunkte = Array.isArray(therapist.schwerpunkte) ? therapist.schwerpunkte : [];
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

  const isCalEnabled = isCalBookingEnabled(therapist);
  const hideDirectBooking = requiresIntroBeforeBooking && !hasCompletedIntro;

  const handleImageClick = () => {
    if (photoSrc) {
      setImageViewerOpen(true);
    }
  };

  const closeViewer = () => {
    setImageViewerOpen(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Hero section with avatar and basic info */}
      <div className="flex flex-col items-center gap-4 border-b pb-6 sm:flex-row sm:items-start">
        <Avatar
          className={cn(
            'h-32 w-32 shrink-0 ring-4 ring-gray-100 transition-all duration-200',
            photoSrc && 'cursor-pointer hover:ring-emerald-300 hover:ring-offset-2 hover:shadow-lg'
          )}
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
            {(() => {
              const addressIsMoreSpecific = practiceAddress && 
                practiceAddress.toLowerCase() !== therapist.city.toLowerCase() &&
                practiceAddress.length > therapist.city.length;
              
              return (
                <Badge variant="outline" className="gap-1.5 border-slate-200 bg-slate-50 text-slate-700" title={addressIsMoreSpecific ? 'Praxis-Adresse' : undefined}>
                  <MapPin className="h-3.5 w-3.5" />
                  {addressIsMoreSpecific ? practiceAddress : therapist.city}
                </Badge>
              );
            })()}

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
                    className={cn(
                      'rounded-full gap-1.5 shadow-sm cursor-pointer transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md active:shadow-sm active:translate-y-0',
                      modalityInfo.cls
                    )}
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

      {/* Spezialisierungen */}
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

      {/* Profile sections */}
      {(profile?.who_comes_to_me || profile?.session_focus || profile?.first_session || profile?.about_me) && (() => {
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

      {/* Legacy approach text + Price */}
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
      {therapist.modalities && therapist.modalities.length > 0 && !compact && (
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
                    <div className={cn(
                      'shrink-0 rounded-lg bg-gradient-to-br p-2.5 shadow-sm',
                      modalityInfo.cls.replace('hover:border-', 'border-').replace('hover:bg-', 'bg-')
                    )}>
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

      {/* Action buttons - only show if not in preview mode and callbacks provided */}
      {!previewMode && (onBookIntro || onBookSession) && (
        <div className="sticky bottom-0 flex flex-col gap-3 pt-4 sm:flex-row bg-white">
          {onBookIntro && (
            <Button
              className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] rounded-md"
              onClick={onBookIntro}
              disabled={!therapist.accepting_new}
            >
              <Video className="mr-2 h-5 w-5 shrink-0" />
              <span className="break-words">Online-Kennenlernen (15 min)</span>
            </Button>
          )}

          {onBookSession && !hideDirectBooking && (
            <Button
              variant="outline"
              className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-md"
              onClick={onBookSession}
              disabled={!therapist.accepting_new}
            >
              <CalendarCheck2 className="mr-2 h-5 w-5 shrink-0" />
              <span className="break-words">Sitzung buchen</span>
            </Button>
          )}
        </div>
      )}

      {/* Image viewer portal */}
      {mounted && imageViewerOpen && photoSrc && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-150 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößertes Profilbild"
          onClick={closeViewer}
        >
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 rounded-full bg-white shadow-md p-2 text-slate-700 transition hover:shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative w-[min(92vw,560px)] sm:w-[min(85vw,680px)] max-h-[85vh] rounded-2xl bg-white p-3 sm:p-4 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
                draggable={false}
              />
            </div>
            <div className="pt-3 text-center">
              <p className="text-base font-semibold text-slate-900">
                {therapist.first_name} {therapist.last_name}
              </p>
            </div>
            <div className="mt-2 text-center text-xs text-slate-500 sm:hidden">
              Tippe um zu schließen.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
