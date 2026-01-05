/**
 * /booking/[therapistId] - In-domain Cal.com booking page (EARTH-256)
 *
 * WHY: Keep users on KH domain through slot selection, reducing drop-off
 * and preserving trust signals. Hand off to Cal only for final confirmation.
 *
 * Flow:
 * 1. User arrives with ?kind=intro|full_session&returnTo=...
 * 2. Shows therapist header + trust badges + price
 * 3. Day-first availability picker (Cal-backed)
 * 4. On slot selection → redirect to Cal with pre-selected slot
 * 5. After booking → Cal redirects back to /booking/confirmed → returnTo
 */

import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { THERAPIST_SELECT_COLUMNS } from '@/contracts/therapist';
import { mapTherapistRow } from '@/lib/therapist-mapper';
import { BookingPageClient } from './BookingPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; returnTo?: string; returnUI?: string }>;
}

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { id: therapistId } = await params;
  const { kind = 'intro', returnTo, returnUI } = await searchParams;

  // Validate kind
  const bookingKind = kind === 'full_session' ? 'full_session' : 'intro';

  // Fetch therapist
  const { data: row, error } = await supabaseServer
    .from('therapists')
    .select(THERAPIST_SELECT_COLUMNS)
    .eq('id', therapistId)
    .eq('status', 'verified')
    .single();

  if (error || !row) {
    notFound();
  }

  const therapist = mapTherapistRow(row);

  // Check if Cal.com is enabled
  if (!therapist.cal_enabled || !therapist.cal_username) {
    // Redirect to directory with fallback message
    // For now, show a fallback UI
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Online-Buchung nicht verfügbar
          </h1>
          <p className="text-gray-600 mb-4">
            {therapist.first_name} {therapist.last_name} hat die Online-Buchung noch nicht aktiviert.
          </p>
          <a
            href={`/therapeuten?therapist=${therapistId}&contact=consultation`}
            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Nachricht schreiben
          </a>
        </div>
      </div>
    );
  }

  return (
    <BookingPageClient
      therapist={therapist}
      bookingKind={bookingKind}
      returnTo={returnTo}
      returnUI={returnUI}
    />
  );
}
