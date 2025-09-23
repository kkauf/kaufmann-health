#!/usr/bin/env tsx
/**
 * DEPRECATED: This script is superseded by `google_ads_api_scripts/create-campaigns.ts`.
 * Please use the unified CLI:
 *   - Dry run:   npm run ads:create:dry -- --config=google_ads_api_scripts/private/your-campaigns.json
 *   - Apply:     CONFIRM_APPLY=true npm run ads:create -- --config=google_ads_api_scripts/private/your-campaigns.json
 * It remains for reference during migration and will be archived in a future cleanup.
 */
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

import { GoogleAdsApi, enums, ResourceNames } from 'google-ads-api';
import { EARTH170_CONFIG } from './campaign-config-earth170';
import type { CampaignConfig, KeywordTier } from './campaign-config';

const DRY_RUN = process.env.DRY_RUN === 'true';
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === 'true' || DRY_RUN;

// Rejected keyword logging
const logsDir = path.join(rootDir, 'logs');
const rejectedLogPath = path.join(logsDir, 'rejected-keywords.jsonl');
const rejectedThisRun = new Set<string>();
function logRejectedKeyword(ctx: { campaignName: string; adGroupName: string }, term: string, error: unknown, replacedWith?: string) {
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const key = `${ctx.campaignName}::${ctx.adGroupName}::${term}`;
    if (rejectedThisRun.has(key)) return; // avoid duplicates in same run
    rejectedThisRun.add(key);
    const rec = {
      ts: new Date().toISOString(),
      campaign: ctx.campaignName,
      adGroup: ctx.adGroupName,
      term,
      replacedWith: replacedWith || null,
      error: (() => {
        try {
          return typeof error === 'string' ? error : JSON.parse(JSON.stringify(error));
        } catch {
          return String(error);
        }
      })(),
    };
    fs.appendFileSync(rejectedLogPath, `${JSON.stringify(rec)}\n`);
  } catch (e) {
    // best-effort logging; ignore errors
  }
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

function toMicros(amount: number) {
  return Math.round(amount * 1_000_000);
}

function eurosToMicros(euros: number) {
  return Math.round(euros * 1_000_000);
}

function toYyyymmdd(dateStr: string) {
  return dateStr.replace(/-/g, '');
}

async function querySingle(customer: any, q: string): Promise<any | null> {
  const r = await customer.query(q);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
}

async function preflight(customer: any) {
  // Language present?
  const lang = (await customer.query(
    "SELECT language_constant.resource_name, language_constant.code FROM language_constant WHERE language_constant.code = 'de' LIMIT 1"
  )) as any[];
  if (!lang || lang.length === 0) throw new Error('German language constant not found');
}

// Geo helpers
const BERLIN_CENTER = { latMicro: 52_520_008, lonMicro: 13_404_954 };
const RADIUS_RING_KM = 20; // Berlin S-Bahn ring approximation (use for all Berlin proximity)

async function ensureGermanLanguage(customer: any, campaignRes: string) {
  const existing = await querySingle(
    customer,
    `SELECT campaign_criterion.resource_name FROM campaign_criterion WHERE campaign_criterion.campaign = '${campaignRes}' AND campaign_criterion.type = LANGUAGE LIMIT 1`
  );
  if (existing) return false;
  const lang = await querySingle(
    customer,
    "SELECT language_constant.resource_name FROM language_constant WHERE language_constant.code = 'de' LIMIT 1"
  );
  const langRes = lang?.language_constant?.resource_name;
  if (!langRes) throw new Error('German language constant not found');
  if (DRY_RUN || VALIDATE_ONLY) {
    console.log('  ↪ DRY RUN: would add German language targeting');
  } else {
    await customer.campaignCriteria.create([{ campaign: campaignRes, language: { language_constant: langRes } }]);
    console.log('  ✓ Language targeting (de) ensured');
  }
  return true;
}

