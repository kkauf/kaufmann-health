/**
 * Cal.com Event Type Creation via Playwright
 * 
 * SQL-created event types don't work on Cal.com booking pages (404 error).
 * This module uses Playwright to create event types via the Cal.com UI,
 * which properly triggers all internal Cal.com mechanisms.
 */

import { chromium, Browser, Page } from 'playwright';
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
 * Create event types for a Cal.com user via Playwright UI automation.
 * This is necessary because SQL-created event types don't work on booking pages.
 */
export async function createEventTypesViaUI(
  email: string,
  password: string,
  username: string,
  eventTypes: EventTypeConfig[] = [KH_INTRO_EVENT, KH_FULL_SESSION_EVENT]
): Promise<CreateEventTypesResult> {
  let browser: Browser | null = null;
  
  try {
    // Check which event types already exist
    const userId = await getUserIdByEmail(email);
    const existingTypes = userId ? await getExistingEventTypes(userId) : new Map();
    
    // Filter to only create missing event types
    const toCreate = eventTypes.filter(et => !existingTypes.has(et.slug));
    
    // If all already exist, return existing IDs
    if (toCreate.length === 0) {
      console.log('All event types already exist, skipping UI creation');
      return {
        introId: existingTypes.get('intro') || null,
        fullSessionId: existingTypes.get('full-session') || null,
        success: true,
      };
    }
    
    console.log(`Creating ${toCreate.length} event types via UI: ${toCreate.map(t => t.slug).join(', ')}`);
    
    // Launch headless browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Login to Cal.com
    await page.goto(`${CAL_ORIGIN}/auth/login`);
    await page.waitForLoadState('networkidle');
    
    // Fill login form - wait for inputs to be ready
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to event-types page
    await page.waitForURL('**/event-types**', { timeout: 15000 });
    await page.waitForTimeout(3000); // Extra wait for page to fully load
    
    const createdIds = new Map<string, number>(existingTypes);
    
    // Create each missing event type
    for (const eventType of toCreate) {
      const id = await createSingleEventType(page, eventType);
      if (id) {
        createdIds.set(eventType.slug, id);
        // Update minimum booking notice via SQL after UI creation
        await updateEventTypeSettings(id, eventType);
      }
    }
    
    return {
      introId: createdIds.get('intro') || null,
      fullSessionId: createdIds.get('full-session') || null,
      success: createdIds.size === eventTypes.length,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to create event types via UI:', message);
    return {
      introId: null,
      fullSessionId: null,
      success: false,
      error: message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function createSingleEventType(
  page: Page,
  eventType: EventTypeConfig
): Promise<number | null> {
  try {
    // Navigate to event types page fresh
    await page.goto(`${CAL_ORIGIN}/event-types`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Dismiss any feature announcements/modals by pressing Escape multiple times
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    
    // Wait for and click "Neu" (New) button
    const newButton = page.locator('[data-testid="new-event-type"]');
    await newButton.waitFor({ state: 'visible', timeout: 10000 });
    await newButton.click();
    
    // Wait for the dialog to appear
    await page.waitForSelector('[data-testid="event-type-quick-chat"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    
    // Fill in title
    await page.fill('[data-testid="event-type-quick-chat"]', eventType.title);
    await page.waitForTimeout(300);
    
    // Set the slug - the URL input
    const _slugInput = page.locator('input').filter({ hasText: '' }).nth(1);
    // Actually find the slug input by looking for the one after /username/
    const urlInput = page.getByRole('textbox', { name: /URL/ });
    await urlInput.clear();
    await urlInput.fill(eventType.slug);
    await page.waitForTimeout(300);
    
    // Set duration if not 15 minutes
    if (eventType.lengthMinutes !== 15) {
      const durationInput = page.getByRole('spinbutton', { name: /Dauer/ });
      await durationInput.clear();
      await durationInput.fill(String(eventType.lengthMinutes));
    }
    
    // Wait for form validation and click "Weiter" (Continue)
    await page.waitForTimeout(500);
    const weiterButton = page.getByRole('button', { name: 'Weiter' });
    
    // Wait for button to be enabled
    await page.waitForFunction(() => {
      const btn = document.querySelector('button:has-text("Weiter")') as HTMLButtonElement;
      return btn && !btn.disabled;
    }, { timeout: 5000 }).catch(() => {
      console.log('Weiter button may be disabled, trying anyway...');
    });
    
    await weiterButton.click();
    
    // Wait for redirect to event type editor
    await page.waitForURL(/\/event-types\/\d+/, { timeout: 15000 });
    
    // Extract event type ID from URL
    const url = page.url();
    const match = url.match(/event-types\/(\d+)/);
    const eventTypeId = match ? parseInt(match[1], 10) : null;
    
    if (eventTypeId) {
      console.log(`✅ Created event type: ${eventType.slug} (ID: ${eventTypeId})`);
    }
    
    return eventTypeId;
    
  } catch (error) {
    console.error(`❌ Failed to create event type ${eventType.slug}:`, error);
    return null;
  }
}

/**
 * Check if Playwright is available for event type creation
 */
export function isPlaywrightAvailable(): boolean {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}
