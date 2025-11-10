#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return args as { nameLike?: string | boolean; apply?: string | boolean; config?: string | boolean };
}

function dateWindow(days: number): { since: string; until: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(1, days));
  const until = end.toISOString().slice(0, 10);
  const since = start.toISOString().slice(0, 10);
  return { since, until };
}

async function listAdGroupSearchTerms(customer: any, adGroupRn: string): Promise<string[]> {
  const { since, until } = dateWindow(30);
  const rows: any[] = await customer.query(`
    SELECT search_term_view.search_term, ad_group.resource_name, metrics.clicks
    FROM search_term_view
    WHERE ad_group.resource_name = '${adGroupRn}'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
    ORDER BY metrics.clicks DESC
    LIMIT 50
  `);
  const out: string[] = [];
  for (const r of rows) {
    const st = (r as any)?.search_term_view?.search_term || (r as any)?.searchTermView?.searchTerm || '';
    if (st) out.push(String(st));
  }
  return out;
}

function loadConfigTokens(configPath?: string): Map<string, string[]> | undefined {
  if (!configPath) return undefined;
  try {
    const p = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
    const raw = fs.readFileSync(p, 'utf8');
    const arr = JSON.parse(raw);
    const map = new Map<string, string[]>();
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const name = String(item?.name || '');
        const kws = item?.keywords || {};
        const terms: string[] = [];
        for (const tier of Object.values(kws)) {
          const t = (tier as any)?.terms as string[] | undefined;
          if (Array.isArray(t)) terms.push(...t);
        }
        const tokens = Array.from(new Set(terms.map(x => String(x)).filter(Boolean)));
        if (name && tokens.length) map.set(name, tokens);
      }
    }
    return map;
  } catch {
    return undefined;
  }
}

const DEFAULT_CTA_H = [
  'Jetzt Termin sichern',
  'Direkt buchen',
  'Heute starten',
  'Jetzt Hilfe finden',
  'Jetzt beraten lassen'
];
const DEFAULT_BENEFITS_H = [
  'Keine Wartezeit',
  'Berlin & Online',
  'Handverlesen',
  'Privat & vertraulich',
  'Somatische Ansätze'
];
const DEFAULT_DESC = [
  'Jetzt Termin sichern – Keine Wartezeit. Privat & vertraulich.',
  'Direkt buchen: Berlin & Online. Handverlesene Begleitung.',
  'Traumasensibel & körperorientiert. Heute starten.',
  'Persönliche Vermittlung ohne Krankenkasse.'
];

function normalizeText(s: string): string {
  return (s || '').replace(/\s+/g, ' ').replace(/\s+–\s+/g, ' – ').trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const sub = s.slice(0, max);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 10 ? sub.slice(0, lastSpace) : sub).trim();
}

function uniqueKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const s = (x || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function listCampaignAssets(customer: any, campaignRn: string) {
  const rows: any[] = await customer.query(`
    SELECT campaign_asset.field_type, campaign_asset.asset, asset.type
    FROM campaign_asset
    WHERE campaign.resource_name = '${campaignRn}'
  `);
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const ft = (r as any)?.campaign_asset?.field_type || (r as any)?.campaignAsset?.fieldType || 'UNKNOWN';
    counts[ft] = (counts[ft] || 0) + 1;
  }
  return counts;
}

