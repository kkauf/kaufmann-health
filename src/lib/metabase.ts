import { SignJWT } from 'jose';

const METABASE_SITE_URL = process.env.METABASE_SITE_URL;
const METABASE_EMBEDDING_SECRET_KEY = process.env.METABASE_EMBEDDING_SECRET_KEY;

/** Parse "kpis:1,funnels:2,trends:3" into Map<string, number> */
function parseDashboardIds(): Map<string, number> {
  const raw = process.env.METABASE_DASHBOARD_IDS || '';
  const map = new Map<string, number>();
  for (const pair of raw.split(',')) {
    const [key, id] = pair.trim().split(':');
    if (key && id) {
      const num = parseInt(id, 10);
      if (!isNaN(num)) map.set(key, num);
    }
  }
  return map;
}

let dashboardIds: Map<string, number> | null = null;

export function getDashboardIds(): Map<string, number> {
  if (!dashboardIds) dashboardIds = parseDashboardIds();
  return dashboardIds;
}

export function getDashboardKeys(): string[] {
  return Array.from(getDashboardIds().keys());
}

export async function getMetabaseEmbedUrl(dashboardKey: string): Promise<string> {
  if (!METABASE_SITE_URL) throw new Error('METABASE_SITE_URL not configured');
  if (!METABASE_EMBEDDING_SECRET_KEY) throw new Error('METABASE_EMBEDDING_SECRET_KEY not configured');

  const ids = getDashboardIds();
  const dashboardId = ids.get(dashboardKey);
  if (dashboardId === undefined) {
    throw new Error(`Unknown dashboard key: "${dashboardKey}". Available: ${Array.from(ids.keys()).join(', ')}`);
  }

  const secret = new TextEncoder().encode(METABASE_EMBEDDING_SECRET_KEY);

  const token = await new SignJWT({
    resource: { dashboard: dashboardId },
    params: {},
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret);

  return `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=false&titled=true`;
}
