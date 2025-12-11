'use client';

import { useState } from 'react';
import Link from 'next/link';
import TherapistPreview, { type Therapist } from "@/components/TherapistPreview";
import { TherapistDetailModal } from '@/features/therapists/components/TherapistDetailModal';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function TherapistTeaserClient({
  therapists,
  title,
  subtitle,
  className,
  showViewAllButton = false,
  viewAllButtonText = "Alle Therapeut:innen ansehen",
  viewAllButtonHref = "/therapeuten",
  showSchwerpunkte = false,
}: {
  therapists: Therapist[];
  title: string;
  subtitle?: string;
  className?: string;
  showViewAllButton?: boolean;
  viewAllButtonText?: string;
  viewAllButtonHref?: string;
  /** When true, show schwerpunkte badges instead of modality badges */
  showSchwerpunkte?: boolean;
}) {
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistData | null>(null);
  const [scrollTarget, setScrollTarget] = useState<string | undefined>(undefined);

  const handleViewDetails = (therapist: Therapist, modalityId?: string) => {
    // Convert to TherapistData format for the modal
    const therapistData: TherapistData = {
      id: therapist.id,
      first_name: therapist.first_name,
      last_name: therapist.last_name,
      city: therapist.city,
      modalities: therapist.modalities,
      schwerpunkte: therapist.schwerpunkte || [],
      accepting_new: therapist.accepting_new,
      photo_url: therapist.photo_url,
      approach_text: therapist.approach_text,
      session_preferences: [],
      metadata: undefined,
    };
    setScrollTarget(modalityId);
    setSelectedTherapist(therapistData);
  };

  return (
    <>
      <section aria-labelledby="trust-previews" className={(className ? className + " " : "") + "mt-14 sm:mt-20 lg:mt-24"}>
        <h2 id="trust-previews" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-700">{subtitle}</p> : null}
        <div className="mt-8 sm:mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {therapists.map((t) => (
            <div
              key={t.id}
              onClick={(e) => {
                // Check if click was on a modality badge
                const target = e.target as HTMLElement;
                const badge = target.closest('[data-modality-id]');
                if (badge) {
                  const modalityId = badge.getAttribute('data-modality-id');
                  handleViewDetails(t, modalityId || undefined);
                } else {
                  handleViewDetails(t);
                }
              }}
              className="cursor-pointer transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl"
              aria-label={`Profil von ${t.first_name} ${t.last_name} ansehen`}
            >
              <TherapistPreview therapist={t} showSchwerpunkte={showSchwerpunkte} />
            </div>
          ))}
        </div>
        
        {showViewAllButton && (
          <div className="mt-8 sm:mt-10 flex justify-center">
            <Button asChild size="lg" variant="outline" className="group">
              <Link href={viewAllButtonHref}>
                {viewAllButtonText}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* Detail modal */}
      {selectedTherapist && (
        <TherapistDetailModal
          therapist={selectedTherapist}
          open={!!selectedTherapist}
          onClose={() => {
            setSelectedTherapist(null);
            setScrollTarget(undefined);
          }}
          initialScrollTarget={scrollTarget}
          onOpenContactModal={() => {
            // No-op for landing page teaser - users should go to directory for booking
          }}
        />
      )}
    </>
  );
}
