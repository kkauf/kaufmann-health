'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function Header() {
  const [open, setOpen] = React.useState(false)
  const closeBtnRef = React.useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = React.useState(false)

  // Close on Escape and lock scroll when menu is open
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      // Focus close button when opening
      closeBtnRef.current?.focus()
      return () => {
        document.body.style.overflow = prev
        document.removeEventListener('keydown', onKey)
      }
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Enable portals only on client to avoid SSR issues
  React.useEffect(() => setMounted(true), [])

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      <Link onClick={onClick} className="hover:opacity-80" href="/fuer-therapeuten">
        Für Therapeuten
      </Link>
      <Link onClick={onClick} className="hover:opacity-80" href="/therapie-finden">
        Therapie finden
      </Link>
      <Link onClick={onClick} className="hover:opacity-80" href="/ueber-uns">
        Über uns
      </Link>
    </>
  )

  return (
    <>
    <header className={`sticky top-0 z-[120] isolate border-b ${open ? 'bg-white' : 'bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60'}`}>
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Kaufmann Health
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Hauptnavigation"
            className="hidden items-center gap-6 text-sm text-foreground/90 md:flex"
          >
            <NavLinks />
            <Button asChild size="sm" className="ml-2">
              <Link href="/therapie-finden">Kostenlos starten</Link>
            </Button>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            </Button>
          </div>
        </div>
      </div>

    </header>

    {mounted && createPortal(
      <>
        {/* Mobile overlay (portal) */}
        <div
          className={`fixed inset-0 z-[10000] transition-opacity ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={!open}
          onClick={() => setOpen(false)}
          style={{ touchAction: 'none' }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Mobile panel (portal) */}
        <aside
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          className={`fixed inset-y-0 right-0 z-[10001] w-72 translate-x-full bg-white shadow-xl transition-transform duration-200 ease-out ${open ? '!translate-x-0' : ''}`}
        >
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Menü</span>
            <Button
              ref={closeBtnRef}
              variant="ghost"
              size="icon"
              aria-label="Menü schließen"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </div>
          <nav aria-label="Mobile Hauptnavigation" className="flex flex-col gap-4 px-4 py-6 text-[15px]">
            <NavLinks onClick={() => setOpen(false)} />
            <Button asChild className="mt-2">
              <Link href="/therapie-finden">Kostenlos starten</Link>
            </Button>
          </nav>
        </aside>
      </>,
      document.body
    )}

    </>
  )
}
