import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import RegistrationForm from './RegistrationForm';
import PageAnalytics from '@/components/PageAnalytics';

export const metadata: Metadata = {
  title: 'Als Therapeut:in registrieren | Kaufmann Health',
  description:
    'Registriere dich als Therapeut:in bei Kaufmann Health. Erfolgsbasierte Vermittlung von Selbstzahler:innen für körperorientierte Therapie.',
  alternates: { canonical: '/therapists/register' },
  robots: { index: false },
};

export default function TherapistRegisterPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white">
      <PageAnalytics qualifier="Therapeuten-Registrierung" />

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/fuer-therapeuten"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>

        {/* Progress indicator */}
        <OnboardingProgress currentStep={0} />

        {/* Header */}
        <h1 className="text-2xl font-semibold">Schritt 1: Registrierung</h1>
        <p className="mt-2 text-sm text-gray-700">
          Fülle das kurze Formular aus. Wir melden uns innerhalb von 48 Stunden.
        </p>

        {/* Info box */}
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            <span className="font-medium">So geht es weiter:</span> Nach der Registrierung erhältst du eine E-Mail mit Link zum Profil vervollständigen und Dokumenten-Upload.
          </p>
        </div>

        {/* Form */}
        <div className="mt-6 rounded-lg border bg-white p-6">
          <RegistrationForm />
        </div>

        {/* Already registered */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Bereits registriert?{' '}
          <Link href="/portal/login" className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
            Zum Mitglieder-Login
          </Link>
        </p>
      </div>
    </main>
  );
}
