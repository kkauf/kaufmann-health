import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { getMetabaseEmbedUrl, getDashboardIds } from '@/lib/metabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dashboardKey = url.searchParams.get('dashboard');

  if (!dashboardKey) {
    return NextResponse.json(
      { data: null, error: 'Missing ?dashboard= parameter' },
      { status: 400 }
    );
  }

  const ids = getDashboardIds();
  if (!ids.has(dashboardKey)) {
    return NextResponse.json(
      { data: null, error: `Unknown dashboard: "${dashboardKey}". Available: ${Array.from(ids.keys()).join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const embedUrl = await getMetabaseEmbedUrl(dashboardKey);
    return NextResponse.json({ data: { embedUrl }, error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate embed URL';
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
