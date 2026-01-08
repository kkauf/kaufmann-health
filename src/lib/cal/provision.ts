/**
 * Cal.com User Provisioning (EARTH-265)
 *
 * WHY: Cal.com is treated as gated infrastructure. Users cannot self-register;
 * KH backend provisions Cal.com accounts for approved therapists.
 *
 * HOW: Direct SQL inserts into Cal.com Postgres (Railway) for:
 * - users table (profile)
 * - UserPassword table (bcrypt hash)
 * - Schedule + Availability (cloned from template user)
 *
 * NOTE: Event types are NOT cloned because SQL-created event types don't work
 * on Cal.com booking pages (404 error). Therapists must create their own event
 * types through the Cal.com UI after logging in.
 *
 * Template-based cloning: We clone schedules/availability from a "golden template"
 * user. This avoids reverse-engineering every required column and handles
 * Cal schema drift gracefully.
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;
const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';

// Template user ID for cloning event types and schedules
// This is the Cal.com user ID of the "golden template" (kgmkauf)
const CAL_TEMPLATE_USER_ID = process.env.CAL_TEMPLATE_USER_ID
  ? parseInt(process.env.CAL_TEMPLATE_USER_ID, 10)
  : 1; // Default to user ID 1 (kgmkauf)

let pool: Pool | null = null;

function getPool(): Pool {
  if (!CAL_DATABASE_URL) {
    throw new Error('CAL_DATABASE_URL not configured');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: CAL_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/**
 * Generate a Cal.com username from therapist name.
 * Format: firstname-lastname (lowercase, ASCII only, no spaces)
 */
export function generateCalUsername(firstName: string, lastName: string): string {
  const slug = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics (ä→a, ö→o, etc.)
      .replace(/[–—−]/g, '-')
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const first = slug(firstName) || 'therapist';
  const last = slug(lastName) || 'kh';
  return `${first}-${last}`;
}

/**
 * Generate a secure random password (16 chars, alphanumeric)
 */
export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Hash password using bcrypt (Cal.com uses 12 rounds)
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export type CalProvisionResult = {
  cal_user_id: number;
  cal_username: string;
  cal_password: string; // plaintext, for email only
  cal_login_url: string;
  cal_intro_event_type_id: number | null;
  cal_full_session_event_type_id: number | null;
};

export type ProvisionCalUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  timeZone?: string;
  avatarUrl?: string;      // Profile photo URL from KH
  practiceAddress?: string; // Practice address for in-person sessions
};

/**
 * Clone schedules from template user to new user.
 * Returns a map of old schedule ID -> new schedule ID.
 */
async function cloneSchedules(
  client: import('pg').PoolClient,
  templateUserId: number,
  newUserId: number,
  timeZone: string
): Promise<Map<number, number>> {
  const scheduleMap = new Map<number, number>();

  // Get template schedules
  const templateSchedules = await client.query(
    `SELECT id, name FROM "Schedule" WHERE "userId" = $1`,
    [templateUserId]
  );

  for (const schedule of templateSchedules.rows) {
    // Create new schedule for new user
    const newSchedule = await client.query(
      `INSERT INTO "Schedule" ("userId", name, "timeZone")
       VALUES ($1, $2, $3)
       RETURNING id`,
      [newUserId, schedule.name, timeZone]
    );
    const newScheduleId = newSchedule.rows[0].id;
    scheduleMap.set(schedule.id, newScheduleId);

    // Clone availability entries for this schedule
    await client.query(
      `INSERT INTO "Availability" ("userId", "scheduleId", days, "startTime", "endTime", date)
       SELECT $1, $2, days, "startTime", "endTime", date
       FROM "Availability"
       WHERE "scheduleId" = $3`,
      [newUserId, newScheduleId, schedule.id]
    );
  }

  return scheduleMap;
}

/**
 * Clone event types from template user to new user.
 * Returns the IDs of the cloned intro and full-session event types.
 */
