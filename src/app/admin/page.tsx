import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import AdminStats from '@/features/admin/components/AdminStats';
import { AdminQuickActions } from '@/features/admin/components/AdminQuickActions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    redirect('/admin/login');
  }
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-base text-gray-600">Schnellzugriff auf Leads, Matches und Fehler-Logs.</p>
        </header>

        <AdminQuickActions />

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <AdminStats />
        </div>
      </div>
    </main>
  );
}


