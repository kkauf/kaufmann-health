import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { googleAdsTracker } from '@/lib/google-ads';
import { safeJson } from '@/lib/http';

export const runtime = 'nodejs';

function getIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const leadsIdx = parts.indexOf('leads');
    if (leadsIdx >= 0 && parts.length > leadsIdx + 1) {
      return decodeURIComponent(parts[leadsIdx + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

function getString(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object') return '';
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' ? v.trim() : '';
}

function getBoolean(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const v = (obj as Record<string, unknown>)[key];
  return Boolean(v);
}

export async function POST(req: Request) {
  // EARTH-190: Deprecated in favor of Fragebogen completion + verification
  return safeJson({ data: null, error: 'Deprecated: Use Fragebogen flow (form-completed + confirmation)' }, { status: 410 });
}
