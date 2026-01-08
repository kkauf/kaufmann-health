/**
 * Sync therapist practice address to Cal.com
 * 
 * When a therapist updates their practice address in the KH portal,
 * we sync it to their Cal.com full-session event type.
 */

import { Pool } from 'pg';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

export interface SyncAddressResult {
  success: boolean;
  error?: string;
}

/**
 * Sync practice address to Cal.com for a therapist's full-session event type.
 * 
 * - If address is provided and therapist offers in-person: adds/updates in-person location
 * - If address is empty/null: removes in-person location (video only)
 * 
 * @param calUsername - The therapist's Cal.com username
 * @param practiceAddress - Full practice address string, or null/empty to remove
 * @param offersInPerson - Whether therapist offers in-person sessions
 */
export async function syncPracticeAddressToCal(
  calUsername: string | null | undefined,
  practiceAddress: string | null | undefined,
  offersInPerson: boolean
): Promise<SyncAddressResult> {
  if (!CAL_DATABASE_URL || !calUsername) {
    return { success: true }; // No Cal.com setup, nothing to sync
  }

  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    const client = await pool.connect();
    
    try {
      // Get the full-session event type for this user
      const { rows } = await client.query(`
        SELECT e.id, e.locations
        FROM "EventType" e
        JOIN users u ON e."userId" = u.id
        WHERE u.username = $1 AND e.slug = 'full-session'
      `, [calUsername]);

      if (rows.length === 0) {
        // No full-session event type yet - will be created when provisioned
        return { success: true };
      }

      const eventType = rows[0];
      const currentLocations = eventType.locations || [];
      
      // Remove any existing in-person location
      const locationsWithoutInPerson = currentLocations.filter(
        (l: { type: string }) => l.type !== 'inPerson'
      );

      // Determine if we should add in-person location
      const shouldHaveInPerson = offersInPerson && practiceAddress && practiceAddress.trim().length > 0;
      // Validate address is complete (has numbers = has street number)
      const isCompleteAddress = shouldHaveInPerson && /\d/.test(practiceAddress);

      let newLocations = locationsWithoutInPerson;
      
      if (isCompleteAddress) {
        newLocations = [
          ...locationsWithoutInPerson,
          { type: 'inPerson', address: practiceAddress.trim() }
        ];
      }

      // Only update if locations changed
      const locationsChanged = JSON.stringify(currentLocations) !== JSON.stringify(newLocations);
      
      if (locationsChanged) {
        await client.query(
          'UPDATE "EventType" SET locations = $1 WHERE id = $2',
          [JSON.stringify(newLocations), eventType.id]
        );
        console.log(`[syncPracticeAddressToCal] Updated ${calUsername}: ${isCompleteAddress ? practiceAddress : 'video only'}`);
      }

      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[syncPracticeAddressToCal] Failed for ${calUsername}:`, message);
    return { success: false, error: message };
  } finally {
    await pool.end();
  }
}
