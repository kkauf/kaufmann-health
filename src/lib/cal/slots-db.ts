/**
 * Cal.com Slots via Direct DB Queries (EARTH-256)
 *
 * WHY: Cal.com Docker deployment doesn't include v2 REST API.
 * We query Cal's Postgres directly (same DB we use for provisioning).
 *
 * Schema overview:
 * - users: id, username, email, timeZone
 * - EventType: id, userId, slug, length, title
 * - Schedule: id, userId, name, timeZone
 * - Availability: id, scheduleId, days (int[]), startTime, endTime
 * - Booking: id, eventTypeId, startTime, endTime, status
 */

import { Pool } from 'pg';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

// Query timeout for Cal DB operations (EARTH-262)
const CAL_QUERY_TIMEOUT_MS = 5000;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!CAL_DATABASE_URL) {
    throw new Error('CAL_DATABASE_URL not configured');
  }
  if (!pool) {
    console.log('[cal/slots-db] Creating new pool, URL prefix:', CAL_DATABASE_URL.substring(0, 30) + '...');
    pool = new Pool({
      connectionString: CAL_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: CAL_QUERY_TIMEOUT_MS, // EARTH-262: 5s connection timeout
      statement_timeout: CAL_QUERY_TIMEOUT_MS, // EARTH-262: 5s query timeout
    });
    
    pool.on('error', (err) => {
      console.error('[cal/slots-db] Pool error:', err.message);
    });
  }
  return pool;
}

export function isCalDbEnabled(): boolean {
  return Boolean(CAL_DATABASE_URL);
}

interface CalEventType {
  id: number;
  slug: string;
  title: string;
  length: number; // minutes
  slotInterval: number | null; // minutes between slots (null = use length)
  userId: number;
  scheduleId: number | null; // event-type-specific schedule (null = use default)
}

interface CalAvailability {
  days: number[]; // 0=Sunday, 1=Monday, etc.
  startTime: string; // TIME as 'HH:MM:SS' string
  endTime: string; // TIME as 'HH:MM:SS' string
}

interface CalBooking {
  startTime: Date;
  endTime: Date;
}

interface CalDateOverride {
  date: Date; // The specific date this override applies to
  startTime: string | null; // Override start time (null = day is blocked)
  endTime: string | null; // Override end time (null = day is blocked)
}

export interface CalSlot {
  date_iso: string; // YYYY-MM-DD
  time_label: string; // HH:MM
  time_utc: string; // ISO datetime
}

export interface CalSlotsResult {
  slots: CalSlot[];
  eventTypeId: number;
  eventLength: number; // minutes
}

/**
 * Get Cal.com user ID by username
 */
