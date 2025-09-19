#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env from .env.local first (project root), then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

import { GoogleAdsApi } from 'google-ads-api';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

async function main() {
  const client = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });

  const customer = client.Customer({
    customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
  });

  const names = [
    'CONSCIOUS WELLNESS SEEKERS - Week 38',
    'DEPTH SEEKERS - Week 38',
  ];

  for (const name of names) {
    console.log(`\n=== Inspect: ${name} ===`);
    const rows: any[] = await customer.query(`
      SELECT
        campaign.resource_name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.bidding_strategy_type,
        campaign.bidding_strategy,
        campaign.manual_cpc.enhanced_cpc_enabled,
        campaign.maximize_conversions.target_cpa_micros,
        campaign_budget.resource_name,
        campaign_budget.name,
        campaign_budget.amount_micros,
        campaign_budget.explicitly_shared
      FROM campaign
      WHERE campaign.name = '${name.replace(/'/g, "''")}' AND campaign.status != 'REMOVED'
      LIMIT 1
    `);

    if (!rows || rows.length === 0) {
      console.log('Not found');
      continue;
    }

    const r: any = rows[0];
    const c = r.campaign || (r as any).campaign || {};
    const b = r.campaign_budget || (r as any).campaignBudget || {};

    const euros = (micros?: number) => (micros ? Math.round((micros / 1_000_000) * 100) / 100 : 0);

    const typeNameMap: Record<number, string> = {
      0: 'UNSPECIFIED',
      1: 'UNKNOWN',
      2: 'COMMISSION',
      3: 'MANUAL_CPC',
      4: 'MANUAL_CPM',
      5: 'MANUAL_CPV',
      6: 'MAXIMIZE_CONVERSIONS',
      7: 'MAXIMIZE_CONVERSION_VALUE',
      8: 'TARGET_CPA',
      9: 'TARGET_CPM',
      10: 'TARGET_ROAS',
      11: 'TARGET_SPEND',
    };

    console.log({
      id: c.id,
      resource_name: c.resource_name,
      status: c.status,
      bidding_strategy_type: `${c.bidding_strategy_type} (${typeNameMap[c.bidding_strategy_type ?? -1] || 'N/A'})`,
      bidding_strategy: c.bidding_strategy,
      manual_cpc_ecpc: c.manual_cpc?.enhanced_cpc_enabled,
      maximize_conversions_tCPA_EUR: euros(c.maximize_conversions?.target_cpa_micros),
      budget: {
        resource_name: b.resource_name,
        name: b.name,
        amount_eur: euros(b.amount_micros),
        explicitly_shared: b.explicitly_shared,
      },
    });
  }
}

main().catch((e) => {
  console.error('debug-campaigns failed:', e);
  process.exit(1);
});
