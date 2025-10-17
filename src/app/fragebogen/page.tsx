import { Metadata } from 'next';
import { Suspense } from 'react';
import SignupWizard from '@/features/leads/components/SignupWizard';
import PageAnalytics from '@/components/PageAnalytics';

export const metadata: Metadata = {
  title: 'Fragebogen – Kaufmann Health',
  description: 'Email-First Fragebogen mit progressiver Vertrauensbildung',
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="min-h-[100svh] overscroll-contain max-w-2xl mx-auto px-4 py-8">
      <PageAnalytics />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Lade…</div>}>
        <SignupWizard />
      </Suspense>
    </div>
  );
}
