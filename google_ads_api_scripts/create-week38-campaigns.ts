#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env from .env.local (project root) first, then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

// === Local Configuration (no .env required) ===
// Target CPA in EUR for Maximize Conversions; set to 0 to disable tCPA
const TARGET_CPA_EUR = 20;
// Berlin ring proximity radius (km) for Depth campaign
const LOCAL_BERLIN_RING_RADIUS_KM = 20;
// Preferred conversion action name to optimize to (exact match if available)
const PREFERRED_CONVERSION_ACTION_NAME = 'Submit self-paid lead form';

async function ensureSitelinks(customer: any, campaignResource: string, cfg: CampaignConfig) {
  // Skip in dry run/validate-only
  if (DRY_RUN || VALIDATE_ONLY) {
    console.log('  ↪ DRY RUN: would add sitelinks (Preise, FAQ)');
    return false;
  }
  // Check if sitelinks already attached
  const existing = (await customer.query(
    `SELECT campaign_asset.resource_name
     FROM campaign_asset
     WHERE campaign_asset.campaign = '${campaignResource}'
       AND campaign_asset.field_type = 'SITELINK'
     LIMIT 1`
  )) as any[];
  if (existing && existing.length > 0) {
    console.log('  ↪ Skipping sitelinks (already present)');
    return false;
  }

  try {
    // Create sitelink assets
    const sep = cfg.landing_page.includes('?') ? '&' : '?';
    const pricingUrl = `${cfg.landing_page}${sep}sl=pricing`;
    const faqUrl = `${cfg.landing_page}${sep}sl=faq`;
    const assetsCreate: any = await customer.assets.create([
      { final_urls: [pricingUrl], sitelink_asset: { link_text: 'Preise' } },
      { final_urls: [faqUrl],   sitelink_asset: { link_text: 'FAQ' } },
    ]);
    const createdAssets: string[] = [];
    const arr = assetsCreate?.results || assetsCreate || [];
    for (const r of arr) {
      const rn = r?.resource_name;
      if (rn) createdAssets.push(rn);
    }
    if (createdAssets.length === 0) throw new Error('Sitelink asset creation returned no resource names');

    // Link assets to campaign
    const payloads = createdAssets.map((asset) => ({
      asset,
      campaign: campaignResource,
      field_type: enums.AssetFieldType.SITELINK,
    }));
    const linkRes: any = await customer.campaignAssets.create(payloads);
    console.log('  ✓ Sitelinks attached to campaign:', linkRes?.results?.length ?? createdAssets.length);
    return true;
  } catch (e) {
    try {
      console.warn('  ⚠️ Sitelinks skipped due to error:', JSON.stringify(e, null, 2));
    } catch {
      console.warn('  ⚠️ Sitelinks skipped due to error:', e);
    }
    return false;
  }
}

async function ensureSelectiveOptimization(
  customer: any,
  campaignResource: string,
  actionName: string
) {
  if (!actionName) return false;
  // Fetch exact match conversion action
  const ca = await querySingle(
    customer,
    `SELECT conversion_action.resource_name, conversion_action.name
     FROM conversion_action
     WHERE conversion_action.status = 'ENABLED' AND conversion_action.name = '${actionName.replace(/'/g, "''")}'
     LIMIT 1`
  );
  const caRes = ca?.conversion_action?.resource_name || (ca as any)?.conversionAction?.resourceName;
  if (!caRes) {
    console.warn(`⚠️  Conversion action not found: ${actionName}`);
    return false;
  }

  // Set campaign selective optimization to this action (idempotent update)
  try {
    await customer.campaigns.update([
      {
        resource_name: campaignResource,
        selective_optimization: { conversion_actions: [caRes] },
      },
    ]);
    console.log('  ✓ Linked conversion action (selective optimization):', actionName);
    return true;
  } catch (err: any) {
    try {
      console.warn('  ⚠️ Failed to link conversion action (continuing):', JSON.stringify(err, null, 2));
    } catch {
      console.warn('  ⚠️ Failed to link conversion action (continuing):', err);
    }
    return false;
  }
}

import { GoogleAdsApi, enums, ResourceNames, toMicros, type MutateOperation } from 'google-ads-api';
import { WEEK38_CONFIG, type CampaignConfig, type KeywordTier } from './campaign-config';

const DRY_RUN = process.env.DRY_RUN === 'true';
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === 'true' || DRY_RUN;

// Rejected keyword logging (Week38)
const logsDir = path.join(rootDir, 'logs');
const rejectedLogPath = path.join(logsDir, 'rejected-keywords-week38.jsonl');
const rejectedThisRun = new Set<string>();
function logRejectedKeyword(ctx: { campaignName: string; adGroupName: string }, term: string, error: unknown, replacedWith?: string) {
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const key = `${ctx.campaignName}::${ctx.adGroupName}::${term}`;
    if (rejectedThisRun.has(key)) return;
    rejectedThisRun.add(key);
    const rec = {
      ts: new Date().toISOString(),
      campaign: ctx.campaignName,
      adGroup: ctx.adGroupName,
      term,
      replacedWith: replacedWith || null,
      error: (() => {
        try { return typeof error === 'string' ? error : JSON.parse(JSON.stringify(error)); } catch { return String(error); }
      })(),
    };
    fs.appendFileSync(rejectedLogPath, `${JSON.stringify(rec)}\n`);
  } catch {}
}

