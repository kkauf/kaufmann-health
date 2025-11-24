'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function Header() {
  const [open, setOpen] = React.useState(false)
  const closeBtnRef = React.useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = React.useState(false)
  const pathname = usePathname()
  const [entryLanding] = React.useState<string | null>(() => {
    if (pathname === '/start' || pathname === '/therapie-finden') {
      return pathname
    }
    return null
  })
  const logoHref = entryLanding ?? '/start'

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
      <Link onClick={onClick} className="hover:text-gray-900 transition-colors duration-150 whitespace-nowrap" href="/therapeuten">
        Unsere Therapeuten
      </Link>
      <Link onClick={onClick} className="hover:text-gray-900 transition-colors duration-150 whitespace-nowrap" href="/therapie">
        Therapieverfahren
      </Link>
      <Link onClick={onClick} className="hover:text-gray-900 transition-colors duration-150 whitespace-nowrap" href="/fuer-therapeuten">
        Für Therapeut:innen
      </Link>
      <Link onClick={onClick} className="hover:text-gray-900 transition-colors duration-150 whitespace-nowrap" href="/ueber-uns">
        Über uns
      </Link>
    </>
  )

  return (
    <>
    <header className={`sticky top-0 z-[120] isolate border-b border-gray-200/60 shadow-sm ${open ? 'bg-white' : 'bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80'}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 md:h-18 items-center justify-between">
          {/* Logo */}
          <Link href={logoHref} className="inline-flex items-center hover:opacity-80 transition-opacity duration-200" aria-label="Kaufmann Health Startseite">
            <Image
              src="/logos/Health Logos - black/Kaufmann_health_logo.svg"
              alt="Kaufmann Health"
              width={200}
              height={40}
              priority
              className="h-7 w-auto md:h-10 lg:h-11"
            />
          </Link>

          {/* Desktop nav */}
          <nav
            aria-label="Hauptnavigation"
            className="hidden items-center gap-8 text-sm font-medium text-gray-700 lg:flex"
          >
            <NavLinks />
            <Button asChild size="sm" className="ml-3 h-10 px-5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200">
              <Link href="/fragebogen">Therapeut:in finden</Link>
            </Button>
          </nav>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
              className="h-10 w-10 hover:bg-gray-100 transition-colors"
            >
              {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

    </header>

    {mounted && createPortal(
      <>
        {/* Mobile overlay (portal) */}
        <div
          className={`fixed inset-0 z-[10000] transition-opacity duration-300 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          aria-hidden={!open}
          onClick={() => setOpen(false)}
          style={{ touchAction: 'none' }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>

        {/* Mobile panel (portal) */}
        <aside
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          className={`fixed inset-y-0 right-0 z-[10001] w-80 translate-x-full bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? '!translate-x-0' : ''}`}
        >
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200/60 bg-gradient-to-br from-slate-50 to-white px-5">
            <span className="text-base font-bold text-gray-900">Menü</span>
            <Button
              ref={closeBtnRef}
              variant="ghost"
              size="icon"
              aria-label="Menü schließen"
              onClick={() => setOpen(false)}
              className="h-10 w-10 hover:bg-gray-100 transition-colors"
            >
              <X aria-hidden className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav aria-label="Mobile Hauptnavigation" className="flex flex-col gap-2 px-4 py-6">
            <div className="flex flex-col gap-1 text-base font-medium text-gray-700">
              <Link
                onClick={() => setOpen(false)}
                href="/therapeuten"
                className="px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Unsere Therapeuten
              </Link>
              <Link
                onClick={() => setOpen(false)}
                href="/therapie"
                className="px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Therapieverfahren
              </Link>
              <Link
                onClick={() => setOpen(false)}
                href="/fuer-therapeuten"
                className="px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Für Therapeut:innen
              </Link>
              <Link
                onClick={() => setOpen(false)}
                href="/ueber-uns"
                className="px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Über uns
              </Link>
            </div>

            <Button asChild className="mt-4 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
              <Link href="/fragebogen">Therapeut:in finden</Link>
            </Button>
          </nav>
        </aside>
      </>,
      document.body
    )}

    </>
  )
}