async function ensureGeo(customer: any, campaignRes: string, cfg: CampaignConfig) {
  // Skip criteria ops on temp resource during validate-only (resource does not persist)
  if (String(campaignRes).endsWith('/-1')) {
    console.log('  ↪ Skipping geo criteria (validate-only on temporary resource)');
    return;
  }
  const url = new URL(cfg.landing_page);
  const path = url.pathname || '';
  const rows = (await customer.query(
    `SELECT campaign_criterion.resource_name, campaign_criterion.type, campaign_criterion.location.geo_target_constant, campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units, campaign_criterion.proximity.geo_point.latitude_in_micro_degrees, campaign_criterion.proximity.geo_point.longitude_in_micro_degrees FROM campaign_criterion WHERE campaign_criterion.campaign = '${campaignRes}'`
  )) as any[];

  // Helper: remove specific LOCATION/PROXIMITY criteria by resource names
  const removeCriteria = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (DRY_RUN || VALIDATE_ONLY) {
      console.log(`  ↪ DRY RUN: would remove ${ids.length} geo criteria`);
    } else {
      await customer.campaignCriteria.remove(ids);
      console.log('  ✓ Removed geo criteria:', ids.length);
    }
  };

  if (path.includes('/ankommen-in-dir')) {
    const hasGermany = rows.some((r: any) => {
      const geo = r?.campaign_criterion?.location?.geo_target_constant || r?.campaign_criterion?.location?.geoTargetConstant || '';
      return String(geo).endsWith('/2276');
    });
    if (!hasGermany) {
      // Remove only LOCATION and PROXIMITY criteria before adding Germany targeting
      const toRemove: string[] = rows
        .filter((r: any) => {
          const t = String(r?.campaign_criterion?.type || '');
          return t === 'LOCATION' || t === 'PROXIMITY';
        })
        .map((r: any) => r?.campaign_criterion?.resource_name)
        .filter(Boolean);
      await removeCriteria(toRemove);
      if (DRY_RUN || VALIDATE_ONLY) console.log('  ↪ DRY RUN: would add Germany location targeting');
      else {
        await customer.campaignCriteria.create([
          { campaign: campaignRes, location: { geo_target_constant: 'geoTargetConstants/2276' } },
        ]);
        console.log('  ✓ Germany targeting ensured');
      }
    } else {
      console.log('  ↪ Germany location targeting already present');
    }
    return;
  }

  // Berlin proximity (use ring radius for all Berlin proximity targeting)
  const radius = RADIUS_RING_KM;
  const hasDesiredProximity = rows.some((r: any) => {
    const cc = r?.campaign_criterion || {};
    if ((cc.type || '').toString() !== 'PROXIMITY') return false;
    const prox = cc.proximity || {};
    const lat = Number(prox?.geo_point?.latitude_in_micro_degrees || prox?.geoPoint?.latitudeInMicroDegrees || 0);
    const lon = Number(prox?.geo_point?.longitude_in_micro_degrees || prox?.geoPoint?.longitudeInMicroDegrees || 0);
    const rad = Number(prox?.radius || 0);
    const units = String(prox?.radius_units || prox?.radiusUnits || '');
    return (
      lat === BERLIN_CENTER.latMicro &&
      lon === BERLIN_CENTER.lonMicro &&
      rad === radius &&
      (units === 'KILOMETERS' || units === String(enums.ProximityRadiusUnits.KILOMETERS))
    );
  });
  // Remove Germany location or mismatching proximities
  const toRemoveBerlin: string[] = rows
    .filter((r: any) => {
      const cc = r?.campaign_criterion || {};
      const t = String(cc.type || '');
      if (t === 'LOCATION') return true; // remove country targeting for Berlin proximity campaigns
      if (t === 'PROXIMITY') {
        const prox = cc.proximity || {};
        const lat = Number(prox?.geo_point?.latitude_in_micro_degrees || prox?.geoPoint?.latitudeInMicroDegrees || 0);
        const lon = Number(prox?.geo_point?.longitude_in_micro_degrees || prox?.geoPoint?.longitudeInMicroDegrees || 0);
        const rad = Number(prox?.radius || 0);
        const units = String(prox?.radius_units || prox?.radiusUnits || '');
        const match =
          lat === BERLIN_CENTER.latMicro &&
          lon === BERLIN_CENTER.lonMicro &&
          rad === radius &&
          (units === 'KILOMETERS' || units === String(enums.ProximityRadiusUnits.KILOMETERS));
        return !match;
      }
      return false;
    })
    .map((r: any) => r?.campaign_criterion?.resource_name)
    .filter(Boolean);
  await removeCriteria(toRemoveBerlin);

  if (!hasDesiredProximity) {
    if (DRY_RUN || VALIDATE_ONLY) console.log('  ↪ DRY RUN: would add Berlin proximity targeting');
    else {
      await customer.campaignCriteria.create([
        {
          campaign: campaignRes,
          proximity: {
            radius,
            radius_units: enums.ProximityRadiusUnits.KILOMETERS,
            geo_point: {
              latitude_in_micro_degrees: BERLIN_CENTER.latMicro,
              longitude_in_micro_degrees: BERLIN_CENTER.lonMicro,
            },
          },
        },
      ]);
      console.log('  ✓ Berlin proximity targeting ensured');
    }
  } else {
    console.log('  ↪ Berlin proximity targeting already present');
  }
}