const REPLACEMENTS: Record<string, string> = {
  'panikattacken': 'panikgefühle',
  'depression hilfe': 'tiefe traurigkeit hilfe',
  'angstzustände': 'starke angst',
  'ptbs hilfe': 'trauma folgen bewältigen',
  'essstörung hilfe': 'essverhalten regulieren hilfe',
  'zwang gedanken': 'aufdringliche gedanken hilfe',
  'trauma verarbeiten hilfe': 'trauma bewältigen hilfe',
  'burnout anzeichen': 'ausgebrannt fühlen',
};

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function toYyyymmdd(dateStr: string) {
  return dateStr.replace(/-/g, '');
}

function eurosToMicros(euros: number) {
  return Math.round(euros * 1_000_000);
}

function clampUnicode(str: string, max: number): string {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max);
}

function sanitizeHeadlines(headlines: string[]): string[] {
  // RSA headline max length: 30
  const MAX = 30;
  const unique = new Set<string>();
  const out: string[] = [];
  for (const h of headlines) {
    const t = clampUnicode(h || '', MAX).trim();
    if (t && !unique.has(t)) {
      unique.add(t);
      out.push(t);
    }
    if (out.length >= 15) break;
  }
  // Ensure at least 3 headlines by adding safe fallbacks
  while (out.length < 3) {
    const fallback = clampUnicode('Therapie Online', MAX);
    if (!unique.has(fallback)) {
      unique.add(fallback);
      out.push(fallback);
    } else break;
  }
  return out.slice(0, 15);
}

function sanitizeDescriptions(descs: string[]): string[] {
  // RSA description max length: 90
  const MAX = 90;
  const unique = new Set<string>();
  const out: string[] = [];
  for (const d of descs) {
    const t = clampUnicode(d || '', MAX).trim();
    if (t && !unique.has(t)) {
      unique.add(t);
      out.push(t);
    }
    if (out.length >= 4) break;
  }
  // Ensure at least 2 descriptions (Google requires 2-4)
  const fallbacks = [
    'Jetzt passende Therapie online finden.',
    'Vertraulich. Persönlich. Online.',
  ];
  let i = 0;
  while (out.length < 2 && i < fallbacks.length) {
    const f = clampUnicode(fallbacks[i++], MAX);
    if (!unique.has(f)) {
      unique.add(f);
      out.push(f);
    }
  }
  return out.slice(0, 4);
}

// Geo: Berlin ring approximation (S-Bahn ring) via proximity target
const BERLIN_CENTER = {
  latMicro: 52_520_008, // 52.520008 in micro degrees
  lonMicro: 13_404_954, // 13.404954 in micro degrees
};
const BERLIN_RING_RADIUS_KM = Math.max(1, Number(LOCAL_BERLIN_RING_RADIUS_KM) || 20);

async function querySingle(customer: any, q: string): Promise<any | null> {
  const r = await customer.query(q);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
}

// Return today's date in the customer's account time zone (YYYY-MM-DD)
async function getAccountTodayYyyyMmDd(customer: any): Promise<string> {
  try {
    const rows = (await customer.query(
      'SELECT customer.time_zone FROM customer LIMIT 1'
    )) as any[];
    const tz = rows?.[0]?.customer?.time_zone || (rows as any)?.[0]?.customer?.timeZone || 'UTC';
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(new Date());
  } catch {
    const fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
  }
}

function printPlan(cfg: CampaignConfig) {
  console.log(`\n— Plan: ${cfg.name}`);
  console.log('  Budget €:', cfg.budget_euros);
  console.log('  Landing :', cfg.landing_page);
  console.log('  Dates   :', cfg.schedule.start, '→', cfg.schedule.end);
  const tiers = Object.entries(cfg.keywords) as Array<[string, KeywordTier]> ;
  for (const [tier, data] of tiers) {
    console.log(`  AdGroup Tier: ${tier} — maxCpc €${data.maxCpc.toFixed(2)} — ${data.terms.length} keywords`);
  }
  if (cfg.negativeKeywords?.length) {
    console.log('  Negatives:', cfg.negativeKeywords.join(', '));
  }
  console.log('  Headlines:', cfg.headlines.length, '— Descriptions:', cfg.descriptions.length);
}

async function preflightCheck(customer: any) {
  console.log('\nPreflight checks...');
  // Billing setup
  const billing = (await customer.query(
    'SELECT billing_setup.status FROM billing_setup LIMIT 1'
  )) as any[];
  if (!billing || billing.length === 0) {
    throw new Error('❌ No billing setup found!');
  }

  // Enabled conversion actions (warn if none)
  const conversions = (await customer.query(
    "SELECT conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED'"
  )) as any[];
  if (!conversions || conversions.length === 0) {
    console.warn('⚠️  No active conversion actions found!');
  }

  // Language constant 'de'
  const lang = (await customer.query(
    "SELECT language_constant.resource_name, language_constant.code FROM language_constant WHERE language_constant.code = 'de' LIMIT 1"
  )) as any[];
  if (!lang || lang.length === 0) {
    throw new Error('❌ German language constant not found');
  }
  console.log('✅ Preflight checks passed');
}

