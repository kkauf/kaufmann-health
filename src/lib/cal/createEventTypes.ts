/**
 * Cal.com Event Type Creation via tRPC
 *
 * SQL-created event types don't work on Cal.com booking pages (404 error).
 * This module creates event types via Cal.com's internal tRPC endpoint,
 * which properly triggers all internal Cal.com mechanisms.
 *
 * Auth flow:
 * 1. GET /api/auth/csrf → extract csrfToken
 * 2. POST /api/auth/callback/credentials with email + password + csrfToken → session cookie
 * 3. POST /api/trpc/eventTypesHeavy/create?batch=1 with session cookie
 */

import { Pool } from 'pg';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

export interface EventTypeConfig {
  title: string;
  slug: string;
  description: string;
  lengthMinutes: number;
  minimumBookingNoticeMinutes?: number;
}

export interface CreateEventTypesResult {
  introId: number | null;
  fullSessionId: number | null;
  success: boolean;
  error?: string;
}

// Standard KH event types with minimum booking notice
// intro: 4 hours (240 min) - allows same-day but not last-minute
// full-session: 24 hours (1440 min) - industry standard for therapy sessions
export const KH_INTRO_EVENT: EventTypeConfig = {
  title: 'Kostenloses Kennenlerngespräch (15 Min)',
  slug: 'intro',
  description: 'Ein kurzes, unverbindliches Videogespräch zum Kennenlernen.',
  lengthMinutes: 15,
  minimumBookingNoticeMinutes: 240, // 4 hours
};

export const KH_FULL_SESSION_EVENT: EventTypeConfig = {
  title: 'Therapiesitzung (50 Min)',
  slug: 'full-session',
  description: 'Eine vollständige Therapiesitzung per Video oder in meiner Praxis.',
  lengthMinutes: 50,
  minimumBookingNoticeMinutes: 1440, // 24 hours
};

/**
 * Update minimum booking notice for an event type via SQL
 */
async function updateEventTypeSettings(eventTypeId: number, config: EventTypeConfig): Promise<void> {
  if (!CAL_DATABASE_URL || !config.minimumBookingNoticeMinutes) return;

  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(
      'UPDATE "EventType" SET "minimumBookingNotice" = $1 WHERE id = $2',
      [config.minimumBookingNoticeMinutes, eventTypeId]
    );
    console.log(`  Updated minimumBookingNotice to ${config.minimumBookingNoticeMinutes} min for event ${eventTypeId}`);
  } finally {
    await pool.end();
  }
}

/**
 * Get existing event type IDs for a user from the database
 */
async function getExistingEventTypes(userId: number): Promise<Map<string, number>> {
  if (!CAL_DATABASE_URL) return new Map();

  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const result = await pool.query(
      'SELECT id, slug FROM "EventType" WHERE "userId" = $1',
      [userId]
    );
    const map = new Map<string, number>();
    for (const row of result.rows) {
      map.set(row.slug, row.id);
    }
    return map;
  } finally {
    await pool.end();
  }
}

/**
 * Get user ID by email from the database
 */
async function getUserIdByEmail(email: string): Promise<number | null> {
  if (!CAL_DATABASE_URL) return null;

  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    return result.rows[0]?.id || null;
  } finally {
    await pool.end();
  }
}

/**
 * Authenticate with Cal.com via NextAuth credentials flow.
 * Returns the session cookie string needed for tRPC calls.
 */
