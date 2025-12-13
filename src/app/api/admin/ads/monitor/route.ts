import { NextResponse } from 'next/server';
import { logError, track } from '@/lib/logger';
import { isCronAuthorized as isCronAuthorizedShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100; // 2 decimals
}

function toYyyymmdd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

async function fetchAccessToken(): Promise<string | null> {
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID;
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!resp.ok) return null;
    const json = (await resp.json().catch(() => null)) as { access_token?: string } | null;
    return json && typeof json.access_token === 'string' ? json.access_token : null;
  } catch {
    return null;
  }
}

function parseBool(v: string | null | undefined, fallback: boolean): boolean {
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

function parseNum(v: string | null | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildWindow({ lookbackDays, excludeToday }: { lookbackDays: number; excludeToday: boolean }) {
  const now = new Date();
  const end = new Date(now);
  if (excludeToday) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (lookbackDays - 1));
  return { startStr: toYyyymmdd(start), endStr: toYyyymmdd(end) };
}

/** Retry fetch with exponential backoff for transient/internal errors */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  let lastResp: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, init);
    // Don't retry non-500 errors
    if (resp.status !== 500) return resp;
    // Check if it's a transient or internal error (both are retryable)
    const clone = resp.clone();
    const body = await clone.text().catch(() => '');
    const isRetryable = body.includes('TRANSIENT_ERROR') || body.includes('INTERNAL_ERROR');
    if (!isRetryable) return resp;
    lastResp = resp;
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  return lastResp!;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow Bearer/secret headers (and in non-prod, optional query token fallback)
    const isCron = isCronAuthorizedShared(req);
    if (!isCron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);

    // Parameters (all optional; conservative defaults)
    const lookbackDays = Math.max(1, parseNum(url.searchParams.get('lookback'), 3));
    const excludeToday = parseBool(url.searchParams.get('excludeToday'), true);
    const minSpendNoConvEUR = Math.max(1, parseNum(url.searchParams.get('minSpendNoConv'), 30));
    const cpaThresholdEUR = Math.max(1, parseNum(url.searchParams.get('cpaThreshold'), 40)); // report-only
    const budgetMultiple = Math.max(1, parseNum(url.searchParams.get('budgetMultiple'), 2));
    const nameLikeRaw = url.searchParams.get('nameLike');
    const nameLike = typeof nameLikeRaw === 'string' && nameLikeRaw.trim() ? nameLikeRaw.trim().toLowerCase() : undefined;
    const apply = parseBool(url.searchParams.get('apply'), false);

    const { startStr, endStr } = buildWindow({ lookbackDays, excludeToday });

    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.ads.monitor',
      props: { lookbackDays, excludeToday, minSpendNoConvEUR, cpaThresholdEUR, budgetMultiple, nameLike, apply, window: `${startStr} → ${endStr}` },
      ip,
      ua,
    });

    // Acquire OAuth token via refresh token flow (typed helper)
    const token = await fetchAccessToken();
    if (!token) {
      await logError('admin.api.ads.monitor', new Error('token_unavailable'), { stage: 'oauth' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Token unavailable' }, { status: 500 });
    }

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID as string;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN as string;
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID as string | undefined;
    if (!customerId || !developerToken) {
      return NextResponse.json({ data: null, error: 'Missing GOOGLE_ADS_* env' }, { status: 500 });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

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
    `;

    const searchResp = await fetchWithRetry(
      `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:search`,
      { method: 'POST', headers, body: JSON.stringify({ query }) }
    );
    if (!searchResp.ok) {
      const errText = await searchResp.text().catch(() => '');
      await logError('admin.api.ads.monitor', new Error(`search_failed ${searchResp.status}`), { body: errText }, ip, ua);
      return NextResponse.json({ data: null, error: 'Search failed' }, { status: 500 });
    }

    const searchData = (await searchResp.json().catch(() => ({}))) as { results?: unknown[] };
    type ResultRow = {
      campaign?: {
        resourceName?: string;
        id?: string | number;
        name?: string;
        status?: string;
        advertisingChannelType?: string;
      };
      campaignBudget?: { amountMicros?: string | number };
      metrics?: { costMicros?: string | number; conversions?: number; conversionsValue?: number };
    };
    let results: ResultRow[] = Array.isArray(searchData.results)
      ? (searchData.results as ResultRow[])
      : [];
    if (nameLike) {
      results = results.filter((r) => String(r.campaign?.name || '').toLowerCase().includes(nameLike));
    }

    const analyses = results.map((r) => {
      const campaign = r.campaign || {};
      const rn = String(campaign.resourceName || '');
      const id = String(campaign.id ?? '');
      const name = String(campaign.name || '');
      const budgetMicrosRaw = r.campaignBudget?.amountMicros;
      const budgetMicros = typeof budgetMicrosRaw === 'string' || typeof budgetMicrosRaw === 'number' ? Number(budgetMicrosRaw) : 0;
      const metrics = r.metrics || {};
      const costMicrosRaw = metrics.costMicros;
      const spendMicros = typeof costMicrosRaw === 'string' || typeof costMicrosRaw === 'number' ? Number(costMicrosRaw) : 0;
      const conversions = typeof metrics.conversions === 'number' ? metrics.conversions : 0;

      const budgetEUR = eurosFromMicros(budgetMicros);
      const spendEUR = eurosFromMicros(spendMicros);
      const cpa = conversions > 0 ? Math.round((spendEUR / conversions) * 100) / 100 : undefined;

      const reasons: string[] = [];
      if (spendEUR >= minSpendNoConvEUR && conversions === 0) {
        reasons.push(`No conversions with spend €${spendEUR.toFixed(2)} ≥ €${minSpendNoConvEUR}`);
      }
      if (budgetEUR > 0 && conversions === 0 && spendEUR > budgetEUR * budgetMultiple) {
        reasons.push(`Spend €${spendEUR.toFixed(2)} > ${budgetMultiple}× daily budget (€${budgetEUR.toFixed(2)})`);
      }

      const warnings: string[] = [];
      if (typeof cpa === 'number' && cpa > cpaThresholdEUR) {
        warnings.push(`High CPA €${cpa.toFixed(2)} > €${cpaThresholdEUR}`);
      }

      const shouldPause = reasons.length > 0;

      return {
        resourceName: rn,
        id,
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

    const candidates = analyses.filter((a) => a.shouldPause && a.resourceName);

    // Report
    void track({
      type: 'ads_monitor_candidates',
      level: 'info',
      source: 'admin.api.ads.monitor',
      props: {
        window: `${startStr} → ${endStr}`,
        total: analyses.length,
        candidates: candidates.map((c) => ({ id: c.id, name: c.name, spend: c.spendEUR, reasons: c.reasons })),
      },
      ip,
      ua,
    });

    let paused = 0;
    let failed = 0;

    if (apply && candidates.length > 0) {
      // Batch updates (up to ~100 ops per call); keep small to be safe
      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(candidates, 20);
      for (const b of batches) {
        const operations = b.map((c) => ({
          update: { resourceName: c.resourceName, status: 'PAUSED' as const },
          updateMask: 'status',
        }));
        const mutateResp = await fetchWithRetry(
          `https://googleads.googleapis.com/v21/customers/${customerId}/campaigns:mutate`,
          { method: 'POST', headers, body: JSON.stringify({ operations }) }
        );
        if (!mutateResp.ok) {
          failed += b.length;
          const t = await mutateResp.text().catch(() => '');
          await logError('admin.api.ads.monitor', new Error(`mutate_failed ${mutateResp.status}`), { body: t }, ip, ua);
        } else {
          paused += b.length;
        }
      }
      void track({ type: 'ads_monitor_applied', level: 'info', source: 'admin.api.ads.monitor', props: { paused, failed }, ip, ua });
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.ads.monitor',
      props: { duration_ms: Date.now() - startedAt, candidates: candidates.length, paused, failed },
      ip,
      ua,
    });

    return NextResponse.json(
      {
        data: {
          window: `${startStr} → ${endStr}`,
          total: analyses.length,
          candidates,
          paused,
          failed,
          apply,
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (e) {
    await logError('admin.api.ads.monitor', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.ads.monitor' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