// Resolve a conversion action suitable for optimization. Prefer explicit env name; otherwise pick first enabled LEAD.
async function resolveSelectiveOptimizationName(customer: any): Promise<string> {
  // Prefer explicit preferred conversion action by exact name
  if (PREFERRED_CONVERSION_ACTION_NAME) {
    const exact = await querySingle(
      customer,
      `SELECT conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED' AND conversion_action.name = '${PREFERRED_CONVERSION_ACTION_NAME.replace(/'/g, "''")}' LIMIT 1`
    );
    const name = exact?.conversion_action?.name || (exact as any)?.conversionAction?.name;
    if (name) return String(name);
  }
  // Query enabled conversions (limited) and pick a suitable "lead" category or name
  const rows = (await customer.query(
    "SELECT conversion_action.name, conversion_action.category FROM conversion_action WHERE conversion_action.status = 'ENABLED' LIMIT 50"
  )) as any[];
  const catOrder = new Set([
    'LEAD',
    'SUBMIT_LEAD_FORM',
    'QUALIFIED_LEAD',
    'IMPORTED_LEAD',
    'PHONE_CALL_LEAD',
  ]);
  // Try by category preference
  for (const r of rows) {
    const ca = (r as any)?.conversion_action || (r as any)?.conversionAction || {};
    const name = ca.name as string | undefined;
    const category = String(ca.category || '');
    if (catOrder.has(category) && name) return name;
  }
  // Fallback by name containing 'lead'
  for (const r of rows) {
    const ca = (r as any)?.conversion_action || (r as any)?.conversionAction || {};
    const name = String(ca.name || '');
    if (name.toLowerCase().includes('lead')) return name;
  }
  throw new Error('❌ No enabled Lead-like conversion action found. Set ADS_SELECTIVE_OPTIMIZATION_NAME or ensure a Lead conversion exists and is enabled.');
}

// Ensure campaign uses a dedicated (non-shared) budget compatible with Maximize Conversions
async function ensureDedicatedBudget(customer: any, campaignResource: string, cfg: CampaignConfig) {
  const row = await querySingle(
    customer,
    `SELECT 
       campaign.resource_name,
       campaign.campaign_budget,
       campaign_budget.resource_name,
       campaign_budget.name,
       campaign_budget.amount_micros,
       campaign_budget.explicitly_shared
     FROM campaign
     WHERE campaign.resource_name = '${campaignResource}'
     LIMIT 1`
  );
  const currentBudgetRes =
    row?.campaign?.campaign_budget || (row as any)?.campaign?.campaignBudget || row?.campaign_budget?.resource_name;
  const budgetName = row?.campaign_budget?.name || (row as any)?.campaignBudget?.name || '';
  const explicitlyShared =
    row?.campaign_budget?.explicitly_shared ?? (row as any)?.campaignBudget?.explicitlyShared ?? false;
  const desiredName = `${cfg.name} Budget`;

  const needsDedicated = explicitlyShared === true || String(budgetName) !== desiredName;
  if (!needsDedicated) {
    console.log('  ↪ Budget already dedicated:', budgetName || '(unnamed)');
    return;
  }

  if (DRY_RUN || VALIDATE_ONLY) {
    console.log('  ↪ DRY RUN: would create dedicated budget and switch campaign budget');
    return;
  }

  // Try to find an existing budget with the desired name and ensure it's not shared
  const existing = await querySingle(
    customer,
    `SELECT campaign_budget.resource_name, campaign_budget.name, campaign_budget.explicitly_shared
     FROM campaign_budget 
     WHERE campaign_budget.name = '${desiredName.replace(/'/g, "''")}'
     LIMIT 1`
  );
  const existingRes = existing?.campaign_budget?.resource_name || (existing as any)?.campaignBudget?.resourceName || '';
  const existingShared =
    existing?.campaign_budget?.explicitly_shared ?? (existing as any)?.campaignBudget?.explicitlyShared ?? false;

  let newBudgetRes = '';
  if (existingRes && existingShared === false) {
    newBudgetRes = existingRes;
    console.log('  ↪ Reusing existing dedicated budget:', newBudgetRes);
  } else {
    // Create a unique, non-shared budget
    const createName = existingShared ? `${desiredName} (Dedicated ${Date.now()})` : desiredName;
    const createRes: any = await customer.campaignBudgets.create([
      {
        name: createName,
        delivery_method: 'STANDARD',
        explicitly_shared: false,
        amount_micros: toMicros(cfg.budget_euros),
      },
    ]);
    newBudgetRes =
      createRes?.results?.[0]?.resource_name || createRes?.[0]?.resource_name || createRes?.resource_name || '';
    if (!newBudgetRes) throw new Error('Failed to create dedicated budget');
    console.log('  ✓ Created dedicated budget:', newBudgetRes);
  }

  // Switch campaign to the dedicated budget
  await customer.campaigns.update([
    { resource_name: campaignResource, campaign_budget: newBudgetRes },
  ]);
  console.log('  ✓ Switched campaign to dedicated budget');
}

async function ensureGermanLanguage(customer: any, campaignResource: string) {
  const existingLang = await querySingle(
    customer,
    `SELECT campaign_criterion.resource_name, campaign_criterion.language.language_constant
     FROM campaign_criterion
     WHERE campaign_criterion.campaign = '${campaignResource}'
       AND campaign_criterion.type = LANGUAGE`
  );
  if (existingLang?.campaign_criterion?.language?.language_constant) {
    return false; // already has a language criterion
  }
  const lang = await querySingle(
    customer,
    "SELECT language_constant.resource_name FROM language_constant WHERE language_constant.code = 'de' LIMIT 1"
  );
  const langRes = lang?.language_constant?.resource_name;
  if (!langRes) throw new Error('German language constant not found');
  const res: any = await customer.campaignCriteria.create([
    { campaign: campaignResource, language: { language_constant: langRes } },
  ]);
  console.log('  ✓ Language targeting added (de):', res?.results?.length ?? 1);
  return true;
}

