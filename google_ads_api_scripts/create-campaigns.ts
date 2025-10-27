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

async function ensureAdGroupBid(customer: any, adGroupRn: string, desiredCpcMicros: number, dryRun: boolean) {
  try {
    const rows: any[] = await customer.query(`
      SELECT ad_group.resource_name, ad_group.cpc_bid_micros
      FROM ad_group
      WHERE ad_group.resource_name = '${adGroupRn}'
      LIMIT 1
    `);
    const current = rows?.[0]?.ad_group?.cpc_bid_micros || rows?.[0]?.adGroup?.cpcBidMicros;
    if (typeof current === 'number' && current === desiredCpcMicros) return;
  } catch {}
  if (dryRun) {
    console.log(`    [DRY] Would set ad group CPC to €${(desiredCpcMicros/1_000_000).toFixed(2)}`);
    return;
  }
  try {
    await customer.adGroups.update([
      { resource_name: adGroupRn, cpc_bid_micros: desiredCpcMicros }
    ], { partial_failure: true });
    console.log(`    ✓ Ad group CPC updated to €${(desiredCpcMicros/1_000_000).toFixed(2)}`);
  } catch (e) {
    console.log('    • Skipped CPC update (may be unchanged or restricted)');
  }
}

async function ensureKeywordBids(
  customer: any,
  adGroupRn: string,
  overrides: Record<string, number>,
  dryRun: boolean
) {
  if (!overrides || Object.keys(overrides).length === 0) return;
  const rows: any[] = await customer.query(`
    SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.cpc_bid_micros
    FROM ad_group_criterion
    WHERE ad_group_criterion.ad_group = '${adGroupRn}' AND ad_group_criterion.type = 'KEYWORD'
  `);
  const updates: any[] = [];
  for (const r of rows) {
    const agc = (r as any).ad_group_criterion || (r as any).adGroupCriterion;
    const rn = agc?.resource_name || agc?.resourceName;
    const text = (agc?.keyword?.text || '').toString().toLowerCase().trim();
    if (!rn || !text) continue;
    const desired = overrides[text];
    if (typeof desired === 'number') {
      const current = agc?.cpc_bid_micros || agc?.cpcBidMicros;
      if (current !== desired) updates.push({ resource_name: rn, cpc_bid_micros: desired });
    }
  }
  if (updates.length === 0) return;
  if (dryRun) {
    console.log(`    [DRY] Would update ${updates.length} keyword bids in ad group`);
    return;
  }
  try {
    await customer.adGroupCriteria.update(updates, { partial_failure: true });
    console.log(`    ✓ Updated keyword bids: ${updates.length}`);
  } catch (e) {
    console.log('    • Skipped keyword bid updates (may be restricted)');
  }
}

function loadPrivateAdTemplates(): Record<string, { headlines?: string[]; descriptions?: string[]; path1?: string; path2?: string }> | undefined {
  const candidates = ['ad-templates.local.json', 'ad-templates.json'];
  for (const fname of candidates) {
    try {
      const p = path.join(__dirname, 'private', fname);
      if (!fs.existsSync(p)) continue;
      const raw = readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return undefined;
}

async function listAdGroupAds(customer: any, adGroupRn: string): Promise<string[]> {
  const rows: any[] = await customer.query(`
    SELECT ad_group_ad.resource_name, ad_group_ad.status
    FROM ad_group_ad
    WHERE ad_group_ad.ad_group = '${adGroupRn}'
  `);
  return rows.map((r) => (r as any)?.ad_group_ad?.resource_name || (r as any)?.adGroupAd?.resourceName).filter(Boolean);
}

async function ensureAtLeastOneRSA(
  customer: any,
  adGroupRn: string,
  landing: string,
  params: Record<string, string> | undefined,
  fallbackH: string[],
  fallbackD: string[],
  dryRun: boolean,
  path1?: string,
  path2?: string
) {
  if (dryRun || /\/DRY_/.test(adGroupRn)) {
    console.log('    [DRY] Would ensure at least one RSA (skip check)');
    return;
  }
  const ads = await listAdGroupAds(customer, adGroupRn);
  if (ads.length > 0) {
    console.log(`    • AdGroup has ${ads.length} ads`);
    return;
  }
  console.log('    • No ads found — creating fallback RSAs');
  await addRSAs(customer, adGroupRn, landing, fallbackH, fallbackD, params, 2, dryRun);
  // Re-check after short delay for eventual consistency
  await new Promise((r) => setTimeout(r, 1000));
  const after = await listAdGroupAds(customer, adGroupRn);
  console.log(`    • AdGroup ads after create: ${after.length}`);
}

async function updateCampaignPresenceAndEcpc(customer: any, campaignRn: string, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY] Would set presence-only geo and ECPC on campaign');
    return;
  }
  try {
    await customer.campaigns.update(
      [
        {
          resource_name: campaignRn,
          geo_target_type_setting: {
            positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
            negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
          },
          manual_cpc: { enhanced_cpc_enabled: true },
        },
      ],
      { partial_failure: true }
    );
    console.log('  ✓ Campaign updated: presence-only + ECPC');
  } catch (e) {
    console.error('  ✗ Campaign update failed', e);
  }
}