function sanitizeHeadlines(headlines: string[]): string[] {
  const MAX = 30;
  const unique = new Set<string>();
  const out: string[] = [];
  for (const h of headlines) {
    const t = (h || '').slice(0, MAX).trim();
    if (t && !unique.has(t)) {
      unique.add(t);
      out.push(t);
    }
    if (out.length >= 15) break;
  }
  while (out.length < 3) {
    const fallback = 'Körperorientierte Therapie';
    if (!unique.has(fallback)) {
      unique.add(fallback);
      out.push(fallback);
    } else break;
  }
  return out.slice(0, 15);
}

function sanitizeDescriptions(descs: string[]): string[] {
  const MAX = 90;
  const unique = new Set<string>();
  const out: string[] = [];
  for (const d of descs) {
    const t = (d || '').slice(0, MAX).trim();
    if (t && !unique.has(t)) {
      unique.add(t);
      out.push(t);
    }
    if (out.length >= 4) break;
  }
  while (out.length < 2) {
    const f = 'Jetzt passende Begleitung finden.';
    if (!unique.has(f)) {
      unique.add(f);
      out.push(f);
    } else break;
  }
  return out.slice(0, 4);
}

async function ensureNegativeKeywords(customer: any, campaignRes: string, cfg: CampaignConfig) {
  if (!Array.isArray(cfg.negativeKeywords) || cfg.negativeKeywords.length === 0) return;
  const rows = (await customer.query(
    `SELECT campaign_criterion.resource_name, campaign_criterion.keyword.text, campaign_criterion.negative FROM campaign_criterion WHERE campaign_criterion.campaign = '${campaignRes}' AND campaign_criterion.type = KEYWORD`
  )) as any[];
  const existing = new Set(
    rows
      .filter((r: any) => (r.campaign_criterion?.negative ?? (r as any)?.campaignCriterion?.negative) === true)
      .map((r: any) => String(r.campaign_criterion?.keyword?.text || (r as any)?.campaignCriterion?.keyword?.text || ''))
      .filter(Boolean)
  );
  const toAdd = cfg.negativeKeywords.filter((k) => !existing.has(k));
  if (toAdd.length === 0) return console.log('  ↪ All negative keywords already present');
  if (DRY_RUN || VALIDATE_ONLY) console.log(`  ↪ DRY RUN: would add ${toAdd.length} negative keywords`);
  else {
    const payloads = toAdd.map((kw) => ({ campaign: campaignRes, negative: true, keyword: { text: kw, match_type: 'BROAD' } }));
    await customer.campaignCriteria.create(payloads);
    console.log('  ✓ Negative keywords ensured:', toAdd.length);
  }
}

