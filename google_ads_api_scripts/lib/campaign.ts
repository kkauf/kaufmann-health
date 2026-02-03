import { enums } from 'google-ads-api';
import { requireEnv } from './util';

type BiddingConfig = {
  strategy?: 'MANUAL_CPC' | 'MAXIMIZE_CLICKS' | 'MAXIMIZE_CONVERSIONS';
  cpc_ceiling_eur?: number;
  target_cpa_eur?: number;
};

const eurosToMicros = (eur: number): number => Math.round((eur || 0) * 1_000_000);

export const findBudgetByName = async (customer: any, name: string): Promise<string | undefined> => {
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

export const createBudget = async (customer: any, name: string, amountMicros: number, dryRun: boolean): Promise<string> => {
  if (dryRun) {
    console.log(`  [DRY] Would create budget: ${name} (€${(amountMicros / 1_000_000).toFixed(2)}/day)`);
    return `customers/${requireEnv('GOOGLE_ADS_CUSTOMER_ID')}/campaignBudgets/DRY_${Date.now()}`;
  }
  const res: any = await customer.campaignBudgets.create([
    { name, amount_micros: amountMicros, delivery_method: 'STANDARD', explicitly_shared: false },
  ]);
  const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!rn) throw new Error('Failed to create budget (no resource_name)');
  console.log(`  ✓ Budget ready: ${rn}`);
  return rn as string;
};