// Ensure presence-only geo setting and correct geo criteria per campaign
async function ensureGeoTargetingForConfig(
  customer: any,
  campaignResource: string,
  cfg: CampaignConfig,
  existingCampaignResource: string | null
) {
  const isDepth = cfg.name.toUpperCase().includes('DEPTH SEEKERS');
  // Skip criteria ops on temp resource during validate-only
  if (campaignResource.endsWith('/-1')) {
    console.log('  ↪ Skipping geo criteria (validate-only on temporary resource)');
    return;
  }

  // Inspect existing location/proximity criteria
  const rows = (await customer.query(`
    SELECT 
      campaign_criterion.resource_name,
      campaign_criterion.type,
      campaign_criterion.negative,
      campaign_criterion.location.geo_target_constant,
      campaign_criterion.proximity.radius,
      campaign_criterion.proximity.radius_units,
      campaign_criterion.proximity.geo_point.latitude_in_micro_degrees,
      campaign_criterion.proximity.geo_point.longitude_in_micro_degrees
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = '${campaignResource}'
  `)) as any[];

  if (isDepth) {
    // Desired: single proximity around Berlin center with configured radius
    const hasDesiredProximity = rows.some((r: any) => {
      const cc = (r as any)?.campaign_criterion || (r as any)?.campaignCriterion || {};
      if ((cc.type || '').toString() !== 'PROXIMITY') return false;
      const prox = cc.proximity || {};
      const lat = Number(
        prox?.geo_point?.latitude_in_micro_degrees || prox?.geoPoint?.latitudeInMicroDegrees || 0
      );
      const lon = Number(
        prox?.geo_point?.longitude_in_micro_degrees || prox?.geoPoint?.longitudeInMicroDegrees || 0
      );
      const radius = Number(prox?.radius || 0);
      const units = String(prox?.radius_units || prox?.radiusUnits || '');
      return (
        lat === BERLIN_CENTER.latMicro &&
        lon === BERLIN_CENTER.lonMicro &&
        radius === BERLIN_RING_RADIUS_KM &&
        (units === 'KILOMETERS' || units === String(enums.ProximityRadiusUnits.KILOMETERS))
      );
    });

    // Determine mismatching criteria to remove
    const toRemove: string[] = rows
      .filter((r: any) => {
        const cc = (r as any)?.campaign_criterion || (r as any)?.campaignCriterion || {};
        const rn = cc.resource_name || cc.resourceName;
        if (!rn) return false;
        if ((cc.type || '').toString() === 'LOCATION') return true;
        if ((cc.type || '').toString() === 'PROXIMITY') {
          // remove any non-desired proximity
          const prox = cc.proximity || {};
          const lat = Number(
            prox?.geo_point?.latitude_in_micro_degrees || prox?.geoPoint?.latitudeInMicroDegrees || 0
          );
          const lon = Number(
            prox?.geo_point?.longitude_in_micro_degrees || prox?.geoPoint?.longitudeInMicroDegrees || 0
          );
          const radius = Number(prox?.radius || 0);
          const units = String(prox?.radius_units || prox?.radiusUnits || '');
          const match =
            lat === BERLIN_CENTER.latMicro &&
            lon === BERLIN_CENTER.lonMicro &&
            radius === BERLIN_RING_RADIUS_KM &&
            (units === 'KILOMETERS' || units === String(enums.ProximityRadiusUnits.KILOMETERS));
          return !match;
        }
        return false;
      })
      .map((r: any) => (r.campaign_criterion?.resource_name || (r as any)?.campaignCriterion?.resourceName) as string)
      .filter(Boolean);

    if (!hasDesiredProximity) {
      if (DRY_RUN || VALIDATE_ONLY) {
        console.log('  ↪ DRY RUN: would add Berlin proximity targeting');
      } else {
        const res: any = await customer.campaignCriteria.create([
          {
            campaign: campaignResource,
            proximity: {
              radius: BERLIN_RING_RADIUS_KM,
              radius_units: enums.ProximityRadiusUnits.KILOMETERS,
              geo_point: {
                latitude_in_micro_degrees: BERLIN_CENTER.latMicro,
                longitude_in_micro_degrees: BERLIN_CENTER.lonMicro,
              },
            },
          },
        ]);
        console.log('  ✓ Proximity targeting ensured (Berlin):', res?.results?.length ?? 1);
      }
    } else {
      console.log('  ↪ Berlin proximity targeting already present');
    }

    if (toRemove.length > 0) {
      if (DRY_RUN || VALIDATE_ONLY) {
        console.log(`  ↪ DRY RUN: would remove ${toRemove.length} existing location criteria`);
      } else {
        await customer.campaignCriteria.remove(toRemove);
        console.log('  ✓ Removed conflicting location criteria:', toRemove.length);
      }
    }
  } else {
    // Wellness: ensure Germany targeting exists
    const hasGermany = rows.some((r: any) => {
      const cc = (r as any)?.campaign_criterion || (r as any)?.campaignCriterion || {};
      const geo = cc.location?.geo_target_constant || cc.location?.geoTargetConstant || '';
      return String(geo).endsWith('/2276');
    });
    if (!hasGermany) {
      if (DRY_RUN || VALIDATE_ONLY) {
        console.log('  ↪ DRY RUN: would add Germany location targeting');
      } else {
        const res: any = await customer.campaignCriteria.create([
          { campaign: campaignResource, location: { geo_target_constant: 'geoTargetConstants/2276' } },
        ]);
        console.log('  ✓ Germany location targeting ensured:', res?.results?.length ?? 1);
      }
    } else {
      console.log('  ↪ Germany location targeting already present');
    }
  }

  // Ensure campaign-level negative keywords from config
  if (Array.isArray(cfg.negativeKeywords) && cfg.negativeKeywords.length > 0) {
    const negRows = (await customer.query(`
      SELECT 
        campaign_criterion.resource_name,
        campaign_criterion.keyword.text,
        campaign_criterion.negative
      FROM campaign_criterion
      WHERE campaign_criterion.campaign = '${campaignResource}' AND campaign_criterion.type = KEYWORD
    `)) as any[];
    const existingNeg = new Set<string>(
      negRows
        .filter((r: any) => (r.campaign_criterion?.negative ?? (r as any)?.campaignCriterion?.negative) === true)
        .map((r: any) => String(r.campaign_criterion?.keyword?.text || (r as any)?.campaignCriterion?.keyword?.text || ''))
        .filter(Boolean)
    );
    const toAdd = cfg.negativeKeywords.filter((k) => !existingNeg.has(k));
    if (toAdd.length > 0) {
      if (DRY_RUN || VALIDATE_ONLY) {
        console.log(`  ↪ DRY RUN: would add ${toAdd.length} negative keywords`);
      } else {
        const payloads = toAdd.map((kw) => ({
          campaign: campaignResource,
          negative: true,
          keyword: { text: kw, match_type: 'BROAD' },
        }));
        const res: any = await customer.campaignCriteria.create(payloads);
        console.log('  ✓ Negative keywords ensured:', res?.results?.length ?? toAdd.length);
      }
    } else {
      console.log('  ↪ All negative keywords already present');
    }
  }
}

