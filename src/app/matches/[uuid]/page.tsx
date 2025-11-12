import type { Metadata } from 'next';
import { MatchPageClient } from '@/features/matches/components/MatchPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Ihre persönlichen Empfehlungen – Kaufmann Health',
    description: 'Sehen Sie Ihre handverlesenen Therapie‑Empfehlungen und kontaktieren Sie Ihre bevorzugte Therapeut:in ohne erneute Verifizierung.',
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const id = (uuid || '').trim();
  if (!id) return null;
  return <MatchPageClient uuid={id} />;
}
