import { enums } from 'google-ads-api';
import { buildFinalUrl, sanitizePathPart, normalizeText, uniqueKeepOrder } from './util';

export type RsaAugmentOpts = { useKeywordInsertion?: boolean; autoComplete?: boolean; kwTokens?: string[] };

function sanitizeAdInputs(headlines?: string[], descriptions?: string[]): { H?: { text: string }[]; D?: { text: string }[] } {
  if (!headlines || !descriptions) return {};
  const normH = headlines.map((x) => normalizeText(x));
  for (const x of normH) {
    if ((x || '').length > 30) throw new Error(`Headline exceeds 30 chars: '${x}'`);
  }
  const seenH = new Set<string>();
  const H = normH
    .filter((x) => x.length > 0)
    .filter((x) => (seenH.has(x) ? false : (seenH.add(x), true)))
    .slice(0, 15)
    .map((text) => ({ text }));
  const normD = (descriptions || []).map((x) => normalizeText(x));
  for (const x of normD) {
    if ((x || '').length > 90) throw new Error(`Description exceeds 90 chars: '${x}'`);
  }
  const seenD = new Set<string>();
  const D = normD
    .filter((x) => x.length > 0)
    .filter((x) => (seenD.has(x) ? false : (seenD.add(x), true)))
    .slice(0, 4)
    .map((text) => ({ text }));
  return { H, D };
}

export function augmentRsaTextAssets(headlines: string[] | undefined, descriptions: string[] | undefined, _opts: RsaAugmentOpts): { headlines: string[]; descriptions: string[] } {
  const H = uniqueKeepOrder([...(headlines || [])]);
  const D = uniqueKeepOrder([...(descriptions || [])]);
  return { headlines: H.slice(0, 15), descriptions: D.slice(0, 4) };
}

export function prepareRsaAssets(headlines: string[] | undefined, descriptions: string[] | undefined, _opts: RsaAugmentOpts): { headlines?: string[]; descriptions?: string[] } {
  const { headlines: H, descriptions: D } = augmentRsaTextAssets(headlines, descriptions, _opts);
  return { headlines: H, descriptions: D };
}

export async function listAdGroupAds(customer: any, adGroupRn: string): Promise<string[]> {
  const rows: any[] = await customer.query(`
    SELECT ad_group_ad.resource_name, ad_group_ad.status
    FROM ad_group_ad
    WHERE ad_group_ad.ad_group = '${adGroupRn}'
  `);
  return rows.map((r) => (r as any)?.ad_group_ad?.resource_name || (r as any)?.adGroupAd?.resourceName).filter(Boolean);
}

export async function addRSAs(
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
      const rsa: any = { headlines: h, descriptions: d };
      const p1 = sanitizePathPart(path1);
      const p2 = sanitizePathPart(path2);
      if (p1) rsa.path1 = p1;
      if (p2) rsa.path2 = p2;
      await customer.adGroupAds.create(
        [
          {
            ad_group: adGroupRn,
            status: enums.AdGroupAdStatus.ENABLED,
            ad: { final_urls: [finalUrl], responsive_search_ad: rsa },
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

export async function ensureAtLeastOneRSA(
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
  await addRSAs(customer, adGroupRn, landing, fallbackH, fallbackD, params, 2, dryRun, path1, path2);
  await new Promise((r) => setTimeout(r, 1000));
  const after = await listAdGroupAds(customer, adGroupRn);
  console.log(`    • AdGroup ads after create: ${after.length}`);
}
