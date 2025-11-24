'use client';

import { useState } from 'react';
import { ChevronDown, Brain, Activity, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const insights = [
  {
    icon: Brain,
    title: 'Nervensystem regulieren',
    short: 'Statt nur über Reaktionen zu sprechen',
    detail: 'Lerne, dein autonomes Nervensystem direkt zu beeinflussen – nicht durch Analyse, sondern durch körperliche Erfahrung und Präsenz.',
    color: 'indigo',
  },
  {
    icon: Activity,
    title: 'Blockaden lösen',
    short: 'Festgehaltene Überlebensenergie',
    detail: 'Traumatische Erfahrungen speichern sich als körperliche Anspannung. Somatische Techniken helfen, diese gebundene Energie sanft zu entladen.',
    color: 'cyan',
  },
  {
    icon: Heart,
    title: 'Verbindungen verstehen',
    short: 'Körper & Emotion',
    detail: 'Erkenne die Verbindung zwischen körperlichen Empfindungen und emotionalen Mustern – und wie dein Körper dir zeigt, was Worte nicht ausdrücken können.',
    color: 'rose',
  },
  {
    icon: Sparkles,
    title: 'Nachhaltige Veränderung',
    short: 'Körperlich integriert',
    detail: 'Das Ergebnis: Veränderung, die nicht nur intellektuell verstanden, sondern im Körper verankert wird – und dadurch dauerhaft bleibt.',
    color: 'emerald',
  },
];

const colorMap = {
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    icon: 'bg-indigo-100 text-indigo-600',
    active: 'ring-indigo-500/30',
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    icon: 'bg-cyan-100 text-cyan-600',
    active: 'ring-cyan-500/30',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: 'bg-rose-100 text-rose-600',
    active: 'ring-rose-500/30',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    active: 'ring-emerald-500/30',
  },
} as const;

function InsightCard({ insight, isOpen, onToggle, index }: {
  insight: typeof insights[0];
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const colors = colorMap[insight.color as keyof typeof colorMap];
  const Icon = insight.icon;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full text-left rounded-2xl border p-4 sm:p-5 transition-all duration-300',
        'hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isOpen ? `${colors.bg} ${colors.border} shadow-md ring-2 ${colors.active}` : 'bg-white border-slate-200/60 hover:border-slate-300',
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={cn('flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl transition-colors', colors.icon)}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-gray-900 text-base sm:text-lg">{insight.title}</h4>
            <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform duration-300 shrink-0', isOpen && 'rotate-180')} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{insight.short}</p>
          <div className={cn(
            'overflow-hidden transition-all duration-300',
            isOpen ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0',
          )}>
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{insight.detail}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function WhyBodyTherapySection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mt-14 sm:mt-20">
      <div className="rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white p-6 sm:p-10 lg:p-12 shadow-lg">
        {/* Header */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 mb-6">
          Warum Körperpsychotherapie?
        </h2>

        {/* Intro - two columns on desktop */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 mb-8 lg:mb-10">
          {/* Left: The problem */}
          <div className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Vielleicht hast du bereits Gesprächstherapie ausprobiert – und dich trotzdem in denselben Mustern wiedergefunden. Das liegt nicht daran, dass du nicht genug gearbeitet hast.
            </p>
            <p className="text-gray-900 font-medium leading-relaxed bg-amber-50/80 border border-amber-200/60 rounded-xl p-4">
              Trauma wird nicht als Geschichte im Gehirn gespeichert, sondern als körperliche Erfahrung im Nervensystem.
            </p>
          </div>

          {/* Right: The science */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 mt-0.5">
                <Brain className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-gray-700 leading-relaxed">
                <span className="font-medium text-gray-900">Die Neurowissenschaft zeigt:</span> Bei Angst, chronischer Anspannung, Überforderung oder Beziehungsproblemen ist dein Nervensystem oft in einem dauerhaften Alarmzustand – auch wenn keine aktuelle Gefahr besteht.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed pl-11">
              Körperpsychotherapie arbeitet dort, wo diese Muster tatsächlich verankert sind: in deinem Körper und Nervensystem.
            </p>
          </div>
        </div>

        {/* Interactive insights */}
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Was du lernst
          </p>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {insights.map((insight, i) => (
              <InsightCard
                key={insight.title}
                insight={insight}
                index={i}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
