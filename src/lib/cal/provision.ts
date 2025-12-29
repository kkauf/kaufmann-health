/**
 * Cal.com User Provisioning
 *
 * WHY: Cal.com is treated as gated infrastructure. Users cannot self-register;
 * KH backend provisions Cal.com accounts for approved therapists.
 *
 * HOW: Direct SQL inserts into Cal.com Postgres (Railway) for:
 * - users table (profile)
 * - UserPassword table (bcrypt hash)
 * - Webhook table (per-user webhook for booking events)
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;
const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET;
const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const KH_WEBHOOK_URL = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/public/cal/webhook`
  : 'https://www.kaufmann-health.de/api/public/cal/webhook';

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
};

export type ProvisionCalUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  timeZone?: string;
};

/**
 * Provision a Cal.com user for an approved therapist.
 *
 * Creates:
 * 1. User record in Cal.com users table
 * 2. Password hash in UserPassword table
 * 3. Per-user webhook for booking events
 *
 * Returns cal_user_id, cal_username, and plaintext password (for email).
 */
export async function provisionCalUser(
  input: ProvisionCalUserInput
): Promise<CalProvisionResult> {
  const { email, firstName, lastName, timeZone = 'Europe/Berlin' } = input;

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
      // User already exists - return existing info without creating new
      const existingUser = existingEmail.rows[0];
      await client.query('ROLLBACK');
      return {
        cal_user_id: existingUser.id,
        cal_username: existingUser.username,
        cal_password: '', // Cannot retrieve existing password
        cal_login_url: `${CAL_ORIGIN}/auth/login`,
      };
    }

    // Generate password
    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    // Insert user
    // Cal.com users table key columns: id (serial), username, name, email, timeZone, locale, completedOnboarding
    const userResult = await client.query(
      `INSERT INTO users (
        username, name, email, "timeZone", locale, "completedOnboarding",
        "identityProvider", "emailVerified"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id`,
      [
        username,
        `${firstName} ${lastName}`.trim(),
        email,
        timeZone,
        'de', // German locale
        true, // Skip onboarding
        'CAL', // Identity provider
      ]
    );
    const userId = userResult.rows[0].id as number;

    // Insert password hash
    await client.query(
      `INSERT INTO "UserPassword" ("userId", hash) VALUES ($1, $2)`,
      [userId, passwordHash]
    );

    // Create per-user webhook for booking events
    if (CAL_WEBHOOK_SECRET) {
      const webhookId = randomUUID();
      await client.query(
        `INSERT INTO "Webhook" (
          id, "userId", "subscriberUrl", "payloadTemplate", active, secret,
          "eventTriggers", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::text[]::\"WebhookTriggerEvents\"[], NOW())`,
        [
          webhookId,
          userId,
          KH_WEBHOOK_URL,
          null, // Use default payload
          true,
          CAL_WEBHOOK_SECRET,
          ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'],
        ]
      );
    }

    await client.query('COMMIT');

    return {
      cal_user_id: userId,
      cal_username: username,
      cal_password: password,
      cal_login_url: `${CAL_ORIGIN}/auth/login`,
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
