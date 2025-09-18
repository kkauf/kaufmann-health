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

import { GoogleAdsApi, enums, ResourceNames, toMicros, type MutateOperation } from 'google-ads-api';
import { WEEK38_CONFIG, type CampaignConfig, type KeywordTier } from './campaign-config';

const DRY_RUN = process.env.DRY_RUN === 'true';
const VALIDATE_ONLY = process.env.VALIDATE_ONLY === 'true' || DRY_RUN;

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
  // Ensure at least 1 description
  if (out.length === 0) out.push('Jetzt passende Therapie online finden.');
  return out.slice(0, 4);
}

async function querySingle(customer: any, q: string): Promise<any | null> {
  const r = await customer.query(q);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
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

  // Idempotency: skip if campaign already exists by exact name
  async function ensureCampaign(cfg: CampaignConfig) {
    // plan output
    printPlan(cfg);

    const existing = await querySingle(
      customer,
      `SELECT campaign.resource_name, campaign.name, campaign.status FROM campaign WHERE campaign.name = '${cfg.name.replace(/'/g, "''")}' LIMIT 1`
    );
    const existingCampaignResource: string | null = existing?.campaign?.resource_name || null;

    if (VALIDATE_ONLY) {
      // Build atomic operations with existing budget reuse to avoid duplicate-name validation failures
      const customerId = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
      const budgetName = `${cfg.name} Budget`;
      const existingBudget = await querySingle(
        customer,
        `SELECT campaign_budget.resource_name, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
      );
      const budgetTemp = ResourceNames.campaignBudget(customerId, '-1');
      const ops: MutateOperation<any>[] = [];

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
          manual_cpc: { enhanced_cpc_enabled: false },
          campaign_budget: budgetResourceForCampaign,
          network_settings: {
            target_google_search: true,
            target_search_network: true,
          },
        },
      });

      console.log('  ↪ VALIDATE ONLY: validating Budget + Campaign creation (no writes)…');
      await customer.mutateResources(ops as any);
      console.log('  ✓ Validation passed for Budget + Campaign');
      return null;
    }

    // APPLY: Atomic mutate with budget reuse (or use existing)
    const customerId = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
    const budgetName = `${cfg.name} Budget`;
    const existingBudget = await querySingle(
      customer,
      `SELECT campaign_budget.resource_name, campaign_budget.name FROM campaign_budget WHERE campaign_budget.name = '${budgetName.replace(/'/g, "''")}' LIMIT 1`
    );
    const budgetTemp = ResourceNames.campaignBudget(customerId, '-1');
    const ops: MutateOperation<any>[] = [];

    let campaignResource = existingCampaignResource;
    if (campaignResource) {
      console.log('  ↪ Using existing campaign:', campaignResource);
    } else {
      const budgetResourceForCampaign = existingBudget?.campaignBudget?.resourceName || existingBudget?.campaign_budget?.resource_name || budgetTemp;
      if (existingBudget) {
        console.log('  ↪ Reusing existing budget:', budgetResourceForCampaign);
      } else {
        ops.push({
          entity: 'campaign_budget',
          operation: 'create',
          resource: {
            resource_name: budgetTemp,
            name: budgetName,
            delivery_method: enums.BudgetDeliveryMethod.STANDARD,
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
          manual_cpc: { enhanced_cpc_enabled: false },
          campaign_budget: budgetResourceForCampaign,
          network_settings: {
            target_google_search: true,
            target_search_network: true,
          },
        },
      });

      let mutateResult: any;
      try {
        mutateResult = await customer.mutateResources(ops as any);
      } catch (err: any) {
        try {
          console.error('Mutate failure (apply):', JSON.stringify(err, null, 2));
        } catch {
          console.error('Mutate failure (apply):', err);
        }
        throw err;
      }
      const mutateResultsArray = mutateResult?.results || mutateResult || [];
      const createdCampaignRes = Array.isArray(mutateResultsArray)
        ? mutateResultsArray.find((r: any) => (r.resource_name || '').includes('/campaigns/'))
        : null;
      campaignResource = createdCampaignRes?.resource_name;
      if (!campaignResource) throw new Error('Campaign creation failed: no campaign resource_name in mutate result');
      console.log('  ✓ Campaign created:', campaignResource);
    }

    // 3) Add Germany location targeting and negatives only for newly created campaigns to avoid duplicates
    if (!existingCampaignResource) {
      const criteriaPayloads: any[] = [
        {
          campaign: campaignResource,
          location: { geo_target_constant: 'geoTargetConstants/2276' },
        },
      ];

      for (const kw of cfg.negativeKeywords || []) {
        criteriaPayloads.push({
          campaign: campaignResource,
          negative: true,
          keyword: { text: kw, match_type: 'BROAD' },
        });
      }

      const campaignCriteriaCreate: any = await customer.campaignCriteria.create(criteriaPayloads);
      const createdCriteria = campaignCriteriaCreate?.results?.length ?? 0;
      console.log('  ✓ Campaign criteria created:', createdCriteria);
    } else {
      console.log('  ↪ Skipping campaign criteria (geo/negatives) for existing campaign');
    }

    // 5) Create ad groups + keywords + ads
    await createAdGroupsKeywordsAndAds(customer, campaignResource, cfg);

    return { resource_name: campaignResource, name: cfg.name };
  }

  await ensureCampaign(WEEK38_CONFIG.wellness);
  await ensureCampaign(WEEK38_CONFIG.depth);

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
      if (toCreate.length > 0) {
        const tryCreate = async (terms: string[]) => {
          const payloads = terms.map((term) => ({
            ad_group: adGroupResource!,
            keyword: { text: term, match_type: 'PHRASE' },
          }));
          return customer.adGroupCriteria.create(payloads);
        };

        try {
          const res: any = await tryCreate(toCreate);
          console.log('    ✓ Keywords added:', res?.results?.length ?? toCreate.length);
        } catch (err: any) {
          // Attempt to parse violating terms and retry without them
          let violating: string[] = [];
          try {
            const e = typeof err === 'string' ? JSON.parse(err) : err;
            const errors = e?.errors || [];
            for (const item of errors) {
              const vt = item?.details?.policy_violation_details?.key?.violating_text;
              if (vt) violating.push(vt);
            }
          } catch {}
          violating = Array.from(new Set(violating));
          if (violating.length > 0) {
            const filtered = toCreate.filter((t) => !violating.includes(t));
            console.warn('    ⚠️ Skipping policy-flagged keywords:', violating);
            if (filtered.length > 0) {
              const res2: any = await tryCreate(filtered);
              console.log('    ✓ Keywords added after filtering:', res2?.results?.length ?? filtered.length);
            }
          } else {
            // Re-throw if not a policy violation parseable error
            throw err;
          }
        }
      } else {
        console.log('    ↪ All keywords already present');
      }
    }

    // Create two RSA variants (A/B) only if no ads exist yet
    const existingAds = (await customer.query(`
      SELECT ad_group_ad.resource_name FROM ad_group_ad WHERE ad_group_ad.ad_group = '${adGroupResource}' LIMIT 1
    `)) as any[];
    if (!existingAds || existingAds.length === 0) {
      await createResponsiveSearchAd(customer, adGroupResource!, cfg, 'A');
      await createResponsiveSearchAd(customer, adGroupResource!, cfg, 'B');
    } else {
      console.log('    ↪ Skipping RSA creation (ads already exist)');
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
  // Light variant tweak per EARTH-156 (will be clamped)
  if (variant === 'A') variantHeadlines[5] = 'Der nächste Schritt deiner Heilungsreise';
  else variantHeadlines[5] = 'Schnell starten – keine Warteliste';

  const headlines = sanitizeHeadlines(variantHeadlines);
  const descriptions = sanitizeDescriptions(cfg.descriptions);

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