async function getCalUserId(username: string): Promise<number | null> {
  const db = getPool();
  const result = await db.query<{ id: number }>(
    'SELECT id FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  return result.rows[0]?.id || null;
}

/**
 * Get event type by user ID and slug (internal use)
 */
async function getEventTypeByUserId(userId: number, slug: string): Promise<CalEventType | null> {
  const db = getPool();
  const result = await db.query<CalEventType>(
    `SELECT id, slug, title, length, "slotInterval", "userId", "scheduleId" 
     FROM "EventType" 
     WHERE "userId" = $1 AND slug = $2 
     LIMIT 1`,
    [userId, slug]
  );
  return result.rows[0] || null;
}

/**
 * Get event type by Cal.com username and event slug (EARTH-271)
 * Used for native booking to get eventTypeId
 */
export async function getEventType(
  calUsername: string,
  eventSlug: string
): Promise<{ eventTypeId: number; length: number; title: string } | null> {
  const userId = await getCalUserId(calUsername);
  if (!userId) return null;
  
  const eventType = await getEventTypeByUserId(userId, eventSlug);
  if (!eventType) return null;
  
  return {
    eventTypeId: eventType.id,
    length: eventType.length,
    title: eventType.title,
  };
}

/**
 * Get availability for an event type (uses event-specific schedule if set, else user default)
 */
async function getAvailability(userId: number, eventScheduleId: number | null): Promise<CalAvailability[]> {
  const db = getPool();
  
  let scheduleId = eventScheduleId;
  
  // If no event-specific schedule, get user's default
  if (!scheduleId) {
    const scheduleResult = await db.query<{ id: number }>(
      `SELECT id FROM "Schedule" WHERE "userId" = $1 LIMIT 1`,
      [userId]
    );
    
    if (!scheduleResult.rows[0]) {
      return [];
    }
    
    scheduleId = scheduleResult.rows[0].id;
  }
  
  // Get availability entries (startTime/endTime are TIME columns, returned as strings)
  const availResult = await db.query<{
    days: number[];
    startTime: string;
    endTime: string;
  }>(
    `SELECT days, "startTime", "endTime" 
     FROM "Availability" 
     WHERE "scheduleId" = $1`,
    [scheduleId]
  );
  
  return availResult.rows;
}

/**
 * Get existing bookings for an event type within date range
 */
async function getBookings(
  eventTypeId: number,
  start: Date,
  end: Date
): Promise<CalBooking[]> {
  const db = getPool();
  const result = await db.query<CalBooking>(
    `SELECT "startTime", "endTime" 
     FROM "Booking" 
     WHERE "eventTypeId" = $1 
       AND "startTime" >= $2 
       AND "startTime" < $3
       AND status NOT IN ('cancelled', 'rejected')`,
    [eventTypeId, start, end]
  );
  return result.rows;
}

/**
 * Get date overrides for a schedule within date range
 * DateOverride allows therapists to block specific dates or modify availability for specific dates
 */
async function getDateOverrides(
  scheduleId: number,
  start: Date,
  end: Date
): Promise<CalDateOverride[]> {
  const db = getPool();
  const result = await db.query<{ date: Date; startTime: string | null; endTime: string | null }>(
    `SELECT date, "startTime"::text, "endTime"::text
     FROM "DateOverride"
     WHERE "scheduleId" = $1
       AND date >= $2::date
       AND date <= $3::date`,
    [scheduleId, start, end]
  );
  return result.rows;
}

/**
 * Parse TIME string 'HH:MM:SS' to hours and minutes
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Create a Date object for a specific time in a specific timezone
 * This correctly handles DST and timezone offsets
 */
function createDateInTimezone(
  year: number,
  month: number, // 0-indexed
  day: number,
  hours: number,
  minutes: number,
  timeZone: string
): Date {
  // Create a UTC date at midnight of the target day
  const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0)); // noon UTC to avoid DST edge cases
  
  // Format this UTC date in the target timezone to find the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(utcDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  // Get the timezone's representation of our UTC noon
  const tzHour = parseInt(getPart('hour'), 10);
  
  // Calculate offset: if UTC 12:00 shows as 13:00 in Berlin, offset is +1 hour
  // So Berlin is UTC+1, meaning we subtract 1 hour from local to get UTC
  const offsetHours = tzHour - 12;
  
  // Create the target time in UTC by subtracting the timezone offset
  // If we want 18:00 Berlin and Berlin is UTC+1, we need 17:00 UTC
  return new Date(Date.UTC(year, month, day, hours - offsetHours, minutes, 0));
}

/**
 * Generate available time slots from availability patterns
 * Respects date overrides which can block entire days or modify availability for specific dates
 */
