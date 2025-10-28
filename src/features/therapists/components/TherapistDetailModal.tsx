'use client';

import { useEffect, useState } from 'react';
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
import { MapPin, Video, User, Calendar, MessageCircle, Globe, ShieldCheck, HeartHandshake, Shell, Wind, Target, CalendarCheck2 } from 'lucide-react';
import type { TherapistData } from './TherapistDirectory';
import { ContactModal } from './ContactModal';
import { getAttribution } from '@/lib/attribution';

interface TherapistDetailModalProps {
  therapist: TherapistData;
  open: boolean;
  onClose: () => void;
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

const MODALITY_MAP: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  'narm': { label: 'NARM', cls: 'border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100', Icon: HeartHandshake },
  'somatic-experiencing': { label: 'Somatic Experiencing', cls: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100', Icon: Shell },
  'hakomi': { label: 'Hakomi', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100', Icon: Wind },
  'core-energetics': { label: 'Core Energetics', cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:border-fuchsia-300 hover:bg-fuchsia-100', Icon: Target },
};

function normalizeModality(m: string): string {
  return m.toLowerCase().replace(/\s+/g, '-');
}

function getModalityDisplay(m: string): { label: string; cls: string; Icon: React.ElementType } {
  const normalized = normalizeModality(m);
  return MODALITY_MAP[normalized] || { label: m, cls: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100', Icon: Target };
}

export function TherapistDetailModal({ therapist, open, onClose }: TherapistDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactType, setContactType] = useState<'booking' | 'consultation'>('booking');
  
  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];
  const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
  const offersInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');

  const profile = therapist.metadata?.profile;
  const languages = profile?.languages || [];
  const yearsExperience = profile?.years_experience;
  
  const handleContactClick = (type: 'booking' | 'consultation') => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type: 'contact_cta_clicked', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: type } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {}
    setContactType(type);
    setContactModalOpen(true);
  };

  useEffect(() => {
    if (open) {
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = { type: 'profile_modal_opened', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {}
    }
  }, [open, therapist.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="sr-only">
            Profil von {therapist.first_name} {therapist.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Hero section with avatar and basic info */}
        <div className="flex flex-col items-center gap-4 border-b pb-6 sm:flex-row sm:items-start">
          <Avatar className="h-32 w-32 shrink-0 ring-4 ring-gray-100">
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

            {/* Trust + Availability */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
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

            {/* Quick info */}
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <MapPin className="h-4 w-4" />
                <span>{therapist.city}</span>
              </div>

              {(offersOnline || offersInPerson) && (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
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

              {yearsExperience && (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <Globe className="h-4 w-4" />
                  <span>{yearsExperience} Jahre Erfahrung</span>
                </div>
              )}

              {languages.length > 0 && (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <MessageCircle className="h-4 w-4" />
                  <span>Sprachen: {languages.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modalities */}
        {therapist.modalities && therapist.modalities.length > 0 && (
          <div className="border-b pb-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Modalitäten</h3>
            <div className="flex flex-wrap gap-2">
              {therapist.modalities.map((modality, idx) => {
                const { label, cls, Icon } = getModalityDisplay(modality);
                return (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={`rounded-full gap-1.5 shadow-sm ${cls} transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md active:shadow-sm active:translate-y-0`}
                  >
                    <Icon className="h-3 w-3 opacity-90" />
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Approach text */}
        {therapist.approach_text && (
          <div className="border-b pb-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Über mich & meinen Ansatz</h3>
            <div className="prose prose-sm max-w-none overflow-wrap-anywhere text-gray-700">
              {therapist.approach_text.split('\n').map((paragraph, idx) => (
                paragraph.trim() && <p key={idx} className="mb-3 break-words">{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="sticky bottom-0 flex flex-col gap-3 bg-white pt-4 sm:flex-row">
          <Button
            className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] rounded-md"
            onClick={() => handleContactClick('booking')}
            disabled={!therapist.accepting_new}
          >
            <Calendar className="mr-2 h-5 w-5 shrink-0" />
            <span className="break-words">Therapeut:in buchen</span>
          </Button>

          <Button
            variant="outline"
            className="h-12 sm:h-14 min-w-0 flex-1 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-md"
            onClick={() => handleContactClick('consultation')}
            disabled={!therapist.accepting_new}
          >
            <MessageCircle className="mr-2 h-5 w-5 shrink-0" />
            <span className="break-words">Kostenloses Erstgespräch (15 min)</span>
          </Button>
        </div>
      </DialogContent>
      
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
    </Dialog>
  );
}
