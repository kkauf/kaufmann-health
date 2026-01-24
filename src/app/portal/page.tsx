import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase-server';
import { verifyTherapistSessionToken, getTherapistSessionCookieName } from '@/lib/auth/therapistSession';
import EditProfileForm from './EditProfileForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mein Profil | Therapeuten-Portal | Kaufmann Health',
  description: 'Bearbeite dein Therapeuten-Profil bei Kaufmann Health.',
  robots: { index: false, follow: false },
};

type TherapistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  city: string | null;
  accepting_new: boolean | null;
  session_preferences: string[] | null;
  typical_rate: number | null;
  modalities: string[] | null;
  schwerpunkte: string[] | null;
  languages: string[] | null;
  metadata: Record<string, unknown> | null;
};

async function getTherapistData(therapistId: string): Promise<TherapistRow | null> {
  const { data, error } = await supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, email, photo_url, city, accepting_new, session_preferences, typical_rate, modalities, schwerpunkte, languages, metadata')
    .eq('id', therapistId)
    .eq('status', 'verified')
    .single();

  if (error || !data) return null;
  return data as TherapistRow;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieName = getTherapistSessionCookieName();
  
  let therapistId: string | null = null;

  // If token in URL, redirect to auth route handler which will set the cookie
  if (params.token) {
    redirect(`/portal/auth?token=${encodeURIComponent(params.token)}`);
  }

  // Check cookie for existing session
  const cookieValue = cookieStore.get(cookieName)?.value;
  if (cookieValue) {
    const payload = await verifyTherapistSessionToken(cookieValue);
    if (payload?.therapist_id) {
      therapistId = payload.therapist_id;
      // therapistName available but unused - keep for future use
      void payload.name;
    }
  }

  // No valid session - redirect to login
  if (!therapistId) {
    redirect('/portal/login');
  }

  // Fetch therapist data
  const therapist = await getTherapistData(therapistId);
  
  // Therapist not found or not verified - redirect
  if (!therapist) {
    redirect('/portal/login');
  }

  // Extract profile metadata
  const profileMeta = therapist.metadata?.profile as Record<string, unknown> | undefined;
  
  // Extract new structured profile fields
  const whoComesToMe = typeof profileMeta?.who_comes_to_me === 'string' ? profileMeta.who_comes_to_me : '';
  const sessionFocus = typeof profileMeta?.session_focus === 'string' ? profileMeta.session_focus : '';
  const firstSession = typeof profileMeta?.first_session === 'string' ? profileMeta.first_session : '';
  const aboutMe = typeof profileMeta?.about_me === 'string' ? profileMeta.about_me : '';
  
  // Legacy approach_text (read-only if present and no new fields filled)
  const legacyApproachText = typeof profileMeta?.approach_text === 'string' ? profileMeta.approach_text : '';
  // Only show legacy text if it exists AND the new fields are empty (hasn't migrated yet)
  const showLegacy = legacyApproachText && !whoComesToMe && !sessionFocus && !firstSession && !aboutMe;
  
  // Extract structured address fields (with fallback parsing for legacy data)
  let practiceStreet = typeof profileMeta?.practice_street === 'string' ? profileMeta.practice_street : '';
  let practicePostalCode = typeof profileMeta?.practice_postal_code === 'string' ? profileMeta.practice_postal_code : '';
  let practiceCity = typeof profileMeta?.practice_city === 'string' ? profileMeta.practice_city : '';
  
  // If no structured fields, try to parse from legacy practice_address
  if (!practiceStreet && !practicePostalCode && !practiceCity) {
    const legacyAddress = typeof profileMeta?.practice_address === 'string' ? profileMeta.practice_address : '';
    if (legacyAddress) {
      // Try to parse "Street 123, 12345 City" format
      const parts = legacyAddress.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        practiceStreet = parts[0];
        // Try to extract postal code and city from remaining parts
        const lastPart = parts.slice(1).join(', ').trim();
        const plzMatch = lastPart.match(/^(\d{5})\s+(.+)$/);
        if (plzMatch) {
          practicePostalCode = plzMatch[1];
          practiceCity = plzMatch[2];
        } else {
          practiceCity = lastPart;
        }
      } else {
        practiceStreet = legacyAddress;
      }
    }
  }

  // Prepare initial data for the form
  const initialData = {
    // Identity fields for preview
    first_name: therapist.first_name || '',
    last_name: therapist.last_name || '',
    photo_url: therapist.photo_url || undefined,
    // New structured profile fields
    who_comes_to_me: whoComesToMe,
    session_focus: sessionFocus,
    first_session: firstSession,
    about_me: aboutMe,
    // Legacy field (only if hasn't migrated to new fields)
    approach_text_legacy: showLegacy ? legacyApproachText : undefined,
    session_preferences: Array.isArray(therapist.session_preferences) ? therapist.session_preferences : [],
    modalities: Array.isArray(therapist.modalities) ? therapist.modalities : [],
    schwerpunkte: Array.isArray(therapist.schwerpunkte) ? therapist.schwerpunkte : [],
    typical_rate: therapist.typical_rate ?? undefined,
    practice_street: practiceStreet,
    practice_postal_code: practicePostalCode,
    practice_city: practiceCity,
    accepting_new: therapist.accepting_new ?? true,
    city: therapist.city || '',
    languages: Array.isArray(therapist.languages) ? therapist.languages : ['Deutsch'],
  };

  const displayName = [therapist.first_name, therapist.last_name].filter(Boolean).join(' ') || therapist.email;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Mein Profil
        </h1>
        <p className="mt-2 text-gray-600">
          Willkommen zurück, {displayName}
        </p>
      </div>

      <EditProfileForm
        therapistId={therapist.id}
        initialData={initialData}
      />
    </main>
  );
}
