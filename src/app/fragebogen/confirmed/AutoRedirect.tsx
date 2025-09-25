'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRedirect({ href, delayMs = 2000 }: { href: string; delayMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      router.replace(href);
    }, delayMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [href, delayMs, router]);

  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      Wir leiten dich automatisch weiter …
    </p>
  );
}
