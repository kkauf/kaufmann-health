'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, Calendar, MessageCircle, User } from 'lucide-react';
import type { TherapistData } from './TherapistDirectory';
import { ContactModal } from './ContactModal';

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

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="flex flex-1 flex-col p-4 sm:p-6">
        {/* Header with avatar and name */}
        <div className="mb-4 flex items-start gap-4">
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
            <h3 className="text-lg font-semibold text-gray-900">
              {therapist.first_name} {therapist.last_name}
            </h3>

            {/* Match quality badge (takes priority if provided) */}
            {matchBadge ? (
              <Badge className={matchBadge.className || "mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                {matchBadge.text}
              </Badge>
            ) : (
              /* Availability badge */
              <div className="mt-1">
                {therapist.accepting_new ? (
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
          <div className="mb-3 flex flex-wrap gap-2">
            {therapist.modalities.slice(0, 3).map((modality, idx) => {
              const { label, color } = getModalityDisplay(modality);
              return (
                <Badge
                  key={idx}
                  className={`${color} text-white hover:opacity-90`}
                >
                  {label}
                </Badge>
              );
            })}
            {therapist.modalities.length > 3 && (
              <Badge variant="secondary">
                +{therapist.modalities.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Location and format info */}
        <div className="mb-4 space-y-2 text-sm text-gray-600">
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
          <p className="mb-4 line-clamp-3 text-sm text-gray-700">
            {therapist.approach_text}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={onViewDetails}
          >
            Profil ansehen
          </Button>

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