async function pauseOtherAdGroups(customer: any, campaignRn: string, allowedNames: Set<string>, dryRun: boolean) {
  if (dryRun || /\/DRY_/.test(campaignRn)) {
    console.log('  [DRY] Would pause other ad groups in campaign (skip)');
    return;
  }
  const rows: any[] = await customer.query(`
    SELECT ad_group.resource_name, ad_group.name, ad_group.status, ad_group.campaign
    FROM ad_group
    WHERE ad_group.campaign = '${campaignRn}'
  `);
  for (const r of rows) {
    const ag = (r as any).ad_group || (r as any).adGroup;
    const name = ag?.name as string;
    const rn = ag?.resource_name || ag?.resourceName;
    if (!name || !rn) continue;
    if (allowedNames.has(name)) continue;
    if (dryRun) {
      console.log(`  [DRY] Would pause ad group: ${name}`);
      continue;
    }
    try {
      await customer.adGroups.update([
        {
          resource_name: rn,
          status: enums.AdGroupStatus.PAUSED,
        },
      ], { partial_failure: true });
      console.log(`  ✓ Paused ad group: ${name}`);
    } catch (e) {
      console.error('  ✗ Failed pausing ad group', name, e);
    }
  }
}

const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
};

const getBudgetAmountMicros = async (customer: any, budgetRn: string): Promise<number | undefined> => {
  const rows = await customer.query(`
    SELECT campaign_budget.resource_name, campaign_budget.amount_micros
    FROM campaign_budget
    WHERE campaign_budget.resource_name = '${budgetRn}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const amt = (r as any)?.campaign_budget?.amount_micros || (r as any)?.campaignBudget?.amountMicros;
  return typeof amt === 'number' ? amt : undefined;
};

const ensureBudgetAmount = async (customer: any, budgetRn: string, amountMicros: number, dryRun: boolean) => {
  const current = await getBudgetAmountMicros(customer, budgetRn).catch(() => undefined);
  if (current === amountMicros) {
    console.log(`  • Budget amount unchanged (€${(amountMicros/1_000_000).toFixed(2)}/day)`);
    return;
  }
  if (dryRun) {
    console.log(`  [DRY] Would update budget amount to €${(amountMicros/1_000_000).toFixed(2)}/day`);
    return;
  }
  await customer.campaignBudgets.update([
    {
      resource_name: budgetRn,
      amount_micros: amountMicros,
    },
  ], { partial_failure: true });
  console.log(`  ✓ Budget updated to €${(amountMicros/1_000_000).toFixed(2)}/day`);
};

// Read the budget currently attached to a campaign
const getCampaignBudgetRn = async (customer: any, campaignRn: string): Promise<string | undefined> => {
  const rows: any[] = await customer.query(`
    SELECT campaign.campaign_budget
    FROM campaign
    WHERE campaign.resource_name = '${campaignRn}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const rn = (r as any)?.campaign?.campaign_budget || (r as any)?.campaign?.campaignBudget;
  return rn as string | undefined;
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
    path1?: string;
    path2?: string;
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
  let res: any;
  try {
    res = await customer.campaigns.create([
      {
        name,
        status: enums.CampaignStatus.PAUSED,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        bidding_strategy_type: enums.BiddingStrategyType.MANUAL_CPC,
        manual_cpc: { enhanced_cpc_enabled: true },
        geo_target_type_setting: {
          positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
          negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
        },
        network_settings: {
          target_google_search: true,
          target_search_network: true,
          target_content_network: false,
          target_partner_search_network: false,
        },
        contains_eu_political_advertising: (enums as any).EuPoliticalAdvertisingStatus
          ? (enums as any).EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
          : 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
        eu_political_advertising: {
          status: (enums as any).EuPoliticalAdvertisingStatus
            ? (enums as any).EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
            : 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
        },
        campaign_budget: budgetResourceName,
        start_date: startDate,
        end_date: endDate,
      },
    ]);
  } catch (e: any) {
    console.error('  ✗ Campaign create failed');
    try {
      const details = e?.errors?.map((er: any) => ({
        code: er?.error_code,
        message: er?.message,
        trigger: er?.trigger,
        location: er?.location,
      }));
      console.error('  Details:', JSON.stringify(details, null, 2));
    } catch {}
    throw e;
  }
  const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!rn) throw new Error('Failed to create campaign (no resource_name)');
  console.log(`  ✓ Campaign created (PAUSED): ${rn}`);
  return rn as string;
};

