#!/usr/bin/env tsx

/*
  Unified Campaign Creation CLI
  ---------------------------------
  This is a thin wrapper that standardizes configuration loading and forwards
  to the existing, battle-tested creator (create-week38-campaigns.ts) for now.

  Usage:
    - ADS_CONFIG_PATH=/abs/path/to/config.json tsx google_ads_api_scripts/create-campaigns.ts
    - ADS_CONFIG_JSON='[...]' tsx google_ads_api_scripts/create-campaigns.ts
    - Or pass --config=/abs/path/to/config.json

  Safety flags:
    - DRY_RUN=true (default) → read/validate only
    - VALIDATE_ONLY=true     → passes validateOnly to Google Ads API
    - CONFIRM_APPLY=true     → actually apply changes

  Optional filters:
    - --nameLike="Berlin"        → only campaigns whose name includes substring
    - --adgroups="core,expansion" → limit keyword tiers to create

  Notes:
    - This wrapper will be replaced by a full unified implementation.
    - For now it proxies env + args to create-week38-campaigns.ts.
*/

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

// Basic shape we expect. This is intentionally light; detailed validation remains in the engine script for now.
type KeywordTier = { maxCpc: number; terms: string[] };
export type CampaignConfig = {
  name: string;
  budget_euros: number;
  landing_page: string;
  schedule: { start: string; end: string };
  keywords: Record<string, KeywordTier>;
  negativeKeywords?: string[];
  headlines?: string[];
  descriptions?: string[];
  // optional advanced fields reserved for future unified engine
  geo?: { mode: 'germany' | 'berlin_proximity'; radius_km?: number };
  replacements?: Record<string, string>;
  ads?: {
    final_url_params?: Record<string, string>;
    pinning_rules?: { price_regex?: string; privacy_phrase?: string };
    rsas_per_adgroup?: number;
  };
  sitelinks?: Array<{ text: string; url: string }>;
  selective_optimization_conversion_name?: string;
};

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v === undefined ? true : v;
  }
  return out;
}

function loadConfigFromEnvOrArgs(): { rawJson: string; campaigns: CampaignConfig[] } {
  const args = parseArgs(process.argv.slice(2));
  const envJson = process.env.ADS_CONFIG_JSON;
  const argPath = (args['config'] as string) || process.env.ADS_CONFIG_PATH;

  let rawJson: string | undefined;
  if (envJson && envJson.trim().startsWith('[')) {
    rawJson = envJson;
  } else if (argPath) {
    const p = path.isAbsolute(argPath) ? argPath : path.resolve(process.cwd(), argPath);
    rawJson = readFileSync(p, 'utf8');
  }

  if (!rawJson) {
    const allowEmbedded = process.env.ALLOW_EMBEDDED_ADS_CONFIG === 'true';
    if (!allowEmbedded) {
      throw new Error(
        'No ADS_CONFIG_JSON or ADS_CONFIG_PATH provided. For safety, embedded samples are disabled. Set ALLOW_EMBEDDED_ADS_CONFIG=true if you really want to run a built-in sample.'
      );
    }
    // Embedded example as last resort (safe defaults, DRY_RUN recommended)
    rawJson = JSON.stringify([
      {
        name: 'SAMPLE – DE',
        budget_euros: 50,
        landing_page: 'https://www.kaufmann-health.de/ankommen-in-dir',
        schedule: { start: '2025-10-01', end: '2025-10-15' },
        keywords: {
          core: { maxCpc: 2.5, terms: ['körpertherapie online', 'somatic experiencing'] }
        },
        negativeKeywords: ['krankenkasse', 'ausbildung']
      }
    ] satisfies CampaignConfig[]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new Error('ADS_CONFIG_JSON/Path content is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Config must be a JSON array of campaigns');
  }

  // Lightweight validation
  const campaigns = parsed as CampaignConfig[];
  for (const c of campaigns) {
    if (!c.name || !c.budget_euros || !c.landing_page || !c.schedule || !c.keywords) {
      throw new Error(`Campaign missing required fields: ${c.name ?? '<unnamed>'}`);
    }
  }

  return { rawJson, campaigns };
}

async function main() {
  const { rawJson, campaigns } = loadConfigFromEnvOrArgs();
  const args = parseArgs(process.argv.slice(2));

  const nameLike = (args['nameLike'] as string) || '';
  const adgroups = (args['adgroups'] as string) || '';

  const filtered = nameLike
    ? campaigns.filter((c) => c.name.toLowerCase().includes(nameLike.toLowerCase()))
    : campaigns;

  if (filtered.length === 0) {
    console.log('No campaigns match the provided filters. Nothing to do.');
    return;
  }

  const dryRun = process.env.CONFIRM_APPLY === 'true' ? false : true;
  const validateOnly = process.env.VALIDATE_ONLY === 'true';

  console.log('Unified create-campaigns:');
  console.log('- Campaigns total:', campaigns.length);
  console.log('- Campaigns after filter:', filtered.length);
  console.log('- DRY_RUN:', dryRun);
  console.log('- VALIDATE_ONLY:', validateOnly);
  if (nameLike) console.log('- nameLike:', nameLike);
  if (adgroups) console.log('- adgroups:', adgroups);

  // Forward to existing engine for now (create-week38-campaigns.ts)
  const enginePath = path.resolve(
    __dirname,
    'create-week38-campaigns.ts'
  );

  const forwardArgs: string[] = [];
  if (nameLike) forwardArgs.push(`--nameLike=${nameLike}`);
  if (adgroups) forwardArgs.push(`--adgroups=${adgroups}`);

  const childEnv = {
    ...process.env,
    // Ensure the forwarded child receives the filtered JSON
    ADS_CONFIG_JSON: JSON.stringify(filtered)
  } as NodeJS.ProcessEnv;

  const tsxBin = process.env.npm_execpath?.includes('pnpm')
    ? 'tsx'
    : 'tsx'; // assume tsx available via dev deps

  await new Promise<void>((resolve, reject) => {
    const child = spawn(tsxBin, [enginePath, ...forwardArgs], {
      stdio: 'inherit',
      env: childEnv
    });

    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Engine exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

main().catch((e) => {
  console.error('create-campaigns failed:', e);
  process.exit(1);
});
