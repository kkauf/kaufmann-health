'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface CheckListProps {
  items: string[];
  variant?: 'positive' | 'negative';
}

export default function CheckList({ items, variant = 'positive' }: CheckListProps) {
  const containerRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-2');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );

    const els = Array.from(root.querySelectorAll('li[data-reveal]'));
    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const Icon = variant === 'negative' ? XCircle : CheckCircle2;
  const iconClass = variant === 'negative' ? 'text-rose-600' : 'text-emerald-600';

  return (
    <ul ref={containerRef} className="grid gap-3 sm:grid-cols-2">
      {items.map((text, idx) => (
        <li
          key={idx}
          data-reveal
          className="flex items-start gap-3 rounded-lg border bg-white p-4 text-gray-800 opacity-0 translate-y-2 transition-all duration-500 will-change-transform"
          style={{ transitionDelay: `${Math.min(idx, 6) * 60}ms` }}
        >
          <Icon className={`mt-0.5 h-5 w-5 ${iconClass} shrink-0`} aria-hidden="true" />
          <span className="text-sm sm:text-base">{text}</span>
        </li>
      ))}
    </ul>
  );
}