async function listAdGroupKeywords(customer: any, adGroupRn: string): Promise<string[]> {
  const rows: any[] = await customer.query(`
    SELECT ad_group_criterion.keyword.text, ad_group_criterion.type
    FROM ad_group_criterion
    WHERE ad_group_criterion.ad_group = '${adGroupRn}' AND ad_group_criterion.type = 'KEYWORD'
  `);
  const out: string[] = [];
  for (const r of rows) {
    const a = (r as any)?.ad_group_criterion || (r as any)?.adGroupCriterion;
    const txt = a?.keyword?.text || '';
    if (txt) out.push(String(txt));
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const APPLY = args.apply === true || String(args.apply) === 'true';
  const NAME_LIKE = typeof args.nameLike === 'string' ? String(args.nameLike) : '';
  const CONFIG_PATH = typeof args.config === 'string' ? String(args.config) : undefined;

  console.log('=== Audit Ad Strength (RSA) ===');
  console.log('Params:', { apply: APPLY, nameLike: NAME_LIKE || '(none)', config: CONFIG_PATH || '(none)' });

  const configTokens = loadConfigTokens(CONFIG_PATH);

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

  const nameLikeClause = NAME_LIKE ? ` AND campaign.name LIKE '%${NAME_LIKE.replace(/'/g, "''")}%'` : '';
  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      campaign.resource_name,
      campaign.advertising_channel_type,
      ad_group.name,
      ad_group.resource_name,
      ad_group_ad.resource_name,
      ad_group_ad.status,
      ad_group_ad.ad_strength,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2
    FROM ad_group_ad
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status IN ('ENABLED','PAUSED')
      ${nameLikeClause}
  `);

  if (!rows.length) {
    console.log('No RSAs found.');
    return;
  }

  type AuditRow = {
    campaignName: string;
    campaignRn: string;
    adGroupName: string;
    adGroupRn: string;
    adRn: string;
    strength?: string;
    hUniq: number;
    dUniq: number;
    kwHits: number;
    pinnedHeadlines: number;
    issues: string[];
  };

  const audits: AuditRow[] = [];

  for (const r of rows) {
    const c = (r as any)?.campaign || {};
    const g = (r as any)?.ad_group || (r as any)?.adGroup || {};
    const a = (r as any)?.ad_group_ad || (r as any)?.adGroupAd || {};

    const headlines: Array<{ text?: string; pinned_field?: any }> = a?.ad?.responsive_search_ad?.headlines || a?.ad?.responsiveSearchAd?.headlines || [];
    const descriptions: Array<{ text?: string; pinned_field?: any }> = a?.ad?.responsive_search_ad?.descriptions || a?.ad?.responsiveSearchAd?.descriptions || [];

    const hTexts = headlines.map(h => String(h?.text || '').trim()).filter(Boolean);
    const dTexts = descriptions.map(d => String(d?.text || '').trim()).filter(Boolean);
    const hUniq = new Set(hTexts).size;
    const dUniq = new Set(dTexts).size;
    const pinnedHeadlines = headlines.filter(h => !!h?.pinned_field).length;

    let kwList = await listAdGroupKeywords(customer, g.resource_name || g.resourceName);
    if (!kwList || kwList.length === 0) {
      kwList = await listAdGroupSearchTerms(customer, g.resource_name || g.resourceName);
    }
    const tokenSet = new Set<string>();
    const cfgTerms = configTokens?.get(String(c.name || '')) || [];
    for (const term of cfgTerms) {
      const parts = String(term).toLowerCase().split(/[^a-zäöüß0-9]+/i).map(s => s.trim()).filter(s => s.length >= 4);
      for (const p of parts) tokenSet.add(p);
    }
    for (const kw of kwList) {
      const parts = String(kw).toLowerCase().split(/[^a-zäöüß0-9]+/i).map(s => s.trim()).filter(s => s.length >= 4);
      for (const p of parts) tokenSet.add(p);
    }
    const kwTokens = Array.from(tokenSet);
    let kwHits = 0;
    for (const t of kwTokens.slice(0, 5)) {
      if (hTexts.some(h => h.toLowerCase().includes(t))) kwHits++;
    }

    const issues: string[] = [];
    if (hUniq < 15) issues.push(`Headlines unique ${hUniq}/15`);
    if (dUniq < 4) issues.push(`Descriptions unique ${dUniq}/4`);
    if (kwHits < 3) issues.push(`KW coverage headlines ${kwHits}/3`);
    if (pinnedHeadlines > 0) issues.push(`Pinned headlines ${pinnedHeadlines}`);

    // Extensions check
    let extIssues: string[] = [];
    try {
      const counts = await listCampaignAssets(customer, c.resource_name || c.resourceName);
      const sitelinks = counts['SITELINK'] || 0;
      const callouts = counts['CALLOUT'] || 0;
      const snippets = counts['STRUCTURED_SNIPPET'] || 0;
      const images = counts['IMAGE'] || 0;
      if (sitelinks < 4) extIssues.push(`Sitelinks ${sitelinks}/4`);
      if (callouts < 4) extIssues.push(`Callouts ${callouts}/4`);
      if (snippets < 1) extIssues.push(`Snippets ${snippets}/1`);
      if (images < 4) extIssues.push(`Images ${images}/4`);
    } catch {}
    issues.push(...extIssues);

    audits.push({
      campaignName: c.name,
      campaignRn: c.resource_name || c.resourceName,
      adGroupName: g.name,
      adGroupRn: g.resource_name || g.resourceName,
      adRn: a.resource_name || a.resourceName,
      strength: a?.ad_strength || a?.adStrength,
      hUniq,
      dUniq,
      kwHits,
      pinnedHeadlines,
      issues,
    });
  }

  const byCampaign = new Map<string, AuditRow[]>();
  for (const ar of audits) {
    const k = ar.campaignName;
    if (!byCampaign.has(k)) byCampaign.set(k, []);
    byCampaign.get(k)!.push(ar);
  }

  for (const [camp, arr] of byCampaign.entries()) {
    console.log(`\n=== ${camp} (${arr.length} RSAs) ===`);
    for (const a of arr) {
      const probs = a.issues.length ? `Issues: ${a.issues.join(' | ')}` : 'OK';
      console.log(`- ${a.adGroupName} — Strength: ${a.strength || 'N/A'} — H uniq ${a.hUniq}/15, D uniq ${a.dUniq}/4, KW hits ${a.kwHits}/3, Pinned ${a.pinnedHeadlines} — ${probs}`);
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN complete. Re-run with --apply to auto-fix assets and attach missing extensions (best-effort).');
    return;
  }

  for (const a of audits) {
    if (!a.issues.length) continue;

    const rows: any[] = await customer.query(`
      SELECT ad_group_ad.resource_name, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions
      FROM ad_group_ad WHERE ad_group_ad.resource_name = '${a.adRn}' LIMIT 1
    `);
    const ad = rows?.[0]?.ad_group_ad || rows?.[0]?.adGroupAd;
    let headlines: Array<{ text?: string; pinned_field?: any }> = ad?.ad?.responsive_search_ad?.headlines || ad?.ad?.responsiveSearchAd?.headlines || [];
    let descriptions: Array<{ text?: string; pinned_field?: any }> = ad?.ad?.responsive_search_ad?.descriptions || ad?.ad?.responsiveSearchAd?.descriptions || [];

    const hTexts = uniqueKeepOrder(headlines.map(h => normalizeText(h.text || '')).filter(Boolean));
    const dTexts = uniqueKeepOrder(descriptions.map(d => normalizeText(d.text || '')).filter(Boolean));

    // Build pools with KW priority
    let kwList = await listAdGroupKeywords(customer, a.adGroupRn);
    if (!kwList || kwList.length === 0) {
      kwList = await listAdGroupSearchTerms(customer, a.adGroupRn);
    }
    const tokenSet = new Set<string>();
    const cfgTerms = configTokens?.get(String(a.campaignName || '')) || [];
    for (const term of cfgTerms) {
      const parts = String(term).toLowerCase().split(/[^a-zäöüß0-9]+/i).map(s => s.trim()).filter(s => s.length >= 4);
      for (const p of parts) tokenSet.add(p);
    }
    for (const kw of kwList) {
      const parts = String(kw).toLowerCase().split(/[^a-zäöüß0-9]+/i).map(s => s.trim()).filter(s => s.length >= 4);
      for (const p of parts) tokenSet.add(p);
    }
    const kwTokens = Array.from(tokenSet);
    const need = kwTokens.slice(0, 3).filter(tok => !hTexts.some(h => h.toLowerCase().includes(tok)) && tok.length <= 30);
    const ordered = uniqueKeepOrder([
      ...need,
      ...hTexts,
      ...DEFAULT_CTA_H.slice(0, 3),
      ...DEFAULT_BENEFITS_H.slice(0, 2),
      ...kwTokens.slice(0, 5)
    ]);

    // Fill to 15 unique headlines (≤30 chars), prioritizing KW tokens first
    const newH: string[] = [];
    for (const h of ordered) {
      const t = h.length > 30 ? clip(h, 30) : h;
      if (!newH.some(x => x.toLowerCase() === t.toLowerCase())) newH.push(t);
      if (newH.length >= 15) break;
    }
    while (newH.length < 15 && DEFAULT_CTA_H.length) {
      const t = DEFAULT_CTA_H[newH.length % DEFAULT_CTA_H.length];
      if (t && !newH.some(x => x.toLowerCase() === t.toLowerCase())) newH.push(t);
    }

    // Fill to 4 unique descriptions (≤90 chars)
    const poolD = uniqueKeepOrder([...dTexts, ...DEFAULT_DESC]);
    const newD: string[] = [];
    for (const d of poolD) {
      const t = d.length > 90 ? clip(d, 90) : d;
      if (!newD.some(x => x.toLowerCase() === t.toLowerCase())) newD.push(t);
      if (newD.length >= 4) break;
    }
    while (newD.length < 4 && DEFAULT_DESC.length) {
      const t = DEFAULT_DESC[newD.length % DEFAULT_DESC.length];
      if (t && !newD.some(x => x.toLowerCase() === t.toLowerCase())) newD.push(t);
    }

    try {
      await customer.adGroupAds.update([
        {
          resource_name: a.adRn,
          ad: {
            responsive_search_ad: {
              headlines: newH.map(text => ({ text })),
              descriptions: newD.map(text => ({ text })),
            },
          },
        },
      ], { partial_failure: true });
      console.log(`✓ Updated RSA assets for ${a.adGroupName}`);
    } catch (e) {
      console.log('✗ Failed updating RSA assets for', a.adGroupName, e);
    }
  }

  console.log('\nAPPLY complete.');
}

main().catch((e) => {
  console.error('Fatal error in ads-audit-ad-strength:', e);
  process.exit(1);
});