// Ensure a dedicated (non-shared) budget exists and is linked to the campaign
async function ensureDedicatedBudget(customer: any, campaignRes: string, cfg: CampaignConfig) {
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
     WHERE campaign.resource_name = '${campaignRes}'
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
    return false;
  }

  if (DRY_RUN || VALIDATE_ONLY) {
    console.log('  ↪ DRY RUN: would create dedicated budget and switch campaign budget');
    return false;
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
    { resource_name: campaignRes, campaign_budget: newBudgetRes },
  ]);
  console.log('  ✓ Switched campaign to dedicated budget');
  return true;
}

async function ensureCampaign(customer: any, cfg: CampaignConfig) {
  console.log(`\n— Plan: ${cfg.name}`);
  console.log('  Budget €:', cfg.budget_euros);
  console.log('  Landing :', cfg.landing_page, '(v=C)');
  console.log('  Dates   :', cfg.schedule.start, '→', cfg.schedule.end);

  const clientId = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
  const existing = await querySingle(
    customer,
    `SELECT campaign.resource_name, campaign.name, campaign.status FROM campaign WHERE campaign.name = '${cfg.name.replace(/'/g, "''")}' AND campaign.status != 'REMOVED' LIMIT 1`
  );
  const existingRes: string | null = existing?.campaign?.resource_name || null;

  if (VALIDATE_ONLY) {
    if (existingRes) {
      console.log('  ↪ VALIDATE ONLY: updating existing campaign (network/dates/bidding/geo/lang)');
      await customer.campaigns.update([
        {
          resource_name: existingRes,
          network_settings: { target_google_search: true, target_search_network: false, target_content_network: true, target_partner_search_network: false },
          end_date: toYyyymmdd(cfg.schedule.end),
          geo_target_type_setting: { positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE, negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE },
          maximize_conversions: {},
        },
      ]);
      await ensureGermanLanguage(customer, existingRes);
      await ensureGeo(customer, existingRes, cfg);
      await ensureNegativeKeywords(customer, existingRes, cfg);
      return existingRes;
    }

    // Validate create with temp resources
    const campTemp = ResourceNames.campaign(clientId, '-1');
    const budgetName = `${cfg.name} Budget`;
    const existingBudget = await querySingle(
      customer,
      `SELECT campaign_budget.resource_name, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
    );
    // Use distinct temp IDs for budget and campaign to avoid DUPLICATE_TEMP_IDS
    const budgetTemp = ResourceNames.campaignBudget(clientId, '-2');
    const budgetResourceForCampaign = existingBudget?.campaignBudget?.resourceName || existingBudget?.campaign_budget?.resource_name || budgetTemp;
    const ops: any[] = [];
    if (!existingBudget) {
      ops.push({
        entity: 'campaign_budget',
        operation: 'create',
        resource: {
          resource_name: budgetTemp,
          name: budgetName,
          delivery_method: 'STANDARD',
          explicitly_shared: false,
          amount_micros: toMicros(cfg.budget_euros),
        },
      });
    }
    ops.push({
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: campTemp,
        name: cfg.name,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        status: enums.CampaignStatus.PAUSED,
        contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
        network_settings: { target_google_search: true, target_search_network: false, target_content_network: true, target_partner_search_network: false },
        start_date: toYyyymmdd(cfg.schedule.start),
        end_date: toYyyymmdd(cfg.schedule.end),
        maximize_conversions: {},
        geo_target_type_setting: { positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE, negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE },
        campaign_budget: budgetResourceForCampaign,
      },
    });
    console.log('  ↪ VALIDATE ONLY: validating campaign creation');
    await customer.mutateResources(ops);
    await ensureGeo(customer, campTemp, cfg);
    console.log('  ✓ Validation passed');
    return null;
  }

  // APPLY
  if (!existingRes) {
    // Create or reuse a dedicated budget, then create the campaign referencing it
    const budgetName = `${cfg.name} Budget`;
    const existingBudget = await querySingle(
      customer,
      `SELECT campaign_budget.resource_name, campaign_budget.name, campaign_budget.explicitly_shared FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
    );
    let budgetResourceForCampaign: string = '';
    const existingIsShared =
      existingBudget?.campaign_budget?.explicitly_shared ?? (existingBudget as any)?.campaignBudget?.explicitlyShared ?? false;
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

    const createRes: any = await customer.campaigns.create([
      {
        name: cfg.name,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        status: enums.CampaignStatus.PAUSED,
        contains_eu_political_advertising: enums.EuPoliticalAdvertisingStatus.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING,
        network_settings: { target_google_search: true, target_search_network: false, target_content_network: true, target_partner_search_network: false },
        start_date: toYyyymmdd(cfg.schedule.start),
        end_date: toYyyymmdd(cfg.schedule.end),
        maximize_conversions: {},
        geo_target_type_setting: { positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE, negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE },
        campaign_budget: budgetResourceForCampaign,
      },
    ]);
    const res = createRes?.results?.[0]?.resource_name || createRes?.[0]?.resource_name || createRes?.resource_name;
    if (!res) throw new Error('Campaign creation failed: no resource_name');
    console.log('  ✓ Campaign created:', res);
    await ensureGermanLanguage(customer, res);
    await ensureGeo(customer, res, cfg);
    await ensureNegativeKeywords(customer, res, cfg);
    return res;
  } else {
    console.log('  ↪ Using existing campaign:', existingRes);
    await ensureDedicatedBudget(customer, existingRes, cfg);
    await customer.campaigns.update([
      {
        resource_name: existingRes,
        network_settings: { target_google_search: true, target_search_network: false, target_content_network: true, target_partner_search_network: false },
        end_date: toYyyymmdd(cfg.schedule.end),
        maximize_conversions: {},
        geo_target_type_setting: { positive_geo_target_type: enums.PositiveGeoTargetType.PRESENCE, negative_geo_target_type: enums.NegativeGeoTargetType.PRESENCE },
      },
    ]);
    await ensureGermanLanguage(customer, existingRes);
    await ensureGeo(customer, existingRes, cfg);
    await ensureNegativeKeywords(customer, existingRes, cfg);
    return existingRes;
  }
}