function generateSlots(
  availability: CalAvailability[],
  bookings: CalBooking[],
  dateOverrides: CalDateOverride[],
  eventLength: number,
  slotInterval: number, // spacing between slots (may differ from eventLength)
  startDate: Date,
  endDate: Date,
  timeZone: string
): CalSlot[] {
  const slots: CalSlot[] = [];
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  
  // Build a map of date overrides for quick lookup (keyed by YYYY-MM-DD)
  const overrideMap = new Map<string, CalDateOverride>();
  for (const override of dateOverrides) {
    const dateKey = new Date(override.date).toISOString().split('T')[0];
    overrideMap.set(dateKey, override);
  }
  
  // Iterate through each day in range
  const current = new Date(startDate);
  while (current < endDate) {
    const dayOfWeek = current.getDay(); // 0=Sunday
    const year = current.getFullYear();
    const month = current.getMonth();
    const day = current.getDate();
    const dateKey = current.toISOString().split('T')[0];
    
    // Check for date override for this day
    const override = overrideMap.get(dateKey);
    
    // If override exists with null times, the day is completely blocked
    if (override && override.startTime === null) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    
    // Determine availability windows for this day
    // If override exists with specific times, use those; otherwise use regular availability
    let availabilityWindows: Array<{ startTime: string; endTime: string }> = [];
    
    if (override && override.startTime && override.endTime) {
      // Use override times for this specific date
      availabilityWindows = [{ startTime: override.startTime, endTime: override.endTime }];
    } else {
      // Use regular availability patterns for this day of week
      availabilityWindows = availability
        .filter(avail => avail.days.includes(dayOfWeek))
        .map(avail => ({ startTime: avail.startTime, endTime: avail.endTime }));
    }
    
    // Generate slots for each availability window
    for (const window of availabilityWindows) {
      // Parse time strings to get hours/minutes
      const startParsed = parseTimeString(window.startTime);
      const endParsed = parseTimeString(window.endTime);
      
      // Get start/end times for this day IN THE THERAPIST'S TIMEZONE
      // This is critical: availability times are stored in therapist's local time
      const dayStart = createDateInTimezone(year, month, day, startParsed.hours, startParsed.minutes, timeZone);
      const dayEnd = createDateInTimezone(year, month, day, endParsed.hours, endParsed.minutes, timeZone);
      
      // Generate slots at slotInterval spacing
      let slotStart = new Date(dayStart);
      while (slotStart.getTime() + eventLength * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + eventLength * 60 * 1000);
        
        // Skip if in the past
        if (slotStart < minBookingTime) {
          slotStart = new Date(slotStart.getTime() + slotInterval * 60 * 1000);
          continue;
        }
        
        // Check for booking conflicts
        const hasConflict = bookings.some(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          return slotStart < bookingEnd && slotEnd > bookingStart;
        });
        
        if (!hasConflict) {
          slots.push({
            date_iso: slotStart.toLocaleDateString('sv-SE', { timeZone }),
            time_label: slotStart.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone,
              hour12: false,
            }),
            time_utc: slotStart.toISOString(),
          });
        }
        
        slotStart = new Date(slotStart.getTime() + slotInterval * 60 * 1000);
      }
    }
    
    // Move to next day
    current.setDate(current.getDate() + 1);
  }
  
  return slots.sort((a, b) => a.time_utc.localeCompare(b.time_utc));
}

/**
 * Fetch available slots for a Cal.com user's event type
 */
export async function fetchCalSlotsFromDb(
  calUsername: string,
  eventSlug: string,
  start: string, // YYYY-MM-DD
  end: string, // YYYY-MM-DD
  timeZone: string = 'Europe/Berlin'
): Promise<CalSlot[] | null> {
  try {
    // Get Cal user
    const userId = await getCalUserId(calUsername);
    if (!userId) {
      console.warn(`[cal/slots-db] User not found: ${calUsername}`);
      return null;
    }
    
    // Get event type
    const eventType = await getEventTypeByUserId(userId, eventSlug);
    if (!eventType) {
      console.warn(`[cal/slots-db] Event type not found: ${eventSlug} for user ${calUsername}`);
      return null;
    }
    
    // Get the schedule ID (event-specific or user default)
    const db = getPool();
    let scheduleId = eventType.scheduleId;
    if (!scheduleId) {
      const scheduleResult = await db.query<{ id: number }>(
        `SELECT id FROM "Schedule" WHERE "userId" = $1 LIMIT 1`,
        [userId]
      );
      scheduleId = scheduleResult.rows[0]?.id ?? null;
    }
    
    // Get availability (use event-specific schedule if set)
    const availability = await getAvailability(userId, eventType.scheduleId);
    if (availability.length === 0) {
      console.warn(`[cal/slots-db] No availability for user ${calUsername} (scheduleId: ${eventType.scheduleId ?? 'default'})`);
      return [];
    }
    
    // Parse date range
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');
    
    // Get existing bookings
    const bookings = await getBookings(eventType.id, startDate, endDate);
    
    // Get date overrides (specific date availability exceptions)
    const dateOverrides = scheduleId ? await getDateOverrides(scheduleId, startDate, endDate) : [];
    
    // Generate available slots (use slotInterval for spacing, fallback to length)
    const slotInterval = eventType.slotInterval ?? eventType.length;
    const slots = generateSlots(
      availability,
      bookings,
      dateOverrides,
      eventType.length,
      slotInterval,
      startDate,
      endDate,
      timeZone
    );
    
    return slots;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error('[cal/slots-db] Error fetching slots:', {
      message: errMsg,
      stack: errStack,
      calUsername,
      eventSlug,
    });
    return null;
  }
}
