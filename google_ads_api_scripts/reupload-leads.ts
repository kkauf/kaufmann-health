#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load env from .env.local (project root) if present, otherwise fall back to .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  // Override ensures we don't accidentally keep stale values from parent env
  dotenv.config({ path: envLocalPath, override: true });
} else {
  // Load .env only for missing values
  dotenv.config();
}

// Will be initialized in main() after env is loaded
let supabaseServer: any;
let googleAdsTracker: any;
let GAInternals: any;

// Re-upload Google Ads enhanced conversions for leads from Supabase `people` table.
// Usage examples:
//   npm run reupload:leads -- --type=patient                      // all patient leads from last 63 days
//   npm run reupload:leads -- --type=therapist                    // all therapist leads from last 63 days
//   npm run reupload:leads -- --type=all --since=2025-08-01       // both types since date
//   npm run reupload:leads -- --ids=uuid1,uuid2,uuid3             // only these IDs
//   npm run reupload:leads -- --dry-run                           // print what would be sent, don’t upload

// Google accepts backdated enhanced conversions for leads up to 63 days.
const DEFAULT_BACKDAYS = 63;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

type LeadType = 'patient' | 'therapist' | 'all';

type Person = {
  id: string;
  email: string | null;
  type: 'patient' | 'therapist' | string | null;
  created_at: string;
};

function parseArgs(argv: string[]) {
  let type: LeadType = 'patient';
  let since: string | undefined;
  let ids: string[] = [];
  let batch = 100;
  let dryRun = false;

  for (const arg of argv) {
    if (arg.startsWith('--type=')) {
      const t = arg.split('=')[1];
      if (t === 'patient' || t === 'therapist' || t === 'all') type = t;
    } else if (arg.startsWith('--since=')) {
      since = arg.split('=')[1];
    } else if (arg.startsWith('--ids=')) {
      ids = arg
        .split('=')[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--batch=')) {
      const n = Number(arg.split('=')[1]);
      if (!Number.isNaN(n) && n > 0) batch = Math.min(n, 500);
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { type, since, ids, batch, dryRun } as const;
}

function mapActionAndValue(t: 'patient' | 'therapist') {
  if (t === 'therapist') return { action: 'therapist_registration', value: 25 } as const;
  return { action: 'client_registration', value: 10 } as const;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchPeople({
  type,
  sinceIso,
  ids,
}: {
  type: LeadType;
  sinceIso?: string;
  ids: string[];
}): Promise<Person[]> {
  let query = supabaseServer
    .from('people')
    .select('id, email, type, created_at', { count: 'exact' })
    .order('created_at', { ascending: true });

  if (ids.length > 0) {
    query = query.in('id', ids);
  } else {
    if (type === 'patient' || type === 'therapist') {
      query = query.eq('type', type);
    } else {
      query = query.in('type', ['patient', 'therapist']);
    }
    if (sinceIso) query = query.gte('created_at', sinceIso);
  }

  // Fetch in pages to be safe on large datasets
  const pageSize = 1000;
  let from = 0;
  let all: Person[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat((data as Person[]) || []);
    from += pageSize;
    if (!count || from >= count) break;
  }
  return all;
}

async function main() {
  // Import after env is loaded
  ({ supabaseServer } = await import('../src/lib/supabase-server'));
  ({ googleAdsTracker, __internals: GAInternals } = await import('../src/lib/google-ads'));
  const { type, since, ids, batch, dryRun } = parseArgs(process.argv.slice(2));

  const sinceIso = ids.length === 0 ? (since ? new Date(since).toISOString() : daysAgoIso(DEFAULT_BACKDAYS)) : undefined;

  console.log('[reupload-leads] Params:', { type, sinceIso, idsCount: ids.length, batch, dryRun });

  const leads = await fetchPeople({ type, sinceIso, ids });
  const filtered = leads.filter((p) => !!p.email && (p.type === 'patient' || p.type === 'therapist')) as Array<
    Required<Pick<Person, 'id' | 'email' | 'type' | 'created_at'>>
  >;

  if (filtered.length === 0) {
    console.log('[reupload-leads] No leads found for criteria.');
    return;
  }

  // Build EnhancedConversions using the same hashing/formatting as production
  const enhanced = filtered.map((p) => {
    const t = p.type as 'patient' | 'therapist';
    const { action, value } = mapActionAndValue(t);
    return {
      conversion_action: action,
      conversion_date_time: GAInternals.toGoogleDateTime(p.created_at),
      conversion_value: value,
      currency: 'EUR',
      order_id: p.id,
      user_identifiers: [{ hashed_email: googleAdsTracker.hashEmail(p.email!) }],
    };
  });

  console.log('[reupload-leads] Prepared conversions:', {
    total: enhanced.length,
    sample: enhanced.slice(0, 3).map((e) => ({
      action: e.conversion_action,
      time: e.conversion_date_time,
      value: e.conversion_value,
      currency: e.currency,
      order_id: e.order_id,
      hashed_email_prefix: e.user_identifiers[0].hashed_email.slice(0, 8),
    })),
  });

  if (dryRun) {
    console.log('[reupload-leads] Dry run complete. No uploads performed.');
    return;
  }

  const batches = chunk(enhanced, batch);
  let successBatches = 0;
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    console.log(`[reupload-leads] Uploading batch ${i + 1}/${batches.length} (size ${b.length})…`);
    try {
      await googleAdsTracker.uploadEnhancedConversions(b);
      successBatches++;
    } catch (e) {
      console.error('[reupload-leads] Batch failed:', e);
    }
  }
  console.log('[reupload-leads] Done. Batches OK/Total:', successBatches, '/', batches.length);
}

main().catch((e) => {
  console.error('[reupload-leads] Fatal error:', e);
  process.exit(1);
});
