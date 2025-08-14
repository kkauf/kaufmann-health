import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">Kaufmann Health</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/therapie-finden">Therapie finden</Link>
          <Link href="/impressum">Impressum</Link>
          <Link href="/agb">AGB</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </nav>
      </div>
    </header>
  );
}
