#!/usr/bin/env tsx

/*
  Unified Campaign Creation CLI
  ---------------------------------
  Loads a JSON config and applies it directly to Google Ads.

  Usage:
    - ADS_CONFIG_PATH=/abs/path/to/config.json tsx google_ads_api_scripts/create-campaigns.ts
    - ADS_CONFIG_JSON='[...]' tsx google_ads_api_scripts/create-campaigns.ts
    - Or pass --config=/abs/path/to/config.json

  Safety flags:
    - DRY_RUN=true (default) → read/validate only (no writes)
    - VALIDATE_ONLY=true     → log validation intent (no writes)
    - CONFIRM_APPLY=true     → actually apply changes

  Optional filters:
    - --nameLike="Berlin"        → only campaigns whose name includes substring
    - --adgroups="core,expansion" → limit keyword tiers to create (reserved)
*/

import fs, { readFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleAdsApi, enums } from 'google-ads-api';

// Load env from .env.local (project root) first, then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
};

const eurosToMicros = (eur: number): number => {
  return Math.round((eur || 0) * 1_000_000);
};

// Basic shape we expect for input config
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

  const campaigns = parsed as CampaignConfig[];
  for (const c of campaigns) {
    if (!c.name || !c.budget_euros || !c.landing_page || !c.schedule || !c.keywords) {
      throw new Error(`Campaign missing required fields: ${c.name ?? '<unnamed>'}`);
    }
  }
  return { rawJson: JSON.stringify(campaigns), campaigns };
}

const findBudgetByName = async (customer: any, name: string): Promise<string | undefined> => {
  const rows = await customer.query(`
    SELECT campaign_budget.resource_name, campaign_budget.name
    FROM campaign_budget
    WHERE campaign_budget.name = '${name.replace(/'/g, "''")}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const rn = (r as any)?.campaign_budget?.resource_name || (r as any)?.campaignBudget?.resourceName;
  return rn as string | undefined;
};

const createBudget = async (customer: any, name: string, amountMicros: number, dryRun: boolean): Promise<string> => {
  if (dryRun) {
    console.log(`  [DRY] Would create budget: ${name} (€${(amountMicros / 1_000_000).toFixed(2)}/day)`);
    return `customers/${requireEnv('GOOGLE_ADS_CUSTOMER_ID')}/campaignBudgets/DRY_${Date.now()}`;
  }
  const res: any = await customer.campaignBudgets.create([
    {
      name,
      amount_micros: amountMicros,
      delivery_method: 'STANDARD',
      explicitly_shared: false,
    },
  ]);
  const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!rn) throw new Error('Failed to create budget (no resource_name)');
  console.log(`  ✓ Budget ready: ${rn}`);
  return rn as string;
};

const findCampaignByName = async (customer: any, name: string): Promise<{ resourceName: string; status?: any } | undefined> => {
  const rows = await customer.query(`
    SELECT campaign.resource_name, campaign.name, campaign.status
    FROM campaign
    WHERE campaign.name = '${name.replace(/'/g, "''")}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const c = (r as any)?.campaign || {};
  const rn = c.resource_name || (r as any)?.campaign?.resourceName;
  if (!rn) return undefined;
  return { resourceName: rn as string, status: c.status };
};

const createCampaign = async (customer: any, name: string, budgetResourceName: string, startDate: string, endDate: string, dryRun: boolean): Promise<string> => {
  if (dryRun) {
    console.log(`  [DRY] Would create campaign: ${name} (PAUSED)`);
    return `customers/${requireEnv('GOOGLE_ADS_CUSTOMER_ID')}/campaigns/DRY_${Date.now()}`;
  }
  const res: any = await customer.campaigns.create([
    {
      name,
      status: enums.CampaignStatus.PAUSED,
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      campaign_budget: budgetResourceName,
      start_date: startDate,
      end_date: endDate,
    },
  ]);
  const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!rn) throw new Error('Failed to create campaign (no resource_name)');
  console.log(`  ✓ Campaign created (PAUSED): ${rn}`);
  return rn as string;
};

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

  console.log('Unified create-campaigns (direct apply):');
  console.log('- Campaigns total:', campaigns.length);
  console.log('- Campaigns after filter:', filtered.length);
  console.log('- DRY_RUN:', dryRun);
  console.log('- VALIDATE_ONLY:', validateOnly);
  if (nameLike) console.log('- nameLike:', nameLike);
  if (adgroups) console.log('- adgroups:', adgroups);

  if (validateOnly && !dryRun) {
    console.log('VALIDATE_ONLY specified; running as dry-run (no writes).');
  }

  // Initialize Google Ads client
  const api = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });
  const customer = api.Customer({
    customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
    refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });

  for (const c of filtered) {
    console.log(`\n=== Applying campaign: ${c.name} ===`);
    const budgetName = `${c.name} – Budget`;
    const amountMicros = eurosToMicros(c.budget_euros);

    // Ensure budget exists
    let budgetRn = await findBudgetByName(customer, budgetName);
    if (budgetRn) {
      console.log(`  ✓ Budget exists: ${budgetRn}`);
    } else {
      budgetRn = await createBudget(customer, budgetName, amountMicros, dryRun || validateOnly);
    }

    // Ensure campaign exists (PAUSED)
    const existing = await findCampaignByName(customer, c.name);
    if (existing?.resourceName) {
      console.log(`  ✓ Campaign exists: ${existing.resourceName} (status: ${existing.status})`);
    } else {
      await createCampaign(
        customer,
        c.name,
        budgetRn as string,
        c.schedule.start,
        c.schedule.end,
        dryRun || validateOnly
      );
    }
  }
}

main().catch((e) => {
  console.error('create-campaigns failed:', e);
  process.exit(1);
});