async function addKeywords(
  customer: any,
  adGroupRes: string,
  data: KeywordTier,
  ctx: { campaignName: string; adGroupName: string }
) {
  if (!data.terms.length) return;
  const rows = (await customer.query(
    `SELECT ad_group_criterion.keyword.text FROM ad_group_criterion WHERE ad_group_criterion.type = KEYWORD AND ad_group_criterion.ad_group = '${adGroupRes}'`
  )) as any[];
  const existing = new Set<string>(rows.map((r: any) => r?.ad_group_criterion?.keyword?.text).filter(Boolean));
  const toCreate = data.terms.filter((t) => !existing.has(t));
  if (toCreate.length === 0) return console.log('    ↪ All keywords already present');
  if (DRY_RUN || VALIDATE_ONLY) {
    console.log(`    ↪ DRY RUN: would add ${toCreate.length} keywords`);
    return;
  }
  let ok = 0;
  let failed = 0;
  for (const term of toCreate) {
    try {
      await customer.adGroupCriteria.create([
        { ad_group: adGroupRes, keyword: { text: term, match_type: 'PHRASE' } },
      ]);
      ok++;
    } catch (e) {
      failed++;
      logRejectedKeyword(ctx, term, e);
      try { console.warn('    ⚠️  Keyword rejected:', term, JSON.stringify(e, null, 2)); } catch { console.warn('    ⚠️  Keyword rejected:', term, e); }
      const repl = REPLACEMENTS[term.toLowerCase() as keyof typeof REPLACEMENTS];
      if (repl && !existing.has(repl)) {
        try {
          await customer.adGroupCriteria.create([
            { ad_group: adGroupRes, keyword: { text: repl, match_type: 'PHRASE' } },
          ]);
          ok++;
          logRejectedKeyword(ctx, term, e, repl);
          console.log(`    ↪ Substituted rejected term with: ${repl}`);
        } catch (e2) {
          logRejectedKeyword(ctx, term, e2, repl);
          try { console.warn('    ⚠️  Replacement also rejected:', repl, JSON.stringify(e2, null, 2)); } catch { console.warn('    ⚠️  Replacement also rejected:', repl, e2); }
        }
      }
    }
  }
  if (ok > 0) console.log(`    ✓ Keywords added: ${ok}${failed > 0 ? ` (failed: ${failed})` : ''}`);
  else console.log(`    ⚠️ No keywords added (failed: ${failed})`);
}

