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
import { uniqueKeepOrder, buildFinalUrl, sanitizePathPart, normalizeText, requireEnv } from './lib/util';
import {
  ensureCampaignAssets,
  listAssetsByTypes,
  attachAssetsToCampaign,
  getSitelinkRNsByNamesOrText,
  attachSitelinksToAdGroup,
} from './lib/assets';
import { ensureAdGroup, ensureAdGroupBid, addKeywords, ensureKeywordBidsForAdGroup } from './lib/adgroups';
import { prepareRsaAssets as prepareRsaAssetsLib, addRSAs as addRSAsLib, ensureAtLeastOneRSA as ensureAtLeastOneRSALib } from './lib/rsa';
import {
  findBudgetByName,
  createBudget,
  findCampaignByName,
  createCampaign,
  ensureBudgetAmount,
  getCampaignBudgetRn,
  addCampaignNegatives,
  addCampaignLanguages,
  addCampaignLocationIds,
  addCampaignProximity,
} from './lib/campaign';

// Load env from .env.local (project root) first, then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}


// ----- RSA helpers are provided by lib/rsa -----

type RsaAugmentOpts = { useKeywordInsertion?: boolean; autoComplete?: boolean; kwTokens?: string[] };


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

// Removed enforced presence-only/network defaults; configure via JSON instead

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

// requireEnv and budget helpers moved to lib

const eurosToMicros = (eur: number): number => {
  return Math.round((eur || 0) * 1_000_000);
};

