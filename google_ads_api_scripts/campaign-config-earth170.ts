/**
 * IMPORTANT: PUBLIC SAMPLE ONLY
 * --------------------------------
 * This file intentionally contains only NON-SENSITIVE placeholder content.
 * Production runs must provide a private config via:
 *  - ADS_CONFIG_JSON (env var containing JSON array of CampaignConfig)
 *  - or ADS_CONFIG_PATH (filesystem path to a private JSON file)
 *
 * The create script enforces this by default and will exit unless
 * ALLOW_EMBEDDED_ADS_CONFIG=true is explicitly set.
 */
import { type CampaignConfig } from './campaign-config';

export const EARTH170_CONFIG: CampaignConfig[] = [
  {
    name: 'SAMPLE Campaign A — EARTH-170',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/sample-a',
    schedule: { start: '2025-09-19', end: '2025-09-22' },
    keywords: {
      sample: { maxCpc: 2.0, terms: ['sample keyword 1', 'sample keyword 2'] },
    },
    negativeKeywords: ['sample negative 1', 'sample negative 2'],
    headlines: ['Sample Headline 1', 'Sample Headline 2', 'Sample Headline 3'],
    descriptions: ['Sample description A', 'Sample description B'],
  },
  {
    name: 'SAMPLE Campaign B — EARTH-170',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/sample-b',
    schedule: { start: '2025-09-19', end: '2025-09-22' },
    keywords: {
      sample: { maxCpc: 2.0, terms: ['sample keyword 3', 'sample keyword 4'] },
    },
    negativeKeywords: ['sample negative 3', 'sample negative 4'],
    headlines: ['Sample Headline 1', 'Sample Headline 2', 'Sample Headline 3'],
    descriptions: ['Sample description A', 'Sample description B'],
  },
  {
    name: 'SAMPLE Campaign C — EARTH-170',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/sample-c',
    schedule: { start: '2025-09-19', end: '2025-09-22' },
    keywords: {
      sample: { maxCpc: 2.0, terms: ['sample keyword 5', 'sample keyword 6'] },
    },
    negativeKeywords: ['sample negative 5', 'sample negative 6'],
    headlines: ['Sample Headline 1', 'Sample Headline 2', 'Sample Headline 3'],
    descriptions: ['Sample description A', 'Sample description B'],
  },
];
