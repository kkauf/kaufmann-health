import { Metadata } from 'next';
import { Suspense } from 'react';
import SignupWizard from '@/features/leads/components/SignupWizard';
import PageAnalytics from '@/components/PageAnalytics';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Fragebogen – Kaufmann Health',
  description: 'Finde in 3 Minuten passende Therapeut:innen für körperorientierte Psychotherapie. Persönlich ausgewählt, ohne Wartezeit.',
  alternates: { canonical: 'https://www.kaufmann-health.de/fragebogen' },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="min-h-[100svh] overscroll-contain max-w-2xl mx-auto px-4 py-8">
      <PageAnalytics />
      <ErrorBoundary>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Lade…</div>}>
          <SignupWizard />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
