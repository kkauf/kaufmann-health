import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Bestätigung | Kaufmann Health',
  description: 'E-Mail-Bestätigung für Klient:innen.',
  robots: { index: false, follow: false },
};
 
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const state = typeof sp?.state === 'string' ? sp.state : undefined;
  const id = typeof sp?.id === 'string' ? sp.id : undefined;
  const fs = typeof sp?.fs === 'string' ? sp.fs : undefined;
  const confirm = state === 'success' ? '1' : state === 'expired' ? 'expired' : state === 'invalid' ? 'invalid' : 'error';
  const params = new URLSearchParams();
  params.set('confirm', confirm);
  if (id) params.set('id', id);
  if (fs) params.set('fs', fs);
  redirect(`/fragebogen?${params.toString()}`);
}
