import AdminNav from './AdminNav';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced via middleware. We keep this layout dynamic to ensure per-request evaluation.
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
