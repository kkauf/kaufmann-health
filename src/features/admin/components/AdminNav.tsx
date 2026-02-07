"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminNav() {
  const pathname = usePathname() || '/admin';
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL('/api/admin/therapists', window.location.origin);
        url.searchParams.set('status', 'pending_verification');
        url.searchParams.set('limit', '200');
        const res = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) {
          const arr = Array.isArray(json?.data) ? json.data : [];
          setPendingCount(arr.length);
        }
      } catch {
        if (!cancelled) setPendingCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const linkCls = (href: string, exact = false) =>
    isActive(href, exact)
      ? 'font-semibold text-sm'
      : 'underline text-sm text-muted-foreground hover:text-foreground';

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/admin" className={linkCls('/admin', true)} aria-current={isActive('/admin', true) ? 'page' : undefined}>
          Admin
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/leads" className={linkCls('/admin/leads')} aria-current={isActive('/admin/leads') ? 'page' : undefined}>
            Leads
          </Link>
          <Link href="/admin/interactions" className={linkCls('/admin/interactions')} aria-current={isActive('/admin/interactions') ? 'page' : undefined}>
            Interaktionen
          </Link>
<Link href="/admin/therapists" className={linkCls('/admin/therapists')} aria-current={isActive('/admin/therapists') ? 'page' : undefined}>
            <span className="inline-flex items-center gap-2">
              Therapeuten
              {typeof pendingCount === 'number' && pendingCount > 0 ? (
                <span className="ml-1 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                  {pendingCount}
                </span>
              ) : null}
            </span>
          </Link>
          <Link href="/admin/errors" className={linkCls('/admin/errors')} aria-current={isActive('/admin/errors') ? 'page' : undefined}>
            Fehler
          </Link>
        </nav>
      </div>
    </header>
  );
}
