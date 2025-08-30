"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname() || '/admin';

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
          <Link href="/admin/matches" className={linkCls('/admin/matches')} aria-current={isActive('/admin/matches') ? 'page' : undefined}>
            Matches
          </Link>
          <Link href="/admin/errors" className={linkCls('/admin/errors')} aria-current={isActive('/admin/errors') ? 'page' : undefined}>
            Fehler
          </Link>
        </nav>
      </div>
    </header>
  );
}