async function createRSA(customer: any, adGroupRes: string, cfg: CampaignConfig) {
  const headlines = sanitizeHeadlines(cfg.headlines);
  const descriptions = sanitizeDescriptions(cfg.descriptions);

  // Pin price and privacy when present
  const formatHeadline = (text: string): any => {
    const h: any = { text };
    const t = text.toLowerCase();
    if (t.includes('80-120') || t.includes('80–120')) h.pinned_field = 'HEADLINE_1';
    if (t.includes('ohne krankenkasseneintrag')) h.pinned_field = 'HEADLINE_2';
    return h;
  };

  if (DRY_RUN || VALIDATE_ONLY) {
    console.log('    ↪ DRY RUN: would create RSA with v=C final URL');
    return;
  }

  const res: any = await customer.adGroupAds.create([
    {
      ad_group: adGroupRes,
      status: 'ENABLED',
      ad: {
        final_urls: [`${cfg.landing_page}?v=C`],
        tracking_url_template: `${cfg.landing_page}?v=C&gclid={gclid}&keyword={keyword}`,
        responsive_search_ad: {
          headlines: headlines.map(formatHeadline),
          descriptions: descriptions.map((text) => ({ text })),
        },
      },
    },
  ]);
  const adRes = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!adRes) throw new Error('Ad creation failed: no resource_name');
  console.log('    ✓ RSA created:', adRes);
}

async function ensureAdGroupsKeywordsAndAds(customer: any, campaignRes: string, cfg: CampaignConfig) {
  const tiers = Object.entries(cfg.keywords) as Array<[string, KeywordTier]>;
  for (const [tierName, data] of tiers) {
    const adGroupName = `${cfg.name} - ${tierName}`;
    if (DRY_RUN) {
      console.log(`  ↪ DRY RUN: would ensure AdGroup '${adGroupName}' with ${data.terms.length} keywords (maxCpc €${data.maxCpc})`);
      continue;
    }
    const existing = await querySingle(
      customer,
      `SELECT ad_group.resource_name, ad_group.name FROM ad_group WHERE ad_group.campaign = '${campaignRes}' AND ad_group.name = '${adGroupName.replace(/'/g, "''")}' LIMIT 1`
    );
    let adGroupRes: string | null = existing?.ad_group?.resource_name || null;
    let justCreated = false;
    if (!adGroupRes) {
      const created: any = await customer.adGroups.create([
        { campaign: campaignRes, name: adGroupName, status: 'ENABLED', type: 'SEARCH_STANDARD', cpc_bid_micros: eurosToMicros(data.maxCpc) },
      ]);
      adGroupRes = created?.results?.[0]?.resource_name || created?.[0]?.resource_name || created?.resource_name;
      if (!adGroupRes) throw new Error('Ad group creation failed: no resource_name');
      console.log('  ✓ AdGroup created:', adGroupRes);
      justCreated = true;
    } else {
      console.log('  ↪ Using existing AdGroup:', adGroupRes);
    }

    await addKeywords(customer, adGroupRes!, data, { campaignName: cfg.name, adGroupName });

    // Ensure at least 2 RSAs exist (idempotent on retries)
    const adsRows = (await customer.query(
      `SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines
       FROM ad_group_ad 
       WHERE ad_group_ad.ad_group = '${adGroupRes}' AND ad_group_ad.status != 'REMOVED'`
    )) as any[];
    const existingRsaCount = adsRows.filter((r: any) => {
      const ad = r?.ad_group_ad?.ad || (r as any)?.adGroupAd?.ad || {};
      const type = String(ad.type || '');
      return type === 'RESPONSIVE_SEARCH_AD' || !!ad.responsive_search_ad;
    }).length;
    const needed = Math.max(0, 2 - existingRsaCount);
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        try {
          await createRSA(customer, adGroupRes!, cfg);
        } catch (e) {
          try { console.warn('    ⚠️ Failed to create RSA (will continue):', JSON.stringify(e, null, 2)); } catch { console.warn('    ⚠️ Failed to create RSA (will continue):', e); }
        }
      }
    } else if (justCreated) {
      // For freshly created groups with unexpected existing ads, log state
      console.log('    ↪ RSAs already present:', existingRsaCount);
    } else {
      console.log('    ↪ RSAs already present:', existingRsaCount);
    }
  }
}