async function getLanguageConstant(customer: any, code: string): Promise<string> {
  const rows: any[] = await customer.query(`
    SELECT language_constant.resource_name, language_constant.code, language_constant.name
    FROM language_constant
    WHERE language_constant.code = '${code.toLowerCase()}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const rn = (r as any)?.language_constant?.resource_name || (r as any)?.languageConstant?.resourceName;
  if (!rn) throw new Error(`Language constant not found for code=${code}`);
  return rn as string;
}

async function ensureLanguageGerman(customer: any, campaignRn: string, dryRun: boolean) {
  const german = dryRun ? 'languageConstants/DE' : await getLanguageConstant(customer, 'de');
  if (dryRun) {
    console.log(`  [DRY] Would set language to German only`);
    return;
  }
  try {
    await customer.campaignCriteria.create(
      [
        {
          campaign: campaignRn,
          language: { language_constant: german },
        },
      ],
      { partial_failure: true }
    );
    console.log('  ✓ Language added: DE');
  } catch (e: any) {
    const s = String(e).toLowerCase();
    if (s.includes('already exists') || s.includes('duplicate')) {
      console.log('  • Language already set');
    } else {
      throw e;
    }
  }
  // Remove any non-German language criteria
  try {
    const rows: any[] = await customer.query(`
      SELECT campaign_criterion.resource_name, campaign_criterion.language.language_constant
      FROM campaign_criterion
      WHERE campaign_criterion.campaign = '${campaignRn}' AND campaign_criterion.type = 'LANGUAGE' 
    `);
    const toRemove: string[] = [];
    for (const row of rows) {
      const cc = (row as any)?.campaign_criterion || (row as any)?.campaignCriterion;
      const rn = cc?.resource_name || cc?.resourceName;
      const lc = cc?.language?.language_constant || cc?.language?.languageConstant;
      if (rn && lc && lc !== german) toRemove.push(rn);
    }
    if (toRemove.length) {
      await customer.campaignCriteria.remove(toRemove, { partial_failure: true });
      console.log(`  ✓ Removed non-German language criteria: ${toRemove.length}`);
    }
  } catch {}
}

async function ensureProximityBerlin50km(customer: any, campaignRn: string, dryRun: boolean) {
  const latMicro = Math.round(52.5200 * 1_000_000);
  const lngMicro = Math.round(13.4050 * 1_000_000);
  if (dryRun) {
    console.log('  [DRY] Would add proximity: Berlin +50km');
    return;
  }
  try {
    await customer.campaignCriteria.create(
      [
        {
          campaign: campaignRn,
          proximity: {
            geo_point: { latitude_in_micro_degrees: latMicro, longitude_in_micro_degrees: lngMicro },
            radius: 50,
            radius_units: enums.ProximityRadiusUnits.KILOMETERS,
          },
        },
      ],
      { partial_failure: true }
    );
    console.log('  ✓ Proximity added: Berlin +50km');
  } catch (e: any) {
    if (String(e).includes('ALREADY_EXISTS') || String(e).includes('DUPLICATE')) {
      console.log('  • Proximity already set');
      return;
    }
    throw e;
  }
}

async function addCampaignNegatives(customer: any, campaignRn: string, negatives: string[] | undefined, dryRun: boolean) {
  if (!negatives || negatives.length === 0) return;
  for (const term of negatives) {
    if (dryRun) {
      console.log(`  [DRY] Would add negative KW: "${term}"`);
      continue;
    }
    try {
      await customer.campaignCriteria.create(
        [
          {
            campaign: campaignRn,
            negative: true,
            keyword: { text: term, match_type: enums.KeywordMatchType.PHRASE },
          },
        ],
        { partial_failure: true }
      );
      console.log(`  ✓ Negative added: ${term}`);
    } catch (e: any) {
      if (String(e).includes('ALREADY_EXISTS') || String(e).includes('DUPLICATE')) {
        console.log(`  • Negative exists: ${term}`);
        continue;
      }
      console.error('  ✗ Negative failed:', term);
      console.error('    Details:', e?.errors || String(e));
    }
  }
}

async function ensureAdGroup(customer: any, campaignRn: string, name: string, cpcMicros: number, dryRun: boolean): Promise<string> {
  // In DRY mode (or when using a fake DRY_* campaign resource), skip API queries and return a placeholder
  if (dryRun || /\/DRY_/.test(campaignRn)) {
    console.log(`  [DRY] Would create ad group: ${name} (bid €${(cpcMicros/1_000_000).toFixed(2)})`);
    return `${campaignRn}/adGroups/DRY_${Date.now()}`;
  }
  // Pre-check to avoid duplicate-name error
  try {
    const rows: any[] = await customer.query(`SELECT ad_group.resource_name FROM ad_group WHERE ad_group.name = '${name.replace(/'/g, "''")}' AND ad_group.campaign = '${campaignRn}' LIMIT 1`);
    const existing = rows?.[0]?.ad_group?.resource_name || rows?.[0]?.adGroup?.resourceName;
    if (existing) {
      console.log(`  • Ad group exists: ${name}`);
      return existing as string;
    }
  } catch {}
  try {
    const res: any = await customer.adGroups.create([
      {
        name,
        campaign: campaignRn,
        status: enums.AdGroupStatus.ENABLED,
        cpc_bid_micros: cpcMicros,
      },
    ]);
    const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name;
    if (!rn) throw new Error('No ad group resource_name');
    console.log(`  ✓ Ad group: ${name}`);
    return rn as string;
  } catch (e: any) {
    const s = String(e).toLowerCase();
    if (s.includes('already exists') || s.includes('already_exists') || s.includes('duplicate')) {
      const rows: any[] = await customer.query(`SELECT ad_group.resource_name FROM ad_group WHERE ad_group.name = '${name.replace(/'/g, "''")}' AND ad_group.campaign = '${campaignRn}' LIMIT 1`);
      const rn = rows?.[0]?.ad_group?.resource_name || rows?.[0]?.adGroup?.resourceName;
      if (!rn) throw e;
      console.log(`  • Ad group exists: ${name}`);
      return rn as string;
    }
    throw e;
  }
}

