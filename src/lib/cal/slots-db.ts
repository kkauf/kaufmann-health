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
      connectionTimeoutMillis: 10000, // 10s timeout for serverless
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
  userId: number;
}

interface CalAvailability {
  days: number[]; // 0=Sunday, 1=Monday, etc.
  startTime: Date;
  endTime: Date;
}

interface CalBooking {
  startTime: Date;
  endTime: Date;
}

export interface CalSlot {
  date_iso: string; // YYYY-MM-DD
  time_label: string; // HH:MM
  time_utc: string; // ISO datetime
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
 * Get event type by user and slug
 */
async function getEventType(userId: number, slug: string): Promise<CalEventType | null> {
  const db = getPool();
  const result = await db.query<CalEventType>(
    `SELECT id, slug, title, length, "userId" 
     FROM "EventType" 
     WHERE "userId" = $1 AND slug = $2 
     LIMIT 1`,
    [userId, slug]
  );
  return result.rows[0] || null;
}

/**
 * Get user's default schedule availability
 */
async function getAvailability(userId: number): Promise<CalAvailability[]> {
  const db = getPool();
  
  // Get default schedule for user
  const scheduleResult = await db.query<{ id: number }>(
    `SELECT id FROM "Schedule" WHERE "userId" = $1 LIMIT 1`,
    [userId]
  );
  
  if (!scheduleResult.rows[0]) {
    return [];
  }
  
  const scheduleId = scheduleResult.rows[0].id;
  
  // Get availability entries
  const availResult = await db.query<{
    days: number[];
    startTime: Date;
    endTime: Date;
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
 * Generate available time slots from availability patterns
 */
function generateSlots(
  availability: CalAvailability[],
  bookings: CalBooking[],
  eventLength: number,
  startDate: Date,
  endDate: Date,
  timeZone: string
): CalSlot[] {
  const slots: CalSlot[] = [];
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  
  // Iterate through each day in range
  const current = new Date(startDate);
  while (current < endDate) {
    const dayOfWeek = current.getDay(); // 0=Sunday
    
    // Find availability for this day
    for (const avail of availability) {
      if (!avail.days.includes(dayOfWeek)) continue;
      
      // Get start/end times for this day
      const dayStart = new Date(current);
      dayStart.setHours(
        avail.startTime.getUTCHours(),
        avail.startTime.getUTCMinutes(),
        0,
        0
      );
      
      const dayEnd = new Date(current);
      dayEnd.setHours(
        avail.endTime.getUTCHours(),
        avail.endTime.getUTCMinutes(),
        0,
        0
      );
      
      // Generate slots at event length intervals
      let slotStart = new Date(dayStart);
      while (slotStart.getTime() + eventLength * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + eventLength * 60 * 1000);
        
        // Skip if in the past
        if (slotStart < minBookingTime) {
          slotStart = new Date(slotStart.getTime() + eventLength * 60 * 1000);
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
        
        slotStart = new Date(slotStart.getTime() + eventLength * 60 * 1000);
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
    const eventType = await getEventType(userId, eventSlug);
    if (!eventType) {
      console.warn(`[cal/slots-db] Event type not found: ${eventSlug} for user ${calUsername}`);
      return null;
    }
    
    // Get availability
    const availability = await getAvailability(userId);
    if (availability.length === 0) {
      console.warn(`[cal/slots-db] No availability for user ${calUsername}`);
      return [];
    }
    
    // Parse date range
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');
    
    // Get existing bookings
    const bookings = await getBookings(eventType.id, startDate, endDate);
    
    // Generate available slots
    const slots = generateSlots(
      availability,
      bookings,
      eventType.length,
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
