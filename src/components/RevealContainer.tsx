'use client';

import { useEffect, useRef } from 'react';

interface RevealContainerProps {
  children: React.ReactNode;
}

// Applies a subtle entrance reveal to any direct or nested elements
// inside that have the attribute data-reveal.
export default function RevealContainer({ children }: RevealContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.add('opacity-100', 'translate-y-0');
            el.classList.remove('opacity-0', 'translate-y-2');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );

    const els = Array.from(root.querySelectorAll('[data-reveal]'));
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