async function addKeywords(customer: any, adGroupRn: string, terms: string[], cpcMicros: number, dryRun: boolean) {
  for (const t of terms) {
    if (dryRun) {
      console.log(`    [DRY] Would add KW (phrase+exact): ${t}`);
      continue;
    }
    try {
      await customer.adGroupCriteria.create(
        [
          {
            ad_group: adGroupRn,
            status: enums.AdGroupCriterionStatus.ENABLED,
            cpc_bid_micros: cpcMicros,
            keyword: { text: t, match_type: enums.KeywordMatchType.PHRASE },
          },
          {
            ad_group: adGroupRn,
            status: enums.AdGroupCriterionStatus.ENABLED,
            cpc_bid_micros: cpcMicros,
            keyword: { text: t, match_type: enums.KeywordMatchType.EXACT },
          },
        ],
        { partial_failure: true }
      );
      console.log(`    ✓ KW added (phrase+exact): ${t}`);
    } catch (e: any) {
      if (String(e).includes('ALREADY_EXISTS') || String(e).includes('DUPLICATE')) {
        console.log(`    • KW exists: ${t}`);
        continue;
      }
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`    ✗ KW failed: ${t} :: ${msg}`);
      // Optionally: collect policy violations for exemption retry
    }
  }
}

function buildFinalUrl(base: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) return base;
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

function pickAssets(all: string[] | undefined, max: number): { text: string }[] | undefined {
  if (!all || all.length === 0) return undefined;
  return all.slice(0, max).map((t) => ({ text: t }));
}

function normalizeText(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+–\s+/g, ' – ')
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  // Try cutting at last space before max to avoid mid-word cuts
  const sub = s.slice(0, max);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 10 ? sub.slice(0, lastSpace) : sub).trim();
}

function sanitizeAdInputs(headlines?: string[], descriptions?: string[]): { H?: { text: string }[]; D?: { text: string }[] } {
  if (!headlines || !descriptions) return {};
  const normH = headlines.map((x) => normalizeText(x));
  const tooLongH = normH.find((x) => x.length > 30);
  if (tooLongH) throw new Error(`Headline exceeds 30 characters: "${tooLongH}"`);
  const seenH = new Set<string>();
  const H = normH
    .filter((x) => x.length > 0)
    .filter((x) => (seenH.has(x) ? false : (seenH.add(x), true)))
    .slice(0, 15)
    .map((text) => ({ text }));
  const normD = descriptions.map((x) => normalizeText(x));
  const tooLongD = normD.find((x) => x.length > 90);
  if (tooLongD) throw new Error(`Description exceeds 90 characters: "${tooLongD}"`);
  const seenD = new Set<string>();
  const D = normD
    .filter((x) => x.length > 0)
    .filter((x) => (seenD.has(x) ? false : (seenD.add(x), true)))
    .slice(0, 4)
    .map((text) => ({ text }));
  return { H, D };
}