async function main() {
  console.log('Week 38 Campaign Creation');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes will be made)' : 'APPLY (will create resources)');

  const client = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });
  const hooks: any = {
    onMutationError: async ({ error }: any) => {
      try {
        console.error('Google Ads API mutation error:', JSON.stringify(error, null, 2));
      } catch {
        console.error('Google Ads API mutation error:', error);
      }
    },
    onServiceError: async ({ error, method }: any) => {
      try {
        console.error('Google Ads API service error in', method, ':', JSON.stringify(error, null, 2));
      } catch {
        console.error('Google Ads API service error in', method, ':', error);
      }
    },
  };
  if (VALIDATE_ONLY) {
    hooks.onMutationStart = async ({ editOptions }: any) => {
      editOptions({ validate_only: true });
    };
  }

  const customer = client.Customer(
    {
      customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
    },
    hooks
  );

  if (!DRY_RUN && process.env.CONFIRM_APPLY !== 'true') {
    console.error('❌ Safety guard: Set CONFIRM_APPLY=true to apply changes. Re-run in DRY_RUN=true to validate first.');
    process.exit(1);
  }

  // Load config from private JSON if present (prefer ADS_CONFIG_JSON env over file path)
  const defaultConfigPath = path.join(rootDir, 'google_ads_api_scripts', 'private', 'week38.json');
  const configPath = process.env.ADS_CONFIG_PATH || defaultConfigPath;
  let configs: CampaignConfig[] = [WEEK38_CONFIG.wellness, WEEK38_CONFIG.depth];
  let usedEmbedded = true;
  try {
    if (process.env.ADS_CONFIG_JSON) {
      const jsonStr = process.env.ADS_CONFIG_JSON as string;
      const json = JSON.parse(jsonStr);
      if (Array.isArray(json)) {
        configs = json as CampaignConfig[];
        console.log('Config source: ADS_CONFIG_JSON environment variable');
        usedEmbedded = false;
      } else {
        console.warn('⚠️ ADS_CONFIG_JSON is not an array, falling back to file/embedded');
      }
    } else if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json)) {
        configs = json as CampaignConfig[];
        console.log('Config source:', configPath);
        usedEmbedded = false;
      } else {
        console.warn('⚠️ Config JSON is not an array, falling back to embedded');
      }
    } else {
      console.log('Config source: embedded TypeScript (WEEK38_CONFIG)');
    }
  } catch (e) {
    try { console.warn('⚠️ Failed to read private config, falling back:', JSON.stringify(e, null, 2)); } catch { console.warn('⚠️ Failed to read private config, falling back:', e); }
    console.log('Config source: embedded TypeScript (WEEK38_CONFIG)');
  }

  if (usedEmbedded && process.env.ALLOW_EMBEDDED_ADS_CONFIG !== 'true') {
    console.error('❌ Private ads config required. Create a JSON file at', configPath, 'or set ADS_CONFIG_PATH to a private file.');
    console.error('   To intentionally use the embedded sample (not recommended), set ALLOW_EMBEDDED_ADS_CONFIG=true');
    process.exit(1);
  }

  // Validate configs
  for (const c of configs) {
    if (!c.keywords || Object.keys(c.keywords).length === 0) {
      console.error('❌ Invalid ads config: campaign has no keyword tiers:', c.name);
      process.exit(1);
    }
  }

  // Idempotency: skip if campaign already exists by exact name
  async function ensureCampaign(cfg: CampaignConfig, selOptName: string) {
    // plan output
    printPlan(cfg);

    const existing = await querySingle(
      customer,
      `SELECT campaign.resource_name, campaign.name, campaign.status FROM campaign WHERE campaign.name = '${cfg.name.replace(/'/g, "''")}' AND campaign.status != 'REMOVED' LIMIT 1`
    );
    const existingCampaignResource: string | null = existing?.campaign?.resource_name || null;

    if (VALIDATE_ONLY) {
      if (existingCampaignResource) {
        console.log('  ↪ VALIDATE ONLY: campaign exists, validating updates (dates/network/geo/bidding)');
        // Validate dedicated budget migration (no writes)
        await ensureDedicatedBudget(customer, existingCampaignResource, cfg);
        await customer.campaigns.update([
          {
            resource_name: existingCampaignResource,
            network_settings: {
              target_google_search: true,
              target_search_network: false,
              target_content_network: true,
              target_partner_search_network: false,
            },
            end_date: toYyyymmdd(cfg.schedule.end),
            // Presence-only + switch to Maximize Conversions
            geo_target_type_setting: {
              positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
              negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
            },
            maximize_conversions: {},
          },
        ]);
        console.log('  ✓ Validation passed for campaign updates');
        // Validate geo criteria changes as well
        await ensureGeoTargetingForConfig(customer, existingCampaignResource, cfg, existingCampaignResource);
        return null;
      }
      // Build atomic operations with existing budget reuse to avoid duplicate-name validation failures
      const customerId = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
      const budgetName = `${cfg.name} Budget`;
      const existingBudget = await querySingle(
        customer,
        `SELECT campaign_budget.resource_name, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
      );
      const budgetTemp = ResourceNames.campaignBudget(customerId, '-1');
      const ops: MutateOperation<any>[] = [];
      const todayAccTz = await getAccountTodayYyyyMmDd(customer);
      const includeStart = String(cfg.schedule.start) >= todayAccTz;

      // Include budget create only when a budget with that name doesn't already exist
      const budgetResourceForCampaign = existingBudget?.campaignBudget?.resourceName || existingBudget?.campaign_budget?.resource_name || budgetTemp;
      if (!existingBudget) {
        ops.push({
          entity: 'campaign_budget',
          operation: 'create',
          resource: {
            resource_name: budgetTemp,
            name: budgetName,
            delivery_method: enums.BudgetDeliveryMethod.STANDARD,
            explicitly_shared: false,
            amount_micros: toMicros(cfg.budget_euros),
          },
        });
      }

      ops.push({
        entity: 'campaign',
        operation: 'create',
        resource: {
          name: cfg.name,
          advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
          status: enums.CampaignStatus.PAUSED,
          contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
          // Bidding: Maximize Conversions (optional tCPA via local constant)
          maximize_conversions: ((): any => {
            const t = Number(TARGET_CPA_EUR || 0);
            if (t && !Number.isNaN(t)) return { target_cpa_micros: eurosToMicros(t) };
            return {};
          })(),
          // Geo targeting behavior: presence-only
          geo_target_type_setting: {
            positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
            negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
          },
          campaign_budget: budgetResourceForCampaign,
          network_settings: {
            target_google_search: true,
            target_search_network: false,
            target_content_network: true,
            target_partner_search_network: false,
          },
          ...(includeStart ? { start_date: toYyyymmdd(cfg.schedule.start) } : {}),
          end_date: toYyyymmdd(cfg.schedule.end),
        },
      });

      console.log('  ↪ VALIDATE ONLY: validating Budget + Campaign creation (no writes)…');
      await customer.mutateResources(ops as any);
      console.log('  ✓ Validation passed for Budget + Campaign');
      // Validate criteria operations to be applied post-create
      await ensureGeoTargetingForConfig(customer, ResourceNames.campaign(customerId, '-1'), cfg, null);
      return null;
    }

    // APPLY: Atomic mutate with budget reuse (or use existing)
    const customerId = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
    const budgetName = `${cfg.name} Budget`;
    const existingBudget = await querySingle(
      customer,
      `SELECT campaign_budget.resource_name, campaign_budget.name, campaign_budget.explicitly_shared FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
    );
    const budgetTemp = ResourceNames.campaignBudget(customerId, '-1');
    const ops: MutateOperation<any>[] = [];
    const todayAccTz = await getAccountTodayYyyyMmDd(customer);
    const includeStart = String(cfg.schedule.start) >= todayAccTz;

    let campaignResource = existingCampaignResource;
    if (campaignResource) {
      console.log('  ↪ Using existing campaign:', campaignResource);
      // Ensure campaign uses a dedicated (non-shared) budget compatible with Maximize Conversions
      await ensureDedicatedBudget(customer, campaignResource, cfg);
      // Update existing campaign with dates and network settings
      await customer.campaigns.update([
        {
          resource_name: campaignResource,
          network_settings: {
            target_google_search: true,
            target_search_network: false,
            target_content_network: true,
            target_partner_search_network: false,
          },
          end_date: toYyyymmdd(cfg.schedule.end),
          // Presence-only + switch to Maximize Conversions
          geo_target_type_setting: {
            positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
            negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
          },
          maximize_conversions: ((): any => {
            const t = Number(TARGET_CPA_EUR || 0);
            if (t && !Number.isNaN(t)) return { target_cpa_micros: eurosToMicros(t) };
            return {};
          })(),
        },
      ]);
      console.log('  ✓ Campaign updated (dates/network)');
    } else {
      // Create or reuse a dedicated budget, then create the campaign in separate calls
      const existingIsShared =
        existingBudget?.campaign_budget?.explicitly_shared ?? (existingBudget as any)?.campaignBudget?.explicitlyShared ?? false;
      let budgetResourceForCampaign: string = '';
      if (existingBudget && existingIsShared === false) {
        budgetResourceForCampaign = existingBudget?.campaignBudget?.resourceName || existingBudget?.campaign_budget?.resource_name || '';
        console.log('  ↪ Reusing existing dedicated budget:', budgetResourceForCampaign);
      } else {
        console.log('  ↪ Creating dedicated budget for campaign');
        const budgetCreate: any = await customer.campaignBudgets.create([
          {
            name: `${budgetName} (Dedicated ${Date.now()})`,
            delivery_method: enums.BudgetDeliveryMethod.STANDARD,
            explicitly_shared: false,
            amount_micros: toMicros(cfg.budget_euros),
          },
        ]);
        budgetResourceForCampaign =
          budgetCreate?.results?.[0]?.resource_name || budgetCreate?.[0]?.resource_name || budgetCreate?.resource_name || '';
        if (!budgetResourceForCampaign) throw new Error('Budget creation failed: no resource_name');
        console.log('  ✓ Dedicated budget created:', budgetResourceForCampaign);
      }

      // Create campaign
      const createCampRes: any = await customer.campaigns.create([
        {
          name: cfg.name,
          advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
          status: enums.CampaignStatus.PAUSED,
          contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
          maximize_conversions: ((): any => {
            const t = Number(TARGET_CPA_EUR || 0);
            if (t && !Number.isNaN(t)) return { target_cpa_micros: eurosToMicros(t) };
            return {};
          })(),
          geo_target_type_setting: {
            positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE,
            negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE,
          },
          campaign_budget: budgetResourceForCampaign,
          network_settings: {
            target_google_search: true,
            target_search_network: false,
            target_content_network: true,
            target_partner_search_network: false,
          },
          ...(includeStart ? { start_date: toYyyymmdd(cfg.schedule.start) } : {}),
          end_date: toYyyymmdd(cfg.schedule.end),
        },
      ]);
      campaignResource =
        createCampRes?.results?.[0]?.resource_name || createCampRes?.[0]?.resource_name || createCampRes?.resource_name || '';
      if (!campaignResource) throw new Error('Campaign creation failed: no campaign resource_name in create response');
      console.log('  ✓ Campaign created:', campaignResource);
    }

    // 3) Ensure correct geo targeting (Germany for Wellness, Berlin proximity for Depth)
    await ensureGeoTargetingForConfig(customer, campaignResource, cfg, existingCampaignResource);

    // 4) Ensure German language targeting for both new and existing campaigns
    await ensureGermanLanguage(customer, campaignResource);

    // 4b) Ensure sitelinks (Preise, FAQ)
    await ensureSitelinks(customer, campaignResource, cfg);

    // 5) Create ad groups + keywords + ads
    await createAdGroupsKeywordsAndAds(customer, campaignResource, cfg);

    // 6) Link conversion action for optimization
    if (selOptName) {
      await ensureSelectiveOptimization(customer, campaignResource, selOptName);
    }

    return { resource_name: campaignResource, name: cfg.name };
  }

  // Preflight (queries only)
  await preflightCheck(customer);

  // Resolve conversion action name (fail-fast if missing)
  const resolvedSelOptName = await resolveSelectiveOptimizationName(customer);
  if (DRY_RUN) {
    console.log('ℹ️ Selected conversion action for optimization:', resolvedSelOptName);
  }

  for (const cfg of configs) {
    await ensureCampaign(cfg, resolvedSelOptName);
  }

  console.log('\n📊 Campaign Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━');
  for (const cfg of configs) {
    console.log(`✅ ${cfg.name}: PAUSED - €${cfg.budget_euros}/day budget`);
  }
  console.log('\n⚠️  NEXT STEPS:');
  console.log('1. Review in Google Ads UI');
  console.log('2. Check ad previews');
  console.log('3. Enable campaigns manually');
  console.log('4. Optionally link conversion action (selective optimization)');

  console.log('\nDone.', DRY_RUN ? '(dry run)' : '');
}

