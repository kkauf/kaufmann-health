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

import { GoogleAdsApi, enums } from 'google-ads-api';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100; // 2 decimals
}

function toYyyymmdd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
      args[k] = v === 'true' ? true : v === 'false' ? false : v;
    }
  }
  return args as {
    lookback?: string | boolean;
    excludeToday?: string | boolean;
    minSpendNoConv?: string | boolean;
    cpaThreshold?: string | boolean;
    budgetMultiple?: string | boolean;
    nameLike?: string | boolean;
    apply?: string | boolean;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Defaults: conservative, dry-run
  const LOOKBACK_DAYS = Math.max(1, Number(args.lookback ?? 3) || 3);
  const EXCLUDE_TODAY = (args.excludeToday ?? true) === true || String(args.excludeToday) === 'true';
  const MIN_SPEND_NO_CONV_EUR = Math.max(1, Number(args.minSpendNoConv ?? 30) || 30);
  const CPA_THRESHOLD_EUR = Math.max(1, Number(args.cpaThreshold ?? 40) || 40); // report-only by default
  const BUDGET_MULTIPLE = Math.max(1, Number(args.budgetMultiple ?? 2) || 2);
  const NAME_LIKE = typeof args.nameLike === 'string' ? String(args.nameLike) : '';
  const APPLY = args.apply === true || String(args.apply) === 'true';

  const now = new Date();
  const end = new Date(now);
  if (EXCLUDE_TODAY) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (LOOKBACK_DAYS - 1));
  const startStr = toYyyymmdd(start);
  const endStr = toYyyymmdd(end);

  console.log('=== Google Ads Campaign Monitoring ===');
  console.log('Params:', {
    lookbackDays: LOOKBACK_DAYS,
    excludeToday: EXCLUDE_TODAY,
    window: `${startStr} → ${endStr}`,
    minSpendNoConvEUR: MIN_SPEND_NO_CONV_EUR,
    cpaThresholdEUR: CPA_THRESHOLD_EUR,
    budgetMultiple: BUDGET_MULTIPLE,
    nameLike: NAME_LIKE || '(none)',
    mode: APPLY ? 'APPLY' : 'DRY RUN',
  });

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

  // Build GAQL query
  const nameLikeClause = NAME_LIKE ? ` AND campaign.name LIKE '%${NAME_LIKE.replace(/'/g, "''")}%'` : '';
  const query = `
    SELECT
      campaign.resource_name,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${startStr}' AND '${endStr}'
      ${nameLikeClause}
  `;

  let rows: any[] = [];
  try {
    rows = await customer.query(query);
  } catch (e) {
    console.error('Query failed:', e);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No ENABLED SEARCH campaigns found for the given window.');
    return;
  }

  type Row = {
    campaign?: { resource_name?: string; id?: string; name?: string; status?: string; advertising_channel_type?: string };
    campaign_budget?: { amount_micros?: number };
    metrics?: { cost_micros?: number; conversions?: number; conversions_value?: number };
  };

  const analyses = rows.map((r: Row) => {
    const rn = (r.campaign as any)?.resource_name || (r as any)?.campaign?.resourceName;
    const id = (r.campaign as any)?.id;
    const name = (r.campaign as any)?.name || '';
    const budgetMicros = (r.campaign_budget as any)?.amount_micros || (r as any)?.campaign_budget?.amountMicros || 0;
    const spendMicros = (r.metrics as any)?.cost_micros || 0;
    const conversions = Number((r.metrics as any)?.conversions || 0);

    const budgetEUR = eurosFromMicros(budgetMicros);
    const spendEUR = eurosFromMicros(spendMicros);
    const cpa = conversions > 0 ? Math.round((spendEUR / conversions) * 100) / 100 : undefined;

    const reasons: string[] = [];
    // Rule 1: Spent >= MIN and conversions == 0
    if (spendEUR >= MIN_SPEND_NO_CONV_EUR && conversions === 0) {
      reasons.push(`No conversions with spend €${spendEUR.toFixed(2)} ≥ €${MIN_SPEND_NO_CONV_EUR}`);
    }
    // Rule 2: Spend exceeds budget multiple with zero conversions
    if (budgetEUR > 0 && conversions === 0 && spendEUR > budgetEUR * BUDGET_MULTIPLE) {
      reasons.push(`Spend €${spendEUR.toFixed(2)} > ${BUDGET_MULTIPLE}× daily budget (€${budgetEUR.toFixed(2)})`);
    }

    // Report-only: high CPA
    const warnings: string[] = [];
    if (typeof cpa === 'number' && cpa > CPA_THRESHOLD_EUR) {
      warnings.push(`High CPA €${cpa.toFixed(2)} > €${CPA_THRESHOLD_EUR}`);
    }

    const shouldPause = reasons.length > 0;

    return {
      resourceName: rn as string,
      id: String(id || ''),
      name,
      budgetEUR,
      spendEUR,
      conversions,
      cpa,
      reasons,
      warnings,
      shouldPause,
    };
  });

  analyses.sort((a, b) => b.spendEUR - a.spendEUR);

  console.log('\nCampaigns (sorted by spend):');
  for (const a of analyses) {
    const nameShort = a.name.length > 70 ? a.name.slice(0, 67) + '…' : a.name;
    const line = [
      `- ${nameShort} [${a.id}]`,
      `Spend: €${a.spendEUR.toFixed(2)}`,
      `Conv: ${a.conversions}`,
      `CPA: ${typeof a.cpa === 'number' ? '€' + a.cpa.toFixed(2) : '—'}`,
      `Budget: €${a.budgetEUR.toFixed(2)}`,
    ].join('  |  ');
    console.log(line);
    if (a.reasons.length > 0) console.log('    Auto-pause reasons:', a.reasons.join(' & '));
    if (a.warnings.length > 0) console.log('    Warnings:', a.warnings.join(' & '));
  }

  const toPause = analyses.filter((a) => a.shouldPause && a.resourceName);
  if (toPause.length === 0) {
    console.log('\nNo campaigns meet auto-pause criteria.');
    return;
  }

  console.log(`\nCandidates to PAUSE (${toPause.length}):`);
  toPause.forEach((a) => console.log(`• ${a.name} [${a.id}] — ${a.reasons.join(' & ')}`));

  if (!APPLY) {
    console.log('\nDRY RUN: No changes applied. Re-run with --apply to pause these campaigns.');
    return;
  }

  console.log('\nApplying pauses...');
  let ok = 0;
  for (const a of toPause) {
    try {
      await customer.campaigns.update([
        { resource_name: a.resourceName, status: enums.CampaignStatus.PAUSED },
      ]);
      ok++;
      console.log(`  ✓ Paused: ${a.name} [${a.id}]`);
    } catch (e) {
      console.error(`  ✗ Failed to pause ${a.name} [${a.id}]`, e);
    }
  }
  console.log(`Done. Paused ${ok}/${toPause.length} campaigns.`);
}

main().catch((e) => {
  console.error('Fatal error in monitor-campaigns:', e);
  process.exit(1);
});
