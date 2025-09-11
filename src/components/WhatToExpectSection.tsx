import SectionViewTracker from '@/components/SectionViewTracker';
import RevealContainer from '@/components/RevealContainer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Leaf, Compass, Heart } from 'lucide-react';

interface Item {
  title: string;
  bullets: string[];
  icon?: React.ReactNode;
  delayMs?: number;
}

interface Props {
  title?: string;
  items?: Item[];
  trackLocation?: string;
  headingId?: string;
  className?: string;
}

const defaultItems: Item[] = [
  {
    icon: <Leaf className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
    title: 'Raum zum Ankommen',
    bullets: ['Zeit ohne Leistungsdruck', 'Dein Tempo, deine Themen', 'Es kommen die Themen, die kommen wollen'],
    delayMs: 0,
  },
  {
    icon: <Compass className="h-5 w-5 text-sky-600" aria-hidden="true" />,
    title: 'Körper als Kompass',
    bullets: ['Wieder spüren lernen, was du brauchst', 'Körpersignale verstehen und nutzen', 'Vom Kopf zurück ins Gefühl'],
    delayMs: 60,
  },
  {
    icon: <Heart className="h-5 w-5 text-rose-600" aria-hidden="true" />,
    title: 'Echte Verbindung',
    bullets: ['Therapeut:innen, die dir auf Augenhöhe begegnen', 'Authentische gemeinsame Arbeit statt Behandlung', 'Raum für alles, was du jahrelang weggedrückt hast'],
    delayMs: 120,
  },
];

export default function WhatToExpectSection({
  title = 'Was dich erwartet',
  items = defaultItems,
  trackLocation = 'what-to-expect',
  headingId = 'expect-heading',
  className = '',
}: Props) {
  return (
    <SectionViewTracker location={trackLocation}>
      <section aria-labelledby={headingId} className={`mt-10 sm:mt-14 ${className}`}>
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>

        <RevealContainer>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <Card
                key={`${item.title}-${idx}`}
                data-reveal
                className="opacity-0 translate-y-2 transition-all duration-500 hover:shadow-md"
                style={{ transitionDelay: `${item.delayMs ?? idx * 60}ms` }}
              >
                <CardHeader className="flex items-center gap-3">
                  {item.icon}
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {item.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </RevealContainer>
      </section>
    </SectionViewTracker>
  );
}