async function main() {
  console.log('EARTH-170 Campaign Creation');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes will be made)' : 'APPLY (will create resources)');

  const client = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });
  const hooks: any = {};
  if (VALIDATE_ONLY) {
    hooks.onMutationStart = async ({ editOptions }: any) => editOptions({ validate_only: true });
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
    console.error('❌ Safety guard: Set CONFIRM_APPLY=true to apply changes. Re-run with DRY_RUN=true to validate first.');
    process.exit(1);
  }

  await preflight(customer);

  // Load config from private JSON if present (prefer ADS_CONFIG_JSON env over file path)
  const defaultConfigPath = path.join(rootDir, 'google_ads_api_scripts', 'private', 'earth170.json');
  const configPath = process.env.ADS_CONFIG_PATH || defaultConfigPath;
  let configs: CampaignConfig[] = EARTH170_CONFIG;
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
        console.warn('⚠️ Config JSON is not an array, falling back to TypeScript config');
        console.log('Config source: embedded TypeScript (EARTH170_CONFIG)');
      }
    } else {
      console.log('Config source: embedded TypeScript (EARTH170_CONFIG)');
    }
  } catch (e) {
    try { console.warn('⚠️ Failed to read private config, falling back:', JSON.stringify(e, null, 2)); } catch { console.warn('⚠️ Failed to read private config, falling back:', e); }
    console.log('Config source: embedded TypeScript (EARTH170_CONFIG)');
  }

  if (usedEmbedded && process.env.ALLOW_EMBEDDED_ADS_CONFIG !== 'true') {
    console.error('❌ Private ads config required. Create a JSON file at', configPath, 'or set ADS_CONFIG_PATH to a private file.');
    console.error('   To intentionally use the embedded sample (not recommended), set ALLOW_EMBEDDED_ADS_CONFIG=true');
    process.exit(1);
  }

  // Sanity: ensure each campaign has at least one keyword tier
  for (const c of configs) {
    if (!c.keywords || Object.keys(c.keywords).length === 0) {
      console.error('❌ Invalid ads config: campaign has no keyword tiers:', c.name);
      process.exit(1);
    }
  }

  for (const cfg of configs) {
    try {
      const campaignRes = await ensureCampaign(customer, cfg);
      if (campaignRes) {
        await ensureAdGroupsKeywordsAndAds(customer, campaignRes, cfg);
      }
    } catch (e) {
      try { console.error('Error for config', cfg.name, JSON.stringify(e, null, 2)); } catch { console.error('Error for config', cfg.name, e); }
    }
  }

  console.log('\nDone.', DRY_RUN ? '(dry run)' : '');
}

main().catch((e) => {
  try { console.error('Fatal:', JSON.stringify(e, null, 2)); } catch { console.error('Fatal:', e); }
  process.exit(1);
});
