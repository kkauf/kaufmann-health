import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { mapTherapistRow, parseTherapistRow, THERAPIST_SELECT_COLUMNS } from '@/lib/therapist-mapper';
import { buildTherapistJsonLd } from '@/lib/therapist-jsonld';
import { getCachedCalSlots } from '@/lib/cal/slots-cache';
import type { NextIntroSlot, NextFullSlot } from '@/contracts/therapist';
import { TherapistProfilePage } from './TherapistProfilePage';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const { data } = await supabaseServer
    .from('therapists')
    .select(`${THERAPIST_SELECT_COLUMNS}, slug`)
    .eq('slug', slug)
    .eq('status', 'verified')
    .single();

  if (!data) {
    return {
      title: 'Therapeut:in nicht gefunden – Kaufmann Health',
      robots: { index: false, follow: false },
    };
  }

  const row = parseTherapistRow(data);
  const therapist = mapTherapistRow(row);
  const fullName = `${therapist.first_name} ${therapist.last_name}`;
  const modalityList = (therapist.modalities || []).join(', ');
  
  const title = `${fullName} – ${modalityList || 'Körperpsychotherapie'} in ${therapist.city}`;
  const description = therapist.metadata?.profile?.who_comes_to_me 
    || therapist.approach_text?.slice(0, 155) 
    || `${fullName} ist Therapeut:in für Körperpsychotherapie in ${therapist.city}. Jetzt Profil ansehen und Termin buchen.`;

  const canonical = `${baseUrl}/therapeuten/${slug}`;

  return {
    title,
    description: description.slice(0, 160),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description: description.slice(0, 160),
      url: canonical,
      type: 'profile',
      images: therapist.photo_url ? [{ url: therapist.photo_url }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description: description.slice(0, 160),
    },
  };
}

export default async function TherapistProfileRoute({ params }: PageProps) {
  const { slug } = await params;

  const { data, error } = await supabaseServer
    .from('therapists')
    .select(`${THERAPIST_SELECT_COLUMNS}, slug`)
    .eq('slug', slug)
    .eq('status', 'verified')
    .single();

  if (error || !data) {
    notFound();
  }

  const row = parseTherapistRow(data);
  
  // Fetch Cal.com slot data for booking availability
  let nextIntroSlot: NextIntroSlot | undefined;
  let nextFullSlot: NextFullSlot | undefined;
  
  if (row.cal_enabled && row.cal_username) {
    const calSlotsCache = await getCachedCalSlots([row.id]);
    const cached = calSlotsCache.get(row.id);
    
    if (cached?.next_intro_date_iso && cached?.next_intro_time_label && cached?.next_intro_time_utc) {
      nextIntroSlot = {
        date_iso: cached.next_intro_date_iso,
        time_label: cached.next_intro_time_label,
        time_utc: cached.next_intro_time_utc,
      };
    }
    if (cached?.next_full_date_iso && cached?.next_full_time_label && cached?.next_full_time_utc) {
      nextFullSlot = {
        date_iso: cached.next_full_date_iso,
        time_label: cached.next_full_time_label,
        time_utc: cached.next_full_time_utc,
      };
    }
  }
  
  const therapist = mapTherapistRow(row, { nextIntroSlot, nextFullSlot });
  
  // Build JSON-LD
  const { personSchema, medicalBusinessSchema } = buildTherapistJsonLd(therapist, {
    baseUrl,
    slug,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(medicalBusinessSchema) }}
      />
      <TherapistProfilePage therapist={therapist} slug={slug} />
    </>
  );
}
