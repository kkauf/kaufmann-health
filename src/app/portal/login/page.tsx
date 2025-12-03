import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import TherapistLoginForm from '@/features/leads/components/TherapistLoginForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { verifyTherapistSessionToken, getTherapistSessionCookieName } from '@/lib/auth/therapistSession';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Therapeuten-Login | Kaufmann Health',
  description: 'Melde dich an, um dein Therapeuten-Profil bei Kaufmann Health zu bearbeiten.',
  robots: { index: false, follow: false },
};

export default async function TherapistLoginPage() {
  // If user already has a valid session, redirect to portal
  const cookieStore = await cookies();
  const cookieName = getTherapistSessionCookieName();
  const cookieValue = cookieStore.get(cookieName)?.value;
  
  if (cookieValue) {
    const payload = await verifyTherapistSessionToken(cookieValue);
    if (payload?.therapist_id) {
      redirect('/portal');
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Therapeuten-Portal
          </h1>
          <p className="mt-2 text-gray-600">
            Melde dich an, um dein Profil zu bearbeiten
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Login per E-Mail
            </h2>
            <p className="text-sm text-gray-600">
              Gib deine E-Mail-Adresse ein und wir senden dir einen sicheren Login-Link.
            </p>
          </div>

          <TherapistLoginForm />
        </div>

        <div className="mt-6 text-center">
          <Link 
            href="/fuer-therapeuten" 
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Therapeuten-Seite
          </Link>
        </div>
      </div>
    </main>
  );
}