async function createAdGroupsKeywordsAndAds(customer: any, campaignResourceName: string, cfg: CampaignConfig) {
  const tiers = Object.entries(cfg.keywords) as Array<[string, KeywordTier]>;

  for (const [tierName, data] of tiers) {
    const adGroupName = `${cfg.name} - ${tierName}`;
    if (DRY_RUN) {
      console.log(`  ↪ DRY RUN: would ensure AdGroup '${adGroupName}' with ${data.terms.length} keywords (maxCpc €${data.maxCpc})`);
      continue;
    }

    // Ensure ad group by name
    const existingAdGroup = await querySingle(
      customer,
      `SELECT ad_group.resource_name, ad_group.name FROM ad_group WHERE ad_group.campaign = '${campaignResourceName}' AND ad_group.name = '${adGroupName.replace(/'/g, "''")}' LIMIT 1`
    );
    let adGroupResource: string | null = existingAdGroup?.ad_group?.resource_name || null;
    let justCreated = false;
    if (adGroupResource) {
      console.log('  ↪ Using existing AdGroup:', adGroupResource);
    } else {
      const adGroupCreate: any = await customer.adGroups.create([
        {
          campaign: campaignResourceName,
          name: adGroupName,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
          cpc_bid_micros: eurosToMicros(data.maxCpc),
        },
      ]);
      adGroupResource =
        adGroupCreate?.results?.[0]?.resource_name || adGroupCreate?.[0]?.resource_name || adGroupCreate?.resource_name;
      if (!adGroupResource) throw new Error('Ad group creation failed: no resource_name');
      console.log('  ✓ AdGroup created:', adGroupResource);
      justCreated = true;
    }

    // Add only missing keywords (phrase match)
    if (data.terms.length > 0 && adGroupResource) {
      const existingKeywordsRows = (await customer.query(`
        SELECT ad_group_criterion.keyword.text
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = KEYWORD AND ad_group_criterion.ad_group = '${adGroupResource}'
      `)) as any[];
      const existingKeywordSet = new Set<string>(
        existingKeywordsRows.map((r: any) => r.ad_group_criterion?.keyword?.text).filter(Boolean)
      );
      const toCreate = data.terms.filter((t) => !existingKeywordSet.has(t));
      if (toCreate.length === 0) {
        console.log('    ↪ All keywords already present');
      } else if (DRY_RUN || VALIDATE_ONLY) {
        console.log(`    ↪ DRY RUN: would add ${toCreate.length} keywords`);
      } else {
        let ok = 0;
        let failed = 0;
        for (const term of toCreate) {
          try {
            await customer.adGroupCriteria.create([
              { ad_group: adGroupResource!, keyword: { text: term, match_type: 'PHRASE' } },
            ]);
            ok++;
          } catch (e) {
            failed++;
            logRejectedKeyword({ campaignName: cfg.name, adGroupName }, term, e);
            try { console.warn('    ⚠️  Keyword rejected:', term, JSON.stringify(e, null, 2)); } catch { console.warn('    ⚠️  Keyword rejected:', term, e); }
            const repl = REPLACEMENTS[term.toLowerCase() as keyof typeof REPLACEMENTS];
            if (repl && !existingKeywordSet.has(repl)) {
              try {
                await customer.adGroupCriteria.create([
                  { ad_group: adGroupResource!, keyword: { text: repl, match_type: 'PHRASE' } },
                ]);
                ok++;
                logRejectedKeyword({ campaignName: cfg.name, adGroupName }, term, e, repl);
                console.log(`    ↪ Substituted rejected term with: ${repl}`);
              } catch (e2) {
                logRejectedKeyword({ campaignName: cfg.name, adGroupName }, term, e2, repl);
                try { console.warn('    ⚠️  Replacement also rejected:', repl, JSON.stringify(e2, null, 2)); } catch { console.warn('    ⚠️  Replacement also rejected:', repl, e2); }
              }
            }
          }
        }
        if (ok > 0) console.log(`    ✓ Keywords added: ${ok}${failed > 0 ? ` (failed: ${failed})` : ''}`);
        else console.log(`    ⚠️ No keywords added (failed: ${failed})`);
      }
    }

    // Create two RSA variants (A/B) only when we just created the ad group (idempotent)
    if (justCreated) {
      await createResponsiveSearchAd(customer, adGroupResource!, cfg, 'A');
      await createResponsiveSearchAd(customer, adGroupResource!, cfg, 'B');
    } else {
      console.log('    ↪ Skipping RSA creation (ad group pre-exists)');
    }
  }
}

