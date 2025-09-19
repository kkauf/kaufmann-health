export type KeywordTier = {
  maxCpc: number;
  terms: string[];
};

/*
UNSAFE KEYWORDS (flagged by Google policy: HEALTH_IN_PERSONALIZED_ADS)
- somatic experiencing therapeut deutschland
- achtsame psychotherapie
- ganzheitliche therapie privat

Safer alternatives now used in-place:
- somatic experiencing
- körpertherapie online
- achtsamkeitsbasierte begleitung
- ganzheitliche therapiebegleitung

Synonym guidance:
- "somatic experiencing" → "somatische begleitung", "körperarbeit online", "körperbasierte begleitung"
*/

export type CampaignConfig = {
  name: string;
  budget_euros: number;
  landing_page: string;
  schedule: { start: string; end: string };
  keywords: Record<string, KeywordTier>;
  negativeKeywords?: string[];
  headlines: string[];
  descriptions: string[];
};

export const WEEK38_CONFIG: { wellness: CampaignConfig; depth: CampaignConfig } = {
  wellness: {
    name: 'CONSCIOUS WELLNESS SEEKERS - Week 38',
    budget_euros: 200,
    landing_page: 'https://www.kaufmann-health.de/ankommen-in-dir',
    schedule: {
      start: '2025-09-18',
      end: '2025-09-22',
    },
    keywords: {
      highIntent: {
        maxCpc: 3.5,
        terms: [
          'körperpsychotherapie online',
          // UNSAFE (flagged by Google policy: HEALTH_IN_PERSONALIZED_ADS)
          // 'somatic experiencing therapeut deutschland',
          // Safer alternatives:
          // 'somatic experiencing',
          'körpertherapie online',
          'somatische begleitung',
          'körperarbeit online',
          'traumatherapie körperorientiert',
          'NARM therapie online',
          'nervensystem regulation therapie',
        ],
      },
      mediumIntent: {
        maxCpc: 2.5,
        terms: [
          'therapie für hochsensible',
          // UNSAFE (flagged by Google policy: HEALTH_IN_PERSONALIZED_ADS)
          // 'achtsame psychotherapie',
          // 'ganzheitliche therapie privat',
          // Safer alternatives:
          'achtsamkeitsbasierte begleitung',
          'ganzheitliche therapiebegleitung',
          'embodiment therapie',
        ],
      },
    },
    negativeKeywords: ['krankenkasse', 'kostenlos', 'erstattung', 'kostenübernahme', 'rezept', 'kassensitz'],
    headlines: [
      'Körperorientierte Therapie Online',
      'Ganzheitliche Psychotherapie',
      'Therapie für Körper und Seele',
      'NARM und Somatic Experiencing',
      'Traumasensitive Begleitung',
      'Der nächste Schritt deiner Heilungsreise',
      '80-120€ pro Sitzung',
      'Sichere therapeutische Räume',
      'Nervensystem-Regulation lernen',
      'Embodiment statt nur Gespräch',
      'Für dich handverlesen',
      'Verbinde Körper und Geist',
    ],
    descriptions: [
      'Handverlesene Therapeuten für deine Heilungsreise. Online, diese Woche noch.',
      'NARM & Somatic Experiencing. Sichere dir deinen Platz. 80-120€ pro Sitzung.',
      'Starte deine körperorientierte Therapie. Diese Woche verfügbar. Online.',
    ],
  },
  depth: {
    name: 'DEPTH SEEKERS - Week 38',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/wieder-lebendig',
    schedule: {
      start: '2025-09-20', // Friday
      end: '2025-09-21', // Saturday
    },
    keywords: {
      all: {
        maxCpc: 3.0,
        terms: [
          'midlife crisis therapie',
          'sinnkrise hilfe',
          'burnout privattherapie',
          'existenzielle therapie',
          'sinnfindung therapeut',
        ],
      },
    },
    headlines: [
      'Mehr als nur funktionieren',
      'Leben statt nur arbeiten',
      'Finde wieder Sinn',
      'Deine Tiefe wartet',
      'Erfolg ist nicht alles',
      'Privattherapie - diskret',
      'Wieder spüren lernen',
      'Dein Weg zur Lebendigkeit',
      'Diese Woche verfügbar',
      'Für Führungskräfte',
    ],
    descriptions: [
      'Begib dich auf den Weg vom getriebenen Machen zum verkörperten Sein.',
      'Wage einen ehrlichen Blick in deine Innenwelt. Diskrete Privattherapie.',
      'Körperorientierte Therapie für Menschen, die mehr wollen als nur funktionieren.',
    ],
  },
};