async function cloneEventTypes(
  client: import('pg').PoolClient,
  templateUserId: number,
  newUserId: number,
  scheduleMap: Map<number, number>,
  practiceAddress?: string
): Promise<{ introId: number | null; fullSessionId: number | null }> {
  let introId: number | null = null;
  let fullSessionId: number | null = null;

  // Get template event types
  const templateEventTypes = await client.query(
    `SELECT id, slug, title, length, description, "scheduleId", hidden,
            "successRedirectUrl", "forwardParamsSuccessRedirect", locations,
            "minimumBookingNotice", "beforeEventBuffer", "afterEventBuffer",
            "slotInterval", "periodType", "periodDays", "periodStartDate", "periodEndDate",
            "requiresConfirmation", "disableGuests", "hideCalendarNotes",
            "seatsPerTimeSlot", "seatsShowAttendees", "seatsShowAvailabilityCount",
            "bookingLimits", "durationLimits", metadata, "bookingFields"
     FROM "EventType"
     WHERE "userId" = $1`,
    [templateUserId]
  );

  for (const et of templateEventTypes.rows) {
    // Map old scheduleId to new scheduleId
    const newScheduleId = et.scheduleId ? scheduleMap.get(et.scheduleId) || null : null;

    // Insert cloned event type
    // Note: JSON columns need proper handling
    const newEventType = await client.query(
      `INSERT INTO "EventType" (
        "userId", slug, title, length, description, "scheduleId", hidden,
        "successRedirectUrl", "forwardParamsSuccessRedirect", locations,
        "minimumBookingNotice", "beforeEventBuffer", "afterEventBuffer",
        "slotInterval", "periodType", "periodDays", "periodStartDate", "periodEndDate",
        "requiresConfirmation", "disableGuests", "hideCalendarNotes",
        "seatsPerTimeSlot", "seatsShowAttendees", "seatsShowAvailabilityCount",
        "bookingLimits", "durationLimits", metadata, "bookingFields"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10::jsonb,
        $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25::jsonb, $26::jsonb, $27::jsonb, $28::jsonb
      ) RETURNING id`,
      [
        newUserId, et.slug, et.title, et.length, et.description, newScheduleId, et.hidden,
        et.successRedirectUrl, et.forwardParamsSuccessRedirect, 
        processLocations(et.locations, practiceAddress),
        et.minimumBookingNotice, et.beforeEventBuffer, et.afterEventBuffer,
        et.slotInterval, et.periodType, et.periodDays, et.periodStartDate, et.periodEndDate,
        et.requiresConfirmation, et.disableGuests, et.hideCalendarNotes,
        et.seatsPerTimeSlot, et.seatsShowAttendees, et.seatsShowAvailabilityCount,
        typeof et.bookingLimits === 'string' ? et.bookingLimits : JSON.stringify(et.bookingLimits),
        typeof et.durationLimits === 'string' ? et.durationLimits : JSON.stringify(et.durationLimits),
        typeof et.metadata === 'string' ? et.metadata : JSON.stringify(et.metadata),
        typeof et.bookingFields === 'string' ? et.bookingFields : JSON.stringify(et.bookingFields),
      ]
    );

    const newId = newEventType.rows[0].id;
    if (et.slug === 'intro') introId = newId;
    if (et.slug === 'full-session') fullSessionId = newId;
  }

  return { introId, fullSessionId };
}

/**
 * Process locations JSON, replacing "Praxisadresse" placeholder with actual address.
 */
function processLocations(locations: unknown, practiceAddress?: string): string {
  let locArray: Array<{ type: string; address?: string }>;
  
  if (typeof locations === 'string') {
    try {
      locArray = JSON.parse(locations);
    } catch {
      return locations; // Return as-is if not valid JSON
    }
  } else if (Array.isArray(locations)) {
    locArray = locations;
  } else {
    return JSON.stringify(locations);
  }
  
  // Replace "Praxisadresse" placeholder with actual address
  if (practiceAddress) {
    locArray = locArray.map(loc => {
      if (loc.type === 'inPerson' && loc.address === 'Praxisadresse') {
        return { ...loc, address: practiceAddress };
      }
      return loc;
    });
  }
  
  return JSON.stringify(locArray);
}

/**
 * Provision a Cal.com user for an approved therapist.
 *
 * Creates:
 * 1. User record in Cal.com users table
 * 2. Password hash in UserPassword table
 * 3. Schedules + Availability (cloned from template user)
 *
 * NOTE: Event types are NOT created - therapists must create them via Cal.com UI
 * because SQL-created event types don't work on booking pages (Cal.com limitation).
 *
 * Returns cal_user_id, cal_username, and plaintext password.
 */
