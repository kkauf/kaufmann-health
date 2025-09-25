import { Metadata } from 'next';
import { Suspense } from 'react';
import SignupWizard from '@/features/leads/components/SignupWizard';

export const metadata: Metadata = {
  title: 'Fragebogen – Kaufmann Health',
  description: 'Email-First Fragebogen mit progressiver Vertrauensbildung',
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Lade…</div>}>
        <SignupWizard />
      </Suspense>
    </div>
  );
}