async function getCalSession(email: string, password: string): Promise<string> {
  // Step 1: Get CSRF token
  const csrfRes = await fetch(`${CAL_ORIGIN}/api/auth/csrf`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!csrfRes.ok) {
    throw new Error(`Failed to get CSRF token: ${csrfRes.status} ${csrfRes.statusText}`);
  }
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };
  if (!csrfToken) {
    throw new Error('CSRF token missing from response');
  }

  // Collect cookies from CSRF response (next-auth.csrf-token)
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const cookieJar: string[] = csrfCookies.map(c => c.split(';')[0]);

  // Step 2: POST credentials to NextAuth callback
  const callbackRes = await fetch(`${CAL_ORIGIN}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieJar.join('; '),
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      callbackUrl: `${CAL_ORIGIN}/event-types`,
      json: 'true',
    }),
    redirect: 'manual', // Capture Set-Cookie headers from redirect response
  });

  // NextAuth returns a redirect (302/307) on success with session cookie
  const callbackCookies = callbackRes.headers.getSetCookie?.() || [];

  // Merge all cookies (CSRF + session)
  for (const cookie of callbackCookies) {
    const nameValue = cookie.split(';')[0];
    const name = nameValue.split('=')[0];
    // Replace existing cookie with same name
    const existingIdx = cookieJar.findIndex(c => c.startsWith(`${name}=`));
    if (existingIdx >= 0) {
      cookieJar[existingIdx] = nameValue;
    } else {
      cookieJar.push(nameValue);
    }
  }

  // Verify we got a session cookie (may be prefixed with __Secure- on HTTPS)
  const hasSession = cookieJar.some(c => c.includes('session-token='));
  if (!hasSession) {
    // Check for specific error responses from Cal.com
    const bodyText = await callbackRes.text().catch(() => '');
    const status = callbackRes.status;
    if (bodyText.includes('second-factor-required')) {
      throw new Error('Cal.com login failed - account has 2FA enabled. Provisioned accounts should not have 2FA.');
    }
    throw new Error(`Cal.com login failed - no session cookie received (HTTP ${status}). Body: ${bodyText.substring(0, 200)}`);
  }

  return cookieJar.join('; ');
}

/**
 * Create a single event type via Cal.com's internal tRPC endpoint.
 * Returns the created event type ID or null on failure.
 */
async function createEventTypeViaTrpc(
  sessionCookie: string,
  config: EventTypeConfig,
): Promise<number | null> {
  const payload = {
    json: {
      title: config.title,
      slug: config.slug,
      description: config.description,
      length: config.lengthMinutes,
      locations: [{ type: 'integrations:daily' }], // Cal Video
      ...(config.minimumBookingNoticeMinutes != null && {
        minimumBookingNotice: config.minimumBookingNoticeMinutes,
      }),
    },
    meta: {
      values: {},
    },
  };

  // tRPC batch format: object with index keys, not an array
  const res = await fetch(`${CAL_ORIGIN}/api/trpc/eventTypesHeavy/create?batch=1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ "0": payload }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`tRPC eventTypesHeavy/create failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json() as Array<{
    result?: { data?: { json?: { eventType?: { id?: number } } } };
    error?: { json?: { message?: string } };
  }>;

  // Batch response is an array; we sent one item at index "0"
  const item = data[0];
  if (item?.error) {
    throw new Error(`tRPC error: ${item.error.json?.message || JSON.stringify(item.error)}`);
  }

  const eventTypeId = item?.result?.data?.json?.eventType?.id ?? null;
  return eventTypeId;
}

/**
 * Create event types for a Cal.com user via tRPC API.
 * This replaces the Playwright UI automation approach.
 */
export async function createEventTypesViaTrpc(
  email: string,
  password: string,
  username: string,
  eventTypes: EventTypeConfig[] = [KH_INTRO_EVENT, KH_FULL_SESSION_EVENT]
): Promise<CreateEventTypesResult> {
  try {
    // Check which event types already exist
    const userId = await getUserIdByEmail(email);
    const existingTypes = userId ? await getExistingEventTypes(userId) : new Map();

    // Filter to only create missing event types
    const toCreate = eventTypes.filter(et => !existingTypes.has(et.slug));

    // If all already exist, return existing IDs
    if (toCreate.length === 0) {
      console.log('All event types already exist, skipping creation');
      return {
        introId: existingTypes.get('intro') || null,
        fullSessionId: existingTypes.get('full-session') || null,
        success: true,
      };
    }

    console.log(`Creating ${toCreate.length} event types via tRPC: ${toCreate.map(t => t.slug).join(', ')}`);

    // Authenticate with Cal.com
    const sessionCookie = await getCalSession(email, password);

    const createdIds = new Map<string, number>(existingTypes);

    // Create each missing event type
    for (const eventType of toCreate) {
      const id = await createEventTypeViaTrpc(sessionCookie, eventType);
      if (id) {
        createdIds.set(eventType.slug, id);
        console.log(`Created event type: ${eventType.slug} (ID: ${id})`);
        // Update minimum booking notice via SQL as safety net
        await updateEventTypeSettings(id, eventType);
      } else {
        console.error(`Failed to create event type ${eventType.slug}: no ID returned`);
      }
    }

    return {
      introId: createdIds.get('intro') || null,
      fullSessionId: createdIds.get('full-session') || null,
      success: eventTypes.every(et => createdIds.has(et.slug)),
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to create event types via tRPC:', message);
    return {
      introId: null,
      fullSessionId: null,
      success: false,
      error: message,
    };
  }
}

// Temporary alias for backwards compatibility during migration
export const createEventTypesViaUI = createEventTypesViaTrpc;