async function createResponsiveSearchAd(
  customer: any,
  adGroupResourceName: string,
  cfg: CampaignConfig,
  variant: 'A' | 'B'
) {
  if (DRY_RUN) {
    console.log(`    ↪ DRY RUN: would create RSA variant ${variant}`);
    return;
  }

  const variantHeadlines = [...cfg.headlines];
  // EARTH-168: Campaign-specific A/B overrides
  const upperName = cfg.name.toUpperCase();
  if (upperName.includes('CONSCIOUS WELLNESS SEEKERS')) {
    if (variant === 'A') variantHeadlines[5] = 'Der nächste Schritt deiner Heilungsreise';
    else variantHeadlines[5] = 'Finde deinen Therapeuten - diese Woche noch';
  } else if (upperName.includes('DEPTH SEEKERS')) {
    if (variant === 'A') variantHeadlines[5] = 'Wieder spüren statt nur schaffen';
    else variantHeadlines[5] = 'Wage einen ehrlichen Blick in deine Innenwelt';
  }

  const headlines = sanitizeHeadlines(variantHeadlines);
  // Guard strong-claim descriptions behind variant B
  const strongPhrases = [/diese\s*woche/i, /heute/i, /sofort/i, /keine\s*warteliste/i];
  const variantDescriptions = cfg.descriptions.filter((d) => {
    if (variant === 'B') return true;
    // For A: exclude strong claims
    return !strongPhrases.some((re) => re.test(d));
  });
  const descriptions = sanitizeDescriptions(variantDescriptions);

  const adCreate: any = await customer.adGroupAds.create([
    {
      ad_group: adGroupResourceName,
      status: 'ENABLED',
      ad: {
        final_urls: [`${cfg.landing_page}?v=${variant}`],
        tracking_url_template: `${cfg.landing_page}?v=${variant}&gclid={gclid}&keyword={keyword}`,
        responsive_search_ad: {
          headlines: headlines.map((text) => ({ text })),
          descriptions: descriptions.map((text) => ({ text })),
        },
      },
    },
  ]);
  const adResource = adCreate?.results?.[0]?.resource_name || adCreate?.[0]?.resource_name || adCreate?.resource_name;
  if (!adResource) throw new Error('Ad creation failed: no resource_name');
  console.log(`    ✓ RSA ${variant} created:`, adResource);
}

main().catch((e) => {
  try {
    console.error('Fatal:', JSON.stringify(e, null, 2));
  } catch (_) {
    console.error('Fatal:', e);
  }
  process.exit(1);
});