// Basic shape we expect for input config
type KeywordTier = { 
  maxCpc: number; 
  terms: string[]; 
  headlines?: string[]; 
  descriptions?: string[]; 
  landing_page?: string;
};
export type CampaignConfig = {
  name: string;
  budget_euros: number;
  landing_page: string;
  schedule: { start: string; end: string };
  keywords: Record<string, KeywordTier>;
  negativeKeywords?: string[];
  headlines?: string[];
  descriptions?: string[];
  languages?: string[]; // e.g., ['de']
  geo?: { mode: 'germany' | 'berlin_proximity'; radius_km?: number };
  replacements?: Record<string, string>;
  bidding?: { strategy?: 'MANUAL_CPC' | 'MAXIMIZE_CLICKS' | 'MAXIMIZE_CONVERSIONS'; cpc_ceiling_eur?: number };
  ads?: {
    final_url_params?: Record<string, string>;
    pinning_rules?: { price_regex?: string; privacy_phrase?: string };
    rsas_per_adgroup?: number;
    path1?: string;
    path2?: string;
    use_keyword_insertion?: boolean;
    auto_complete_assets?: boolean;
  };
  assets?: {
    sitelinks?: Array<{ text: string; url: string }>;
    callouts?: string[];
    structured_snippets?: Array<{ header: string; values: string[] }>;
    images?: Array<{ file_path?: string; url?: string; name?: string }>;
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

function normalizeConfig(parsed: unknown): CampaignConfig[] {
  if (Array.isArray(parsed)) {
    const campaigns = parsed as CampaignConfig[];
    for (const c of campaigns) {
      if (!c.name || !c.budget_euros || !c.landing_page || !c.schedule || !c.keywords) {
        throw new Error(`Campaign missing required fields: ${c.name ?? '<unnamed>'}`);
      }
    }
    return campaigns;
  }

  if (parsed && typeof parsed === 'object' && 'base' in (parsed as any) && 'variants' in (parsed as any)) {
    const { base, variants } = parsed as {
      base: CampaignConfig;
      variants: Array<Partial<CampaignConfig> & { name: string }>;
    };

    if (!base || !variants || !Array.isArray(variants)) {
      throw new Error('Config object with { base, variants } must include a base and an array of variants');
    }

    const campaigns: CampaignConfig[] = variants.map((variant, idx) => {
      const merged: CampaignConfig = {
        ...base,
        ...variant,
        keywords: variant.keywords || base.keywords,
        negativeKeywords: variant.negativeKeywords ?? base.negativeKeywords,
        languages: variant.languages || base.languages,
        geo: variant.geo || base.geo,
        bidding: variant.bidding || base.bidding,
        assets: variant.assets ?? base.assets,
        ads: {
          ...(base.ads || {}),
          ...(variant.ads || {}),
        },
      };

      if (!merged.name) {
        throw new Error(`Variant at index ${idx} is missing a name`);
      }
      if (!merged.budget_euros || !merged.landing_page || !merged.schedule || !merged.keywords) {
        throw new Error(`Variant ${merged.name} is missing required fields after merging with base`);
      }

      return merged;
    });

    return campaigns;
  }

  throw new Error('Config must be a JSON array of campaigns or an object with { base, variants }');
}

function loadConfigFromEnvOrArgs(): { rawJson: string; campaigns: CampaignConfig[] } {
  const args = parseArgs(process.argv.slice(2));
  const envJson = process.env.ADS_CONFIG_JSON;
  const argPath = (args['config'] as string) || process.env.ADS_CONFIG_PATH;

  let rawJson: string | undefined;
  if (envJson) {
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

  const campaigns = normalizeConfig(parsed);
  return { rawJson: JSON.stringify(campaigns), campaigns };
}

// moved to lib/campaign

// moved to lib/campaign

// moved to lib/campaign

// moved to lib/campaign

// language/geo helpers moved to lib/campaign

// addCampaignNegatives moved to lib/campaign


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

// sanitizePathPart provided by lib/util

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

  // (asset helpers moved to lib/assets)

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
        dryRun || validateOnly,
        c.bidding
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

    // Apply languages/geo only if provided in JSON
    if (Array.isArray(c.languages) && c.languages.length) {
      await addCampaignLanguages(customer, campaignRn as string, c.languages, dryRun || validateOnly);
    }
    if (c.geo?.mode === 'germany') {
      // Germany geo target ID = 2276
      await addCampaignLocationIds(customer, campaignRn as string, [2276], dryRun || validateOnly);
    } else if (c.geo?.mode === 'berlin_proximity') {
      if (typeof c.geo.radius_km !== 'number') {
        console.log('  • Geo skipped: berlin_proximity requires radius_km');
      } else {
        await addCampaignProximity(customer, campaignRn as string, 52.52, 13.405, c.geo.radius_km, dryRun || validateOnly);
      }
    }
    // Use only provided negative keywords (no hardcoded defaults)
    {
      const negEffective = Array.from(new Set([...(c.negativeKeywords || [])]));
      const failOnConflict = process.env.FAIL_ON_CONFLICT === 'true';
      preflightWarnNegativeConflicts(c, negEffective, failOnConflict);
      await addCampaignNegatives(
        customer,
        campaignRn as string,
        negEffective,
        dryRun || validateOnly
      );
    }

    // Ad group selection: use tiers exactly as provided in config
    const tiers = Object.entries(c.keywords || {});
    const allowedNames = new Set<string>();
    for (const [tierName, tier] of tiers) {
      const agName = `${c.name} — ${tierName}`;
      allowedNames.add(agName);
      const cpc = eurosToMicros(tier.maxCpc || 2.0);
      const adGroupRn = await ensureAdGroup(customer, campaignRn as string, agName, cpc, dryRun || validateOnly);
      if (process.env.ENFORCE_ADGROUP_BIDS === 'true') {
        await ensureAdGroupBid(customer, adGroupRn, cpc, dryRun || validateOnly);
      }
      await addKeywords(customer, adGroupRn, tier.terms || [], (tier.maxCpc || 2.0), dryRun || validateOnly);
      await ensureKeywordBidsForAdGroup(customer, adGroupRn, tier.terms || [], (tier.maxCpc || 2.0), dryRun || validateOnly);
      // No extra keyword injections; only what's in config
      const rsasPer = c.ads?.rsas_per_adgroup ?? 2;
      // Prepare RSA assets: auto-complete to 15/4, add CTAs/benefits, optional keyword insertion, include top KW tokens
      const kwTokensFromTier = Array.from(new Set([...(tier.terms || [])])).slice(0, 5);
      // Use tier-level headlines/descriptions if provided, otherwise fall back to campaign-level
      const tierHeadlines = tier.headlines || c.headlines;
      const tierDescriptions = tier.descriptions || c.descriptions;
      const prepared = prepareRsaAssetsLib(
        tierHeadlines,
        tierDescriptions,
        { useKeywordInsertion: c.ads?.use_keyword_insertion ?? true, autoComplete: c.ads?.auto_complete_assets ?? true, kwTokens: kwTokensFromTier }
      );
      // Use tier-level landing_page if provided, otherwise fall back to campaign-level
      const tierLandingPage = tier.landing_page || c.landing_page;
      await addRSAsLib(
        customer,
        adGroupRn,
        tierLandingPage,
        prepared.headlines,
        prepared.descriptions,
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
          const rns = await getSitelinkRNsByNamesOrText(customer, slNames);
          await attachSitelinksToAdGroup(customer, adGroupRn, rns, dryRun || validateOnly);
        }
      } catch (e) {
        console.log('    • Skipped ad-group sitelinks (no mapping or query failed)');
      }
      // Ensure at least one RSA exists — create fallbacks only if provided in private templates
      {
        const t = templates?.[c.name] as any;
        const fallbackH = Array.isArray(t?.headlines) ? (t.headlines as string[]) : (tierHeadlines || []);
        const fallbackD = Array.isArray(t?.descriptions) ? (t.descriptions as string[]) : (tierDescriptions || []);
        await ensureAtLeastOneRSALib(
          customer,
          adGroupRn,
          tierLandingPage,
          c.ads?.final_url_params,
          fallbackH,
          fallbackD,
          dryRun || validateOnly,
          c.ads?.path1,
          c.ads?.path2,
        );
      }
    }
    await pauseOtherAdGroups(customer, campaignRn as string, allowedNames, dryRun || validateOnly);

    // Update campaign dates: bring start_date forward to today if still pending; keep end date per config
    if (!dryRun && !validateOnly) {
      try {
        const todayIso = new Date().toISOString().slice(0, 10);
        try {
          await customer.campaigns.update([
            {
              resource_name: campaignRn,
              start_date: todayIso,
            },
          ], { partial_failure: true });
          console.log(`  ✓ Campaign start date set to ${todayIso}`);
        } catch (e) {
          console.log('  • Skipped start date update (may be unchanged or restricted)');
        }
        await customer.campaigns.update([
          {
            resource_name: campaignRn,
            end_date: c.schedule.end,
          },
        ], { partial_failure: true });
        console.log(`  ✓ Campaign end date set to ${c.schedule.end}`);
      } catch (e) {
        console.log('  • Skipped date updates (may be unchanged or restricted)');
      }
    }

    // Campaign-level assets: if provided in config, create & attach explicitly; else attach existing account assets
    if (c.assets) {
      await ensureCampaignAssets(customer, campaignRn as string, c.assets, dryRun || validateOnly);
    } else {
      try {
        const hasAdGroupSitelinks = !!(templates && templates[c.name] && (templates[c.name] as any).ad_group_assets);
        const typesToAttach = hasAdGroupSitelinks
          ? ['CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE']
          : ['SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET', 'IMAGE'];
        const accountAssets = await listAssetsByTypes(customer, typesToAttach);
        if (accountAssets.length > 0) {
          await attachAssetsToCampaign(customer, campaignRn as string, accountAssets, dryRun || validateOnly);
        } else {
          console.log('  • No existing assets found to attach');
        }
      } catch (e) {
        console.log('  • Skipped asset attachment (query failed or no permissions)');
      }
    }
  }
}

main().catch((e) => {
  console.error('create-campaigns failed:', e);
  process.exit(1);
});