export async function provisionCalUser(
  input: ProvisionCalUserInput
): Promise<CalProvisionResult> {
  const { email, firstName, lastName, timeZone = 'Europe/Berlin', avatarUrl, practiceAddress } = input;

  if (!CAL_DATABASE_URL) {
    throw new Error('CAL_DATABASE_URL not configured - Cal.com provisioning disabled');
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate username (ensure uniqueness by appending random suffix if needed)
    const baseUsername = generateCalUsername(firstName, lastName);
    let username = baseUsername;
    let attempt = 0;

    // Check for existing username and make unique if needed
    while (true) {
      const existing = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      if (existing.rows.length === 0) break;
      attempt++;
      username = `${baseUsername}-${attempt}`;
      if (attempt > 10) {
        // Fallback to random suffix
        username = `${baseUsername}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }

    // Check if user with this email already exists
    const existingEmail = await client.query(
      'SELECT id, username FROM users WHERE email = $1',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      // User already exists - look up their event types
      const existingUser = existingEmail.rows[0];
      const existingEventTypes = await client.query(
        `SELECT id, slug FROM "EventType" WHERE "userId" = $1`,
        [existingUser.id]
      );
      let introId: number | null = null;
      let fullSessionId: number | null = null;
      for (const et of existingEventTypes.rows) {
        if (et.slug === 'intro') introId = et.id;
        if (et.slug === 'full-session') fullSessionId = et.id;
      }
      await client.query('ROLLBACK');
      return {
        cal_user_id: existingUser.id,
        cal_username: existingUser.username,
        cal_password: '', // Cannot retrieve existing password
        cal_login_url: `${CAL_ORIGIN}/auth/login`,
        cal_intro_event_type_id: introId,
        cal_full_session_event_type_id: fullSessionId,
      };
    }

    // Generate password
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    // Insert user
    // Cal.com users table key columns: id (serial), uuid, username, name, email, timeZone, locale, completedOnboarding, avatarUrl, timeFormat
    const userResult = await client.query(
      `INSERT INTO users (
        uuid, username, name, email, "timeZone", locale, "timeFormat", "completedOnboarding",
        "identityProvider", "emailVerified", "avatarUrl"
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
      RETURNING id`,
      [
        username,
        `${firstName} ${lastName}`.trim(),
        email,
        timeZone,
        'de', // German locale
        24, // 24-hour format (German standard)
        true, // Skip onboarding
        'CAL', // Identity provider
        avatarUrl || null, // Profile photo from KH
      ]
    );
    const userId = userResult.rows[0].id as number;

    // Insert password hash
    await client.query(
      `INSERT INTO "UserPassword" ("userId", hash) VALUES ($1, $2)`,
      [userId, passwordHash]
    );

    // Clone schedules from template user
    const scheduleMap = await cloneSchedules(client, CAL_TEMPLATE_USER_ID, userId, timeZone);

    // Set user's default schedule to the first cloned schedule
    const firstScheduleId = scheduleMap.values().next().value;
    if (firstScheduleId) {
      await client.query(
        'UPDATE users SET "defaultScheduleId" = $1 WHERE id = $2',
        [firstScheduleId, userId]
      );
    }

    // Create per-user webhook for this therapist
    // This ensures only KH-managed therapists' bookings trigger our webhook
    const webhookUrl = process.env.KH_CAL_WEBHOOK_URL || 'https://www.kaufmann-health.de/api/public/cal/webhook';
    const webhookSecret = process.env.CAL_WEBHOOK_SECRET || '';
    
    await client.query(
      `INSERT INTO "Webhook" (id, "userId", "subscriberUrl", active, "eventTriggers", secret, "createdAt", time, "timeUnit", version)
       VALUES (gen_random_uuid(), $1, $2, true, 
         '{BOOKING_CREATED,BOOKING_CANCELLED,BOOKING_RESCHEDULED}',
         $3, NOW(), 5, 'minute', '2021-10-20')
       ON CONFLICT DO NOTHING`,
      [userId, webhookUrl, webhookSecret]
    );

    await client.query('COMMIT');

    // Create event types via Playwright UI automation
    // SQL-created event types don't work on Cal.com booking pages (404 error)
    let introId: number | null = null;
    let fullSessionId: number | null = null;
    
    try {
      const { createEventTypesViaUI } = await import('./createEventTypes');
      const result = await createEventTypesViaUI(email, password, username);
      introId = result.introId;
      fullSessionId = result.fullSessionId;
      if (!result.success) {
        console.warn('Event type creation via UI had issues:', result.error);
      }
    } catch (err) {
      console.warn('Could not create event types via UI (Playwright may not be available):', err);
    }

    return {
      cal_user_id: userId,
      cal_username: username,
      cal_password: password,
      cal_login_url: `${CAL_ORIGIN}/auth/login`,
      cal_intro_event_type_id: introId,
      cal_full_session_event_type_id: fullSessionId,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if Cal.com provisioning is available (CAL_DATABASE_URL configured)
 */
export function isCalProvisioningEnabled(): boolean {
  return Boolean(CAL_DATABASE_URL);
}
