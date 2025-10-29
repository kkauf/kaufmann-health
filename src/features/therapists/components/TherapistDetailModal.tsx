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
import { MapPin, Video, User, Calendar, MessageCircle, Globe, ShieldCheck, HeartHandshake, Shell, Wind, Target, CalendarCheck2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
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
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
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
    setMounted(true);
  }, []);

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
      } catch {}
    }
  };

  const closeViewer = () => {
    setImageViewerOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
            className={`h-32 w-32 shrink-0 ring-4 ring-gray-100 transition-all duration-200 ${
              photoSrc ? 'cursor-pointer hover:ring-emerald-300 hover:ring-offset-2 hover:shadow-lg' : ''
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
      
      {/* Image viewer (card-like, tap-to-close anywhere via portal) */}
      {mounted && imageViewerOpen && photoSrc && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-150 cursor-zoom-out"
          onClick={closeViewer}
          onPointerUp={closeViewer}
          onPointerDown={closeViewer}
          onPointerDownCapture={closeViewer}
          onMouseDown={closeViewer}
          onTouchStart={closeViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Vergrößertes Profilbild"
        >
          {/* Close button */}
          <button
            onClick={closeViewer}
            className="absolute top-4 right-4 z-[10000] rounded-full bg-white shadow-md p-2 text-slate-700 transition hover:shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Card container */}
          <div
            className="relative w-[min(92vw,560px)] sm:w-[min(85vw,680px)] max-h-[85vh] rounded-2xl bg-white p-3 sm:p-4 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200 flex flex-col cursor-zoom-out overflow-hidden"
            onClick={closeViewer}
            onPointerUp={closeViewer}
            onPointerDown={closeViewer}
            onMouseDown={closeViewer}
            onTouchStart={closeViewer}
            tabIndex={0}
          >
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              <img
                src={photoSrc}
                alt={`${therapist.first_name} ${therapist.last_name}`}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain cursor-zoom-out"
                onClick={closeViewer}
                onPointerUp={closeViewer}
                onPointerDown={closeViewer}
                onMouseDown={closeViewer}
                onTouchStart={closeViewer}
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
              Tippen irgendwo, um zu schließen
            </div>
          </div>
        </div>,
        document.body
      )}
      
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
