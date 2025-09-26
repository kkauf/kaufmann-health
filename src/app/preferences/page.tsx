import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Präferenzen | Kaufmann Health',
  description: 'Sag uns kurz, was dir wichtig ist – wir finden passende Empfehlungen.',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const id = typeof sp?.id === 'string' ? sp.id : undefined;
  const fs = typeof sp?.fs === 'string' ? sp.fs : undefined;
  const params = new URLSearchParams();
  params.set('confirm', '1');
  if (id) params.set('id', id);
  if (fs) params.set('fs', fs);
  redirect(`/fragebogen?${params.toString()}`);
}