function sanitizePathPart(s?: string): string | undefined {
  if (!s) return undefined;
  const cleaned = normalizeText(s).replace(/\//g, '-');
  return clip(cleaned, 15);
}

function preflightWarnNegativeConflicts(c: CampaignConfig, negatives: string[], failOnConflict: boolean) {
  try {
    const positives = Object.values(c.keywords || {})
      .flatMap((t: any) => (Array.isArray(t?.terms) ? t.terms : []))
      .filter(Boolean) as string[];
    const conflicts: Array<{ negative: string; positive: string }> = [];
    const posLc = positives.map((p) => String(p).toLowerCase());
    const negLc = negatives.map((n) => String(n).toLowerCase());
    for (const n of negLc) {
      const nTrim = n.trim();
      if (!nTrim) continue;
      for (const p of posLc) {
        if (p.includes(nTrim)) {
          conflicts.push({ negative: nTrim, positive: p });
        }
      }
    }
    if (conflicts.length) {
      console.log(`  Warning: ${conflicts.length} negative/positive conflicts in ${c.name}`);
      for (const x of conflicts.slice(0, 5)) {
        console.log(`    - '${x.negative}' vs '${x.positive}'`);
      }
      if (failOnConflict) throw new Error('FAIL_ON_CONFLICT=true: negative/positive conflicts detected');
    }
  } catch {}
}

async function addRSAs(
  customer: any,
  adGroupRn: string,
  landing: string,
  headlines: string[] | undefined,
  descriptions: string[] | undefined,
  params: Record<string, string> | undefined,
  count: number,
  dryRun: boolean,
  path1?: string,
  path2?: string
) {
  const { H, D } = sanitizeAdInputs(headlines, descriptions);
  const h = H; const d = D;
  if (!h || h.length < 3 || !d || d.length < 2) {
    console.log('    • Skipping RSAs: insufficient assets');
    return;
  }
  const finalUrl = buildFinalUrl(landing, params);
  for (let i = 0; i < Math.max(1, count); i++) {
    if (dryRun) {
      console.log(`    [DRY] Would create RSA #${i + 1} with ${h.length} headlines / ${d.length} descriptions`);
      continue;
    }
    try {
      const rsa: any = {
        headlines: h,
        descriptions: d,
      };
      const p1 = sanitizePathPart(path1);
      const p2 = sanitizePathPart(path2);
      if (p1) rsa.path1 = p1;
      if (p2) rsa.path2 = p2;
      await customer.adGroupAds.create(
        [
          {
            ad_group: adGroupRn,
            status: enums.AdGroupAdStatus.ENABLED,
            ad: {
              final_urls: [finalUrl],
              responsive_search_ad: rsa,
            },
          },
        ],
        { partial_failure: true }
      );
      console.log(`    ✓ RSA created #${i + 1}`);
    } catch (e: any) {
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`    ✗ RSA failed #${i + 1}: ${msg}`);
    }
  }
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

  async function listAssetsByTypes(types: string[]): Promise<{ resourceName: string; type: string; name?: string }[]> {
    const typeList = types.map((t) => `'${t}'`).join(',');
    const rows: any[] = await customer.query(`
      SELECT asset.resource_name, asset.type, asset.name
      FROM asset
      WHERE asset.type IN (${typeList})
    `);
    return rows.map((r) => {
      const a = (r as any).asset || (r as any).asset;
      return {
        resourceName: a?.resource_name || a?.resourceName,
        type: a?.type,
        name: a?.name,
      } as { resourceName: string; type: string; name?: string };
    }).filter((a) => !!a.resourceName);
  }

  async function attachAssetsToCampaign(campaignRn: string, assets: { resourceName: string; type: string; name?: string }[], dryRun: boolean) {
    // Map AssetType -> AssetFieldType for CampaignAsset
    const fieldTypeFor: Record<string, number | undefined> = {
      SITELINK: (enums as any).AssetFieldType?.SITELINK ?? enums.AssetFieldType.SITELINK,
      CALLOUT: (enums as any).AssetFieldType?.CALLOUT ?? enums.AssetFieldType.CALLOUT,
      STRUCTURED_SNIPPET: (enums as any).AssetFieldType?.STRUCTURED_SNIPPET ?? enums.AssetFieldType.STRUCTURED_SNIPPET,
      IMAGE: (enums as any).AssetFieldType?.IMAGE,
    };
    // Limit counts to sensible defaults
    const byType: Record<string, { resourceName: string; type: string; name?: string }[]> = {};
    for (const a of assets) {
      if (!byType[a.type]) byType[a.type] = [];
      byType[a.type].push(a);
    }
    const limits: Record<string, number> = { SITELINK: 6, CALLOUT: 10, STRUCTURED_SNIPPET: 4, IMAGE: 10 };

    for (const t of Object.keys(byType)) {
      const selected = byType[t].slice(0, limits[t] || 5);
      if (selected.length === 0) continue;
      const fieldType = fieldTypeFor[t];
      if (typeof fieldType !== 'number') {
        // Skip unsupported field types (e.g., IMAGE not available in this library version)
        console.log(`  • Skipping unsupported asset field type for ${t}`);
        continue;
      }
      if (dryRun) {
        console.log(`  [DRY] Would attach ${t} assets (${selected.length}) to campaign`);
        continue;
      }
      try {
        await customer.campaignAssets.create(
          selected.map((a) => ({
            campaign: campaignRn,
            asset: a.resourceName,
            field_type: fieldType,
          })),
          { partial_failure: true }
        );
        console.log(`  ✓ Attached ${t} assets: ${selected.length}`);
      } catch (e: any) {
        const msg = JSON.stringify(e?.errors || String(e));
        console.error(`  ✗ Failed attaching ${t} assets: ${msg}`);
      }
    }
  }

  // Ad-group sitelink helpers (scoped to main to use 'customer')
  async function listSitelinkAssets(): Promise<{ resourceName: string; name?: string; linkText?: string }[]> {
    const rows: any[] = await customer.query(`
      SELECT asset.resource_name, asset.name, asset.sitelink_asset.link_text
      FROM asset
      WHERE asset.type = 'SITELINK'
    `);
    return rows.map((r) => {
      const a = (r as any).asset || (r as any).asset;
      return {
        resourceName: a?.resource_name || a?.resourceName,
        name: a?.name,
        linkText: a?.sitelink_asset?.link_text || a?.sitelinkAsset?.linkText,
      } as { resourceName: string; name?: string; linkText?: string };
    }).filter((a) => !!a.resourceName);
  }

  async function getSitelinkRNsByNamesOrText(names: string[]): Promise<string[]> {
    const all = await listSitelinkAssets();
    const want = new Set(names.map((n) => (n || '').trim().toLowerCase()).filter(Boolean));
    const out: string[] = [];
    for (const a of all) {
      const nm = (a.name || '').trim().toLowerCase();
      const lt = (a.linkText || '').trim().toLowerCase();
      if (want.has(nm) || want.has(lt)) out.push(a.resourceName);
    }
    return Array.from(new Set(out));
  }

  async function attachSitelinksToAdGroup(adGroupRn: string, sitelinkRNs: string[], dryRun: boolean) {
    if (!sitelinkRNs.length) return;
    if (dryRun) {
      console.log(`    [DRY] Would attach ${sitelinkRNs.length} sitelinks to ad group`);
      return;
    }
    try {
      await customer.adGroupAssets.create(
        sitelinkRNs.map((rn) => ({
          ad_group: adGroupRn,
          asset: rn,
          field_type: (enums as any).AssetFieldType?.SITELINK ?? enums.AssetFieldType.SITELINK,
        })),
        { partial_failure: true }
      );
      console.log(`    ✓ Attached sitelinks to ad group: ${sitelinkRNs.length}`);
    } catch (e: any) {
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`    ✗ Failed attaching ad-group sitelinks: ${msg}`);
    }
  }

  for (const c of filtered) {
    console.log(`\n=== Applying campaign: ${c.name} ===`);
    const budgetName = `${c.name} – Budget`;
    const amountMicros = eurosToMicros(c.budget_euros);

    // Ensure budget exists
    let budgetRn = await findBudgetByName(customer, budgetName);
    if (budgetRn) {
      console.log(`  ✓ Budget exists: ${budgetRn}`);
      await ensureBudgetAmount(customer, budgetRn, amountMicros, dryRun || validateOnly);
    } else {
      budgetRn = await createBudget(customer, budgetName, amountMicros, dryRun || validateOnly);
    }

    // Ensure campaign exists (PAUSED)
    const existing = await findCampaignByName(customer, c.name);
    let campaignRn = existing?.resourceName as string | undefined;
    if (campaignRn) {
      console.log(`  ✓ Campaign exists: ${campaignRn} (status: ${existing?.status})`);
      // Ensure the campaign's currently attached budget is updated to desired amount
      const attachedBudgetRn = await getCampaignBudgetRn(customer, campaignRn);
      if (attachedBudgetRn) {
        await ensureBudgetAmount(customer, attachedBudgetRn, amountMicros, dryRun || validateOnly);
      }
    } else {
      campaignRn = await createCampaign(
        customer,
        c.name,
        budgetRn as string,
        c.schedule.start,
        c.schedule.end,
        dryRun || validateOnly
      );
    }

    // Merge private ad templates if present
    const templates = loadPrivateAdTemplates();
    if (templates && templates[c.name]) {
      const t = templates[c.name];
      (c as any).headlines = (c.headlines && c.headlines.length ? c.headlines : t.headlines) as string[] | undefined;
      (c as any).descriptions = (c.descriptions && c.descriptions.length ? c.descriptions : t.descriptions) as string[] | undefined;
      (c as any).ads = c.ads || {};
      if (t.path1 && !c.ads?.path1) (c as any).ads.path1 = t.path1;
      if (t.path2 && !c.ads?.path2) (c as any).ads.path2 = t.path2;
    }

    const boostA = [
      'Körperpsychotherapie Berlin',
      'Traumatherapie Berlin',
      'Körperorientierte Psychotherapie',
      'Somatic Experiencing Berlin'
    ];
    const boostB = [
      'Therapie ohne Wartezeit Berlin',
      'Therapieplatz sofort verfügbar'
    ];
    if (c.name.includes('Positioning_Test_A')) {
      const merged = [ ...(c.headlines || []), ...boostA ];
      (c as any).headlines = Array.from(new Set(merged));
    }
    if (c.name.includes('Positioning_Test_B')) {
      const merged = [ ...(c.headlines || []), ...boostB ];
      (c as any).headlines = Array.from(new Set(merged));
    }

    await ensureLanguageGerman(customer, campaignRn as string, dryRun || validateOnly);
    await ensureProximityBerlin50km(customer, campaignRn as string, dryRun || validateOnly);
    const DEFAULT_NEGATIVES = [
      'mit krankenkasse',
      'krankenkasse übernimmt',
      'krankenkasse zahlt',
      'kostenübernahme',
      'kassenleistung',
      'kassenzulassung',
      'kostenlos','versicherung','wikipedia','job','stelle','karriere','definition',
      'training','ausbildung','zertifizierung','zertifikat','kurs','seminar','fortbildung','workshop','lehrgang','schule','studium'
    ];
    const negMerged = Array.from(new Set([...(c.negativeKeywords || []), ...DEFAULT_NEGATIVES]));
    const posLc = Object.values(c.keywords || {})
      .flatMap((t: any) => (Array.isArray(t?.terms) ? t.terms : []))
      .map((p) => String(p).toLowerCase());
    const dropGeneric = posLc.some((p) => p.includes('ohne krankenkasse') || p.includes('krankenkasse'));
    const negEffective = dropGeneric ? negMerged.filter((n) => n.toLowerCase().trim() !== 'krankenkasse') : negMerged;
    if (dropGeneric) console.log("  • Auto-removed conflicting negative: 'krankenkasse'");
    const failOnConflict = process.env.FAIL_ON_CONFLICT === 'true';
    preflightWarnNegativeConflicts(c, negEffective, failOnConflict);
    await addCampaignNegatives(
      customer,
      campaignRn as string,
      negEffective,
      dryRun || validateOnly
    );

    // Consolidation: 1 ad group per campaign
    const isA = c.name.includes('Positioning_Test_A');
    const allowedTier = isA ? 'bodyTherapy' : 'selfPay';
    const tiers = Object.entries(c.keywords || {}).filter(([name]) => name === allowedTier);
    const allowedNames = new Set<string>();
    for (const [tierName, tier] of tiers) {
      const agName = `${c.name} — ${tierName}`;
      allowedNames.add(agName);
      const cpc = eurosToMicros(tier.maxCpc || 2.0);
      const adGroupRn = await ensureAdGroup(customer, campaignRn as string, agName, cpc, dryRun || validateOnly);
      if (process.env.ENFORCE_ADGROUP_BIDS === 'true') {
        await ensureAdGroupBid(customer, adGroupRn, cpc, dryRun || validateOnly);
      }
      await addKeywords(customer, adGroupRn, tier.terms || [], cpc, dryRun || validateOnly);
      // Extra high-intent expansions per variant
      if (isA && tierName === 'bodyTherapy') {
        const extraA = ['narm therapie','somatic experiencing','hakomi therapie','core energetics','körperpsychotherapie','körperpsychotherapie berlin'];
        await addKeywords(customer, adGroupRn, extraA, cpc, dryRun || validateOnly);
      }
      if (!isA && tierName === 'selfPay') {
        const extraB = [
          'heilpraktiker psychotherapie','heilpraktiker für psychotherapie','psychologischer heilpraktiker',
          'privat psychotherapeut','privat therapeut','selbstzahler psychotherapeut'
        ];
        await addKeywords(customer, adGroupRn, extraB, cpc, dryRun || validateOnly);
        const allTermsB = [ ...(tier.terms || []), ...extraB ];
        const overridesB: Record<string, number> = {};
        for (const t of allTermsB) overridesB[String(t).toLowerCase()] = cpc;
        await ensureKeywordBids(customer, adGroupRn, overridesB, dryRun || validateOnly);
      }
      const rsasPer = c.ads?.rsas_per_adgroup ?? 2;
      await addRSAs(
        customer,
        adGroupRn,
        c.landing_page,
        c.headlines,
        c.descriptions,
        c.ads?.final_url_params,
        rsasPer,
        dryRun || validateOnly,
        c.ads?.path1,
        c.ads?.path2
      );
      // Attach sitelinks at ad-group level if specified in private templates
      try {
        const t = templates?.[c.name] as any;
        const agAssets = t?.ad_group_assets;
        let slNames: string[] | undefined;
        if (agAssets) {
          // Support both full ad group name and tierName keys
          slNames = agAssets[agName]?.sitelinks || agAssets[tierName]?.sitelinks;
        }
        if (Array.isArray(slNames) && slNames.length) {
          const rns = await getSitelinkRNsByNamesOrText(slNames);
          await attachSitelinksToAdGroup(adGroupRn, rns, dryRun || validateOnly);
        }
      } catch (e) {
        console.log('    • Skipped ad-group sitelinks (no mapping or query failed)');
      }
      // Ensure at least one RSA exists — add fallbacks if none
      const fallbackH = isA
        ? [
            'Körperorientierte Therapie',
            'NARM & Somatic Experiencing',
            'Schnelle Termine Privat'
          ]
        : [
            'Therapie ohne Krankenkasse',
            'Schnelle Termine in Berlin',
            'Privat & Selbstzahler'
          ];
      const fallbackD = isA
        ? [
            'Körperorientierte Methoden: NARM, SE. Individuelle Begleitung in Berlin.',
            'Kurzfristige Termine, vertraulich & privat.'
          ]
        : [
            'Privat/Selbstzahler, kurze Wartezeiten in Berlin.',
            'Passende Therapeut:innen zeitnah finden.'
          ];
      await ensureAtLeastOneRSA(customer, adGroupRn, c.landing_page, c.ads?.final_url_params, fallbackH, fallbackD, dryRun || validateOnly);
      if (isA) {
        const kwOverrides: Record<string, number> = { 'körperpsychotherapie': eurosToMicros(5.0) };
        await ensureKeywordBids(customer, adGroupRn, kwOverrides, dryRun || validateOnly);
      }
    }
    await pauseOtherAdGroups(customer, campaignRn as string, allowedNames, dryRun || validateOnly);
    await updateCampaignPresenceAndEcpc(customer, campaignRn as string, dryRun || validateOnly);

    // Update campaign end date to current config (start date update can be restricted once campaign started)
    if (!dryRun && !validateOnly) {
      try {
        await customer.campaigns.update([
          {
            resource_name: campaignRn,
            end_date: c.schedule.end,
          },
        ], { partial_failure: true });
        console.log(`  ✓ Campaign end date set to ${c.schedule.end}`);
      } catch (e) {
        console.log('  • Skipped end date update (may be unchanged or restricted)');
      }
    }

    // Attach existing assets (sitelinks, callouts, structured snippets, images)
    try {
      const hasAdGroupSitelinks = !!(templates && templates[c.name] && (templates[c.name] as any).ad_group_assets);
      const typesToAttach = hasAdGroupSitelinks
        ? ['CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE']
        : ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE'];
      const accountAssets = await listAssetsByTypes(typesToAttach);
      if (accountAssets.length > 0) {
        await attachAssetsToCampaign(campaignRn as string, accountAssets, dryRun || validateOnly);
      } else {
        console.log('  • No existing assets found to attach');
      }
    } catch (e) {
      console.log('  • Skipped asset attachment (query failed or no permissions)');
    }
  }
}

main().catch((e) => {
  console.error('create-campaigns failed:', e);
  process.exit(1);
});
