import { supabaseServer } from '@/lib/supabase-server';
import { safeJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let dbConnected = true;
  let lastLeadSubmission: string | null = null;
  let last24hLeads = 0;
  let lastError: { type: string; created_at: string } | null = null;

  try {
    const { data: lastLeadRows, error: lastLeadErr } = await supabaseServer
      .from('people')
      .select('created_at')
      .eq('type', 'patient')
      .not('metadata->>is_test', 'eq', 'true')
      .order('created_at', { ascending: false })
      .limit(1);
    if (lastLeadErr) throw lastLeadErr;
    lastLeadSubmission = (lastLeadRows && lastLeadRows[0]?.created_at) ? String(lastLeadRows[0].created_at) : null;

    const { count: last24hCount, error: countErr } = await supabaseServer
      .from('people')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'patient')
      .not('metadata->>is_test', 'eq', 'true')
      .gte('created_at', sinceIso);
    if (countErr) throw countErr;
    last24hLeads = Number(last24hCount || 0);

    const { data: lastErrRows, error: lastErr } = await supabaseServer
      .from('events')
      .select('type, level, created_at')
      .eq('level', 'error')
      .order('created_at', { ascending: false })
      .limit(1);
    if (lastErr) throw lastErr;
    if (Array.isArray(lastErrRows) && lastErrRows.length > 0) {
      lastError = { type: String(lastErrRows[0].type || 'unknown'), created_at: String(lastErrRows[0].created_at) };
    }
  } catch (e) {
    dbConnected = false;
  }

  const emailServiceReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 0);

  return safeJson(
    {
      data: {
        lastLeadSubmission,
        last24hLeads,
        lastError,
        dbConnected,
        emailServiceReady,
      },
      error: null,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
