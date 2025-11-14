export type TherapyPage = {
  slug: string; // e.g. 'somatic-experiencing'
  title: string;
  description: string;
};

// Central registry of therapy pages under /therapie
// Keep concise descriptions for cards and SEO snippets.
export const THERAPY_PAGES: TherapyPage[] = [
  {
    slug: 'koerpertherapie',
    title: 'Körperorientierte Psychotherapie',
    description: 'Wissenschaftlich fundierte körperorientierte Psychotherapie – professionell und ohne Esoterik.'
  },
  {
    slug: 'somatic-experiencing',
    title: 'Somatic Experiencing (SE)®',
    description: 'Trauma über das Nervensystem lösen – sanft, sicher und evidenzbasiert.'
  },
  {
    slug: 'narm',
    title: 'NARM',
    description: 'Neuroaffektives Beziehungsmodell – Entwicklungs- und Bindungstrauma integrieren.'
  },
  {
    slug: 'hakomi',
    title: 'Hakomi',
    description: 'Achtsamkeitsbasierte Körperpsychotherapie – respektvoll und erfahrungsorientiert.'
  },
  {
    slug: 'core-energetics',
    title: 'Core Energetics',
    description: 'Körperarbeit für emotionale und energetische Integration.'
  }
];