export const findCampaignByName = async (customer: any, name: string): Promise<{ resourceName: string; status?: any } | undefined> => {
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

export const createCampaign = async (
  customer: any,
  name: string,
  budgetResourceName: string,
  startDate: string,
  endDate: string,
  dryRun: boolean,
  bidding?: BiddingConfig
): Promise<string> => {
  if (dryRun) {
    console.log(`  [DRY] Would create campaign: ${name} (PAUSED)`);
    return `customers/${requireEnv('GOOGLE_ADS_CUSTOMER_ID')}/campaigns/DRY_${Date.now()}`;
  }
  let res: any;
  try {
    const strategy = bidding?.strategy || 'MANUAL_CPC';
    const cpcCeilMicros = typeof bidding?.cpc_ceiling_eur === 'number' ? eurosToMicros(bidding!.cpc_ceiling_eur!) : undefined;
    
    // Determine bidding strategy type and settings
    let biddingStrategyType: any;
    let manualCpc: any = undefined;
    let targetSpend: any = undefined;
    let maximizeConversions: any = undefined;
    
    if (strategy === 'MAXIMIZE_CONVERSIONS') {
      biddingStrategyType = enums.BiddingStrategyType.MAXIMIZE_CONVERSIONS;
      const tcpaMicros = typeof bidding?.target_cpa_eur === 'number' ? eurosToMicros(bidding.target_cpa_eur) : undefined;
      maximizeConversions = tcpaMicros ? { target_cpa_micros: tcpaMicros } : {};
    } else if (strategy === 'MAXIMIZE_CLICKS') {
      biddingStrategyType = enums.BiddingStrategyType.TARGET_SPEND;
      targetSpend = cpcCeilMicros ? { cpc_bid_ceiling_micros: cpcCeilMicros } : {};
    } else {
      biddingStrategyType = enums.BiddingStrategyType.MANUAL_CPC;
      manualCpc = {};
    }
    
    res = await customer.campaigns.create([
      {
        name,
        status: enums.CampaignStatus.PAUSED,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        bidding_strategy_type: biddingStrategyType,
        manual_cpc: manualCpc,
        target_spend: targetSpend,
        maximize_conversions: maximizeConversions,
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
      const details = e?.errors?.map((er: any) => ({ code: er?.error_code, message: er?.message, trigger: er?.trigger, location: er?.location }));
      console.error('  Details:', JSON.stringify(details, null, 2));
    } catch {}
    throw e;
  }
  const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name || res?.resource_name;
  if (!rn) throw new Error('Failed to create campaign (no resource_name)');
  console.log(`  ✓ Campaign created (PAUSED): ${rn}`);
  return rn as string;
};

export const getBudgetAmountMicros = async (customer: any, budgetRn: string): Promise<number | undefined> => {
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

export const ensureBudgetAmount = async (customer: any, budgetRn: string, amountMicros: number, dryRun: boolean) => {
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
    { resource_name: budgetRn, amount_micros: amountMicros },
  ], { partial_failure: true });
  console.log(`  ✓ Budget updated to €${(amountMicros/1_000_000).toFixed(2)}/day`);
};

export async function ensureCampaignBidding(customer: any, campaignRn: string, bidding: BiddingConfig | undefined, dryRun: boolean) {
  if (!bidding?.strategy) return;

  // Query current bidding settings
  const rows: any[] = await customer.query(`
    SELECT campaign.bidding_strategy_type, campaign.maximize_conversions.target_cpa_micros, campaign.target_spend.cpc_bid_ceiling_micros
    FROM campaign
    WHERE campaign.resource_name = '${campaignRn}'
    LIMIT 1
  `);
  const c = (rows?.[0] as any)?.campaign || {};
  const currentType = c.bidding_strategy_type;
  const currentTcpaMicros = c.maximize_conversions?.target_cpa_micros ?? 0;
  const currentCpcCeilMicros = c.target_spend?.cpc_bid_ceiling_micros ?? 0;

  const desiredStrategy = bidding.strategy;
  const desiredTcpaMicros = typeof bidding.target_cpa_eur === 'number' ? eurosToMicros(bidding.target_cpa_eur) : 0;
  const desiredCpcCeilMicros = typeof bidding.cpc_ceiling_eur === 'number' ? eurosToMicros(bidding.cpc_ceiling_eur) : 0;

  // Map strategy names to Google Ads enum values
  const strategyMap: Record<string, number> = {
    'MAXIMIZE_CONVERSIONS': enums.BiddingStrategyType.MAXIMIZE_CONVERSIONS,
    'MAXIMIZE_CLICKS': enums.BiddingStrategyType.TARGET_SPEND,
    'MANUAL_CPC': enums.BiddingStrategyType.MANUAL_CPC,
  };
  const desiredType = strategyMap[desiredStrategy];

  // Check if anything needs changing
  const strategyMatch = currentType === desiredType;
  const tcpaMatch = desiredStrategy !== 'MAXIMIZE_CONVERSIONS' || currentTcpaMicros === desiredTcpaMicros;
  const cpcMatch = desiredStrategy !== 'MAXIMIZE_CLICKS' || currentCpcCeilMicros === desiredCpcCeilMicros;

  if (strategyMatch && tcpaMatch && cpcMatch) {
    const label = desiredStrategy === 'MAXIMIZE_CONVERSIONS' && desiredTcpaMicros
      ? `MAXIMIZE_CONVERSIONS (tCPA €${bidding.target_cpa_eur})`
      : desiredStrategy === 'MAXIMIZE_CLICKS' && desiredCpcCeilMicros
        ? `MAXIMIZE_CLICKS (ceiling €${bidding.cpc_ceiling_eur})`
        : desiredStrategy;
    console.log(`  • Bidding unchanged: ${label}`);
    return;
  }

  // Build update payload
  const update: any = { resource_name: campaignRn };
  if (desiredStrategy === 'MAXIMIZE_CONVERSIONS') {
    update.maximize_conversions = desiredTcpaMicros ? { target_cpa_micros: desiredTcpaMicros } : {};
  } else if (desiredStrategy === 'MAXIMIZE_CLICKS') {
    update.target_spend = desiredCpcCeilMicros ? { cpc_bid_ceiling_micros: desiredCpcCeilMicros } : {};
  } else {
    update.manual_cpc = {};
  }

  const label = desiredStrategy === 'MAXIMIZE_CONVERSIONS' && desiredTcpaMicros
    ? `MAXIMIZE_CONVERSIONS (tCPA €${bidding.target_cpa_eur})`
    : desiredStrategy === 'MAXIMIZE_CLICKS' && desiredCpcCeilMicros
      ? `MAXIMIZE_CLICKS (ceiling €${bidding.cpc_ceiling_eur})`
      : desiredStrategy;

  if (dryRun) {
    console.log(`  [DRY] Would update bidding to ${label}`);
    return;
  }

  try {
    await customer.campaigns.update([update], { partial_failure: true });
    console.log(`  ✓ Bidding updated to ${label}`);
  } catch (e: any) {
    console.error(`  ✗ Bidding update failed`);
    console.error('    Details:', e?.errors || String(e));
  }
}

export const getCampaignBudgetRn = async (customer: any, campaignRn: string): Promise<string | undefined> => {
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

export async function addCampaignNegatives(customer: any, campaignRn: string, negatives: string[] | undefined, dryRun: boolean) {
  if (!negatives || negatives.length === 0) return;
  for (const term of negatives) {
    if (dryRun) {
      console.log(`  [DRY] Would add negative KW: "${term}"`);
      continue;
    }
    try {
      await customer.campaignCriteria.create([
        { campaign: campaignRn, negative: true, keyword: { text: term, match_type: enums.KeywordMatchType.PHRASE } },
      ], { partial_failure: true });
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

export async function getLanguageConstant(customer: any, code: string): Promise<string> {
  const rows: any[] = await customer.query(`
    SELECT language_constant.resource_name, language_constant.code
    FROM language_constant
    WHERE language_constant.code = '${code.toLowerCase()}'
    LIMIT 1
  `);
  const r = rows?.[0];
  const rn = (r as any)?.language_constant?.resource_name || (r as any)?.languageConstant?.resourceName;
  if (!rn) throw new Error(`Language constant not found for code=${code}`);
  return rn as string;
}

export async function addCampaignLanguages(customer: any, campaignRn: string, codes: string[], dryRun: boolean) {
  const list = Array.from(new Set((codes || []).map((c) => String(c).trim().toLowerCase()).filter(Boolean)));
  if (!list.length) return;
  if (dryRun) {
    console.log(`  [DRY] Would add campaign languages: ${list.join(', ')}`);
    return;
  }
  const ops: any[] = [];
  for (const code of list) {
    try {
      const lc = await getLanguageConstant(customer, code);
      ops.push({ campaign: campaignRn, language: { language_constant: lc } });
    } catch (e) {
      console.log(`  • Skip unknown language code: ${code}`);
    }
  }
  if (!ops.length) return;
  try {
    await customer.campaignCriteria.create(ops, { partial_failure: true });
    console.log(`  ✓ Languages added: ${list.join(', ')}`);
  } catch (e) {
    console.log('  • Language add encountered errors (partial failures possible)');
  }
}

export async function addCampaignLocationIds(customer: any, campaignRn: string, ids: number[], dryRun: boolean) {
  const uniq = Array.from(new Set(ids || []));
  if (!uniq.length) return;
  if (dryRun) {
    console.log(`  [DRY] Would add location IDs: ${uniq.join(', ')}`);
    return;
  }
  const ops = uniq.map((id) => ({ campaign: campaignRn, location: { geo_target_constant: `geoTargetConstants/${id}` } }));
  try {
    await customer.campaignCriteria.create(ops, { partial_failure: true });
    console.log(`  ✓ Locations added: ${uniq.length}`);
  } catch (e) {
    console.log('  • Location add encountered errors (partial failures possible)');
  }
}

export async function addCampaignProximity(customer: any, campaignRn: string, lat: number, lng: number, radiusKm: number, dryRun: boolean) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radiusKm !== 'number') return;
  if (dryRun) {
    console.log(`  [DRY] Would add proximity: lat=${lat}, lng=${lng}, r=${radiusKm}km`);
    return;
  }
  try {
    await customer.campaignCriteria.create([
      {
        campaign: campaignRn,
        proximity: {
          geo_point: {
            latitude_in_micro_degrees: Math.round(lat * 1_000_000),
            longitude_in_micro_degrees: Math.round(lng * 1_000_000),
          },
          radius: Math.max(1, Math.floor(radiusKm)),
          radius_units: enums.ProximityRadiusUnits.KILOMETERS,
        },
      },
    ], { partial_failure: true });
    console.log('  ✓ Proximity added');
  } catch (e) {
    const s = String(e);
    if (s.includes('ALREADY_EXISTS') || s.includes('DUPLICATE')) {
      console.log('  • Proximity already set');
      return;
    }
    console.log('  • Proximity add encountered error');
  }
}
