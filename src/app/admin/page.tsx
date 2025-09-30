import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import AdminStats from '@/features/admin/components/AdminStats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    redirect('/admin/login');
  }
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold mb-2">Admin Dashboard</h1>
      <p className="text-muted-foreground">Schnellzugriff auf Leads, Matches und Fehler-Logs.</p>
      <div className="mt-6">
        <AdminStats />
      </div>

    </main>
  );
}


