'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

const statements = [
  'Ich habe in der Therapie viel verstanden, aber die Muster wiederholen sich trotzdem.',
  'Der Kopf weiß, was zu tun ist — der Körper macht nicht mit.',
  'Nach Jahren Gesprächstherapie fehlt noch etwas.',
  'Ich spüre: Es braucht einen anderen Ansatz.',
];

export default function RecognitionChips() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
      {statements.map((text, idx) => {
        const isActive = selected.has(idx);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            className={cn(
              'group relative px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl border-2 text-left text-sm sm:text-base transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
              'hover:shadow-md hover:-translate-y-0.5',
              isActive
                ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-md'
                : 'border-slate-200 bg-white text-gray-700 hover:border-teal-300'
            )}
          >
            <span className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-teal-500 text-white scale-110'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-teal-100 group-hover:text-teal-500'
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className="leading-snug">{text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
