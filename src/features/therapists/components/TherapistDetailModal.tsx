'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Video, User, Calendar, MessageCircle, Mail, Globe } from 'lucide-react';
import type { TherapistData } from './TherapistDirectory';
import CtaLink from '@/components/CtaLink';

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

export function TherapistDetailModal({ therapist, open, onClose }: TherapistDetailModalProps) {
  const [imageError, setImageError] = useState(false);
  const photoSrc = therapist.photo_url && !imageError ? therapist.photo_url : undefined;
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 70%, 50%)`;

  const sessionPrefs = therapist.session_preferences || [];
  const offersOnline = Array.isArray(sessionPrefs) && sessionPrefs.includes('online');
  const offersInPerson = Array.isArray(sessionPrefs) && sessionPrefs.includes('in_person');

  const profile = therapist.metadata?.profile;
  const languages = profile?.languages || [];
  const yearsExperience = profile?.years_experience;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
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

            {/* Availability */}
            <div className="mt-2">
              {therapist.accepting_new ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Neue Klient:innen: Verfügbar
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                  Derzeit keine Kapazität
                </Badge>
              )}
            </div>

            {/* Quick info */}
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <MapPin className="h-4 w-4" />
                <span>{therapist.city}</span>
              </div>

              {(offersOnline || offersInPerson) && (
                <div className="flex items-center justify-center gap-3 sm:justify-start">
                  {offersOnline && (
                    <div className="flex items-center gap-1">
                      <Video className="h-4 w-4" />
                      <span>Online-Therapie</span>
                    </div>
                  )}
                  {offersInPerson && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>Vor-Ort-Therapie</span>
                    </div>
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
            className="!h-11 min-w-0 flex-1 bg-emerald-600 hover:bg-emerald-700"
            size="lg"
            asChild
            disabled={!therapist.accepting_new}
          >
            <CtaLink
              href="/fragebogen"
              eventType="cta_click"
              data-cta="book-therapist-modal"
              data-therapist-id={therapist.id}
              className="!flex !h-11 !min-h-[44px] !min-w-0 !items-center !justify-center !whitespace-normal !text-center"
            >
              <Calendar className="mr-2 h-5 w-5 shrink-0" />
              <span className="break-words">Therapeut:in buchen</span>
            </CtaLink>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="!h-11 min-w-0 flex-1"
            asChild
            disabled={!therapist.accepting_new}
          >
            <CtaLink
              href="/fragebogen"
              eventType="cta_click"
              data-cta="request-consultation-modal"
              data-therapist-id={therapist.id}
              className="!flex !h-11 !min-h-[44px] !min-w-0 !items-center !justify-center !whitespace-normal !text-center"
            >
              <MessageCircle className="mr-2 h-5 w-5 shrink-0" />
              <span className="break-words">Kostenloses Erstgespräch (15 min)</span>
            </CtaLink>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
