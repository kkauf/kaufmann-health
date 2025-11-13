#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

// Load env from repo root .env.local if present
const rootDir = process.cwd();
const envLocal = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: true });
else dotenv.config();

const requireEnv = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return args as { nameLike?: string | boolean; days?: string | boolean };
}

function escapeLike(s: string) { return s.replace(/'/g, "''"); }

function dateWindow(days: number): { since: string; until: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(1, days));
  const until = end.toISOString().slice(0, 10);
  const since = start.toISOString().slice(0, 10);
  return { since, until };
}

function getField<T>(row: any, paths: string[]): T | undefined {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = row;
    let ok = true;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part]; else { ok = false; break; }
    }
    if (ok) return cur as T;
  }
  return undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const NAME_LIKE = typeof args.nameLike === 'string' ? String(args.nameLike) : 'KH_Test2_BookingMVP_';
  const DAYS = typeof args.days === 'string' ? Math.max(1, parseInt(String(args.days), 10) || 7) : 7;
  const { since, until } = dateWindow(DAYS);

  console.log('=== Quality Score Audit (keyword-level) ===');
  console.log('Params:', { nameLike: NAME_LIKE, since, until });

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

  const nameClause = NAME_LIKE ? ` AND campaign.name LIKE '%${escapeLike(NAME_LIKE)}%'` : '';

  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      ad_group.resource_name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.status,
      ad_group_criterion.keyword.text,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score,
      metrics.impressions
    FROM keyword_view
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status IN ('ENABLED','PAUSED')
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  if (!rows.length) {
    console.log('No keywords found for the specified campaigns.');
    return;
  }

  type AgStats = {
    adGroup: string;
    items: Array<{ qs?: number; impr: number; kw: string; parts: { creative?: string; postClick?: string } }>;
  };

  const byCampaign = new Map<string, Map<string, AgStats>>();

  for (const r of rows) {
    const camp = String(getField<any>(r, ['campaign.name']) || '');
    const ag = String(getField<any>(r, ['ad_group.name','adGroup.name']) || '');
    const kw = String(getField<any>(r, ['ad_group_criterion.keyword.text']) || '');
    const qs = Number(getField<any>(r, ['ad_group_criterion.quality_info.quality_score'])) || undefined;
    const creative = String(getField<any>(r, ['ad_group_criterion.quality_info.creative_quality_score']) || '');
    const postClick = String(getField<any>(r, ['ad_group_criterion.quality_info.post_click_quality_score']) || '');
    const impr = Number(getField<any>(r, ['metrics.impressions']) || 0);

    if (!byCampaign.has(camp)) byCampaign.set(camp, new Map());
    const map = byCampaign.get(camp)!;
    if (!map.has(ag)) map.set(ag, { adGroup: ag, items: [] });
    map.get(ag)!.items.push({ qs, impr, kw, parts: { creative, postClick } });
  }

  for (const [camp, agMap] of byCampaign) {
    console.log(`\n=== ${camp} ===`);
    let campImpr = 0;
    let campNum = 0;
    let campDen = 0;
    const campDist: Record<number, number> = {};
    for (const [, stat] of agMap) {
      let num = 0; let den = 0; const dist: Record<number, number> = {};
      for (const it of stat.items) {
        if (!it.qs || it.qs <= 0) continue;
        const w = Math.max(1, it.impr);
        num += it.qs * w; den += w; campNum += it.qs * w; campDen += w; campImpr += w;
        dist[it.qs] = (dist[it.qs] || 0) + 1;
        campDist[it.qs] = (campDist[it.qs] || 0) + 1;
      }
      const avg = den > 0 ? Math.round((num / den) * 100) / 100 : 0;
      const keys = Object.keys(dist).sort((a,b)=>Number(a)-Number(b)).map(k=>`${k}:${dist[Number(k)]}`).join(', ');
      const kwCount = stat.items.filter(x => (x.qs ?? 0) > 0).length;
      console.log(`- ${stat.adGroup}: avg QS ${avg || 'N/A'} (keywords with QS: ${kwCount}), dist [${keys || '—'}]`);
    }
    const campAvg = campDen > 0 ? Math.round((campNum / campDen) * 100) / 100 : 0;
    const cKeys = Object.keys(campDist).sort((a,b)=>Number(a)-Number(b)).map(k=>`${k}:${campDist[Number(k)]}`).join(', ');
    console.log(`  → Campaign average (impr‑weighted): ${campAvg || 'N/A'} over ${campImpr} impressions, dist [${cKeys || '—'}]`);
  }

  console.log('\nNote: QS is reported per keyword; averages are impression‑weighted over the selected window.');
}

main().catch((e) => {
  console.error('Fatal error in qs.ts:', e);
  process.exit(1);
});
