'use client';

import { useEffect, useRef } from 'react';
import { buildEventId } from '@/lib/analytics';
import { getAttribution } from '@/lib/attribution';

interface Props {
  location: string; // e.g., "negative-qualifier"
  children: React.ReactNode;
}

export default function SectionViewTracker({ location, children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !sent.current) {
            sent.current = true;
            try {
              const id = buildEventId(
                typeof window !== 'undefined' ? window.location.pathname : '',
                location,
                'view'
              );
              const attrs = getAttribution();
              fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'section_view', id, title: id, ...attrs }),
                keepalive: true,
              }).catch(() => {});
            } catch {}
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [location]);

  return <div ref={ref}>{children}</div>;
}
