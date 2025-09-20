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

/**
 * IMPORTANT (Week38): PUBLIC SAMPLE ONLY
 * -------------------------------------------------
 * The WEEK38_CONFIG below is intentionally non-sensitive placeholder data.
 * Production runs must provide a private JSON config via:
 *  - ADS_CONFIG_JSON (env var containing JSON array of CampaignConfig)
 *  - or ADS_CONFIG_PATH (filesystem path to a private JSON file)
 * The scripts enforce this by default unless ALLOW_EMBEDDED_ADS_CONFIG=true.
 */
export const WEEK38_CONFIG: { wellness: CampaignConfig; depth: CampaignConfig } = {
  wellness: {
    name: 'SAMPLE Wellness - Week 38',
    budget_euros: 200,
    landing_page: 'https://www.kaufmann-health.de/sample-wellness',
    schedule: { start: '2025-09-18', end: '2025-09-22' },
    keywords: {
      sample: { maxCpc: 2.5, terms: ['sample wellness 1', 'sample wellness 2'] },
    },
    negativeKeywords: ['sample negative a', 'sample negative b'],
    headlines: ['Sample Headline 1', 'Sample Headline 2', 'Sample Headline 3'],
    descriptions: ['Sample description A', 'Sample description B'],
  },
  depth: {
    name: 'SAMPLE Depth - Week 38',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/sample-depth',
    schedule: { start: '2025-09-20', end: '2025-09-21' },
    keywords: {
      sample: { maxCpc: 3.0, terms: ['sample depth 1', 'sample depth 2'] },
    },
    headlines: ['Sample Headline 1', 'Sample Headline 2', 'Sample Headline 3'],
    descriptions: ['Sample description A', 'Sample description B'],
  },
};
