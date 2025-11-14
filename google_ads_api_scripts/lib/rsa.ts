import { enums } from 'google-ads-api';
import { buildFinalUrl, sanitizePathPart, normalizeText, uniqueKeepOrder, clip } from './util';

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

function titleCaseForHeadline(s: string): string {
  return s
    .split(' ')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      if (trimmed.length === 1) return trimmed.toUpperCase();
      return trimmed[0].toUpperCase() + trimmed.slice(1);
    })
    .filter(Boolean)
    .join(' ');
}

function deriveKeywordHeadline(kw: string): string | undefined {
  // Normalise whitespace and remove common location suffix to keep headlines short
  let norm = normalizeText(kw);
  norm = norm.replace(/\s+berlin\b/i, '').trim();
  if (!norm) return undefined;
  const titled = titleCaseForHeadline(norm);
  const clipped = clip(titled, 30);
  return clipped.length > 0 ? clipped : undefined;
}

function isCtaHeadline(h: string): boolean {
  const lc = h.toLowerCase();
  return /(termin|buchen|starten|sofort|heute|jetzt)/.test(lc);
}

export function augmentRsaTextAssets(
  headlines: string[] | undefined,
  descriptions: string[] | undefined,
  opts: RsaAugmentOpts
): { headlines: string[]; descriptions: string[] } {
  const baseH = uniqueKeepOrder([...(headlines || [])]);
  const baseD = uniqueKeepOrder([...(descriptions || [])]);

  const kwTokens = Array.from(new Set(opts?.kwTokens || []))
    .map((k) => normalizeText(k))
    .filter((k) => !!k);

  const extraH: string[] = [];
  const MAX_KW_HEADLINES = 1;

  for (const kw of kwTokens) {
    if (extraH.length >= MAX_KW_HEADLINES) break;
    const candidate = deriveKeywordHeadline(kw);
    if (!candidate) continue;
    const candLc = candidate.toLowerCase();
    const existsInBase = baseH.some((h) => h.toLowerCase() === candLc);
    const existsInExtra = extraH.some((h) => h.toLowerCase() === candLc);
    if (existsInBase || existsInExtra) continue;
    extraH.push(candidate);
  }

  let finalH = baseH.slice();

  if (extraH.length > 0) {
    // If we already have 15 headlines, drop one CTA-style headline (preferably) to make room
    if (finalH.length >= 15) {
      let toDrop = extraH.length;
      const indicesToDrop = new Set<number>();

      // Drop CTA-style headlines from the end first
      for (let i = finalH.length - 1; i >= 0 && toDrop > 0; i--) {
        if (isCtaHeadline(finalH[i])) {
          indicesToDrop.add(i);
          toDrop--;
        }
      }

      // If still need to drop, remove from the end
      for (let i = finalH.length - 1; i >= 0 && toDrop > 0; i--) {
        if (!indicesToDrop.has(i)) {
          indicesToDrop.add(i);
          toDrop--;
        }
      }

      if (indicesToDrop.size > 0) {
        finalH = finalH.filter((_, idx) => !indicesToDrop.has(idx));
      }
    }

    finalH = uniqueKeepOrder([...finalH, ...extraH]);
  }

  const H = finalH.slice(0, 15);
  const D = baseD.slice(0, 4);

  return { headlines: H, descriptions: D };
}

export function prepareRsaAssets(
  headlines: string[] | undefined,
  descriptions: string[] | undefined,
  opts: RsaAugmentOpts
): { headlines?: string[]; descriptions?: string[] } {
  const { headlines: H, descriptions: D } = augmentRsaTextAssets(headlines, descriptions, opts);
  return { headlines: H, descriptions: D };
}

export async function listAdGroupAds(customer: any, adGroupRn: string): Promise<string[]> {
  const rows: any[] = await customer.query(`
    SELECT ad_group_ad.resource_name, ad_group_ad.status
    FROM ad_group_ad
    WHERE ad_group_ad.ad_group = '${adGroupRn}'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
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
  const desiredCount = Math.max(1, count);

  if (dryRun || /\/DRY_/.test(adGroupRn)) {
    console.log(
      `    [DRY] Would ensure ${desiredCount} RSAs with ${h.length} headlines / ${d.length} descriptions`
    );
    return;
  }

  const existing = await listAdGroupAds(customer, adGroupRn);

  const rsa: any = { headlines: h, descriptions: d };
  const p1 = sanitizePathPart(path1);
  const p2 = sanitizePathPart(path2);
  if (p1) rsa.path1 = p1;
  if (p2) rsa.path2 = p2;

  if (existing.length > 0) {
    try {
      await customer.adGroupAds.update(
        existing.map((rn: string) => ({
          resource_name: rn,
          ad: { final_urls: [finalUrl], responsive_search_ad: rsa },
        })),
        { partial_failure: true }
      );
      console.log(`    ✓ Updated ${existing.length} existing RSAs`);
    } catch (e: any) {
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`    ✗ RSA update failed: ${msg}`);
    }
  }

  const toCreate = Math.max(0, desiredCount - existing.length);
  for (let i = 0; i < toCreate; i++) {
    try {
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
