/**
 * Sync Cal.com bookings to Supabase cal_bookings table
 * Only syncs KH-originated bookings (those with kh_* metadata)
 * 
 * Run: npx tsx scripts/sync-cal-bookings.ts
 * Run with --dry-run to preview without inserting
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

interface CalBooking {
  id: number;
  uid: string;
  userId: number;
  username: string;
  startTime: Date;
  endTime: Date;
  status: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

interface TherapistMapping {
  cal_username: string;
  therapist_id: string;
}

async function syncBookings() {
  console.log(dryRun ? '=== DRY RUN MODE ===' : '=== SYNCING BOOKINGS ===');
  
  // Connect to Cal.com DB
  const calPool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const calClient = await calPool.connect();
  
  // Connect to Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get therapist mappings from Supabase
    const { data: therapists } = await supabase
      .from('therapists')
      .select('id, cal_username')
      .not('cal_username', 'is', null);
    
    const therapistMap = new Map<string, string>();
    for (const t of (therapists || [])) {
      if (t.cal_username) {
        therapistMap.set(t.cal_username, t.id);
      }
    }
    console.log(`Found ${therapistMap.size} therapists with cal_username`);
    
    // Get existing bookings from Supabase
    const { data: existingBookings } = await supabase
      .from('cal_bookings')
      .select('cal_uid');
    
    const existingUids = new Set((existingBookings || []).map(b => b.cal_uid));
    console.log(`Found ${existingUids.size} existing bookings in Supabase`);
    
    // Get recent Cal.com bookings with KH metadata
    const result = await calClient.query<CalBooking>(`
      SELECT 
        b.id,
        b.uid,
        b."userId",
        u.username,
        b."startTime",
        b."endTime",
        b.status,
        b."createdAt",
        b.metadata
      FROM "Booking" b
      LEFT JOIN users u ON u.id = b."userId"
      WHERE b."createdAt" > NOW() - INTERVAL '30 days'
      ORDER BY b."createdAt" DESC
    `);
    
    console.log(`Found ${result.rows.length} Cal.com bookings in last 30 days`);
    
    // Filter to KH bookings that aren't already synced
    const toSync: Array<{
      cal_uid: string;
      last_trigger_event: string;
      organizer_username: string;
      start_time: string;
      end_time: string;
      therapist_id: string | null;
      patient_id: string | null;
      booking_kind: string | null;
      source: string | null;
      status: string;
      is_test: boolean;
      metadata: Record<string, unknown>;
    }> = [];
    
    for (const booking of result.rows) {
      // Skip if already synced
      if (existingUids.has(booking.uid)) {
        continue;
      }
      
      const meta = booking.metadata || {};
      
      // Only sync KH-originated bookings (have kh_source or kh_booking_kind)
      const isKhBooking = 'kh_source' in meta || 'kh_booking_kind' in meta;
      if (!isKhBooking) {
        console.log(`  Skipping non-KH booking: ${booking.uid} (${booking.username})`);
        continue;
      }
      
      const therapistId = therapistMap.get(booking.username) || null;
      const patientId = typeof meta.kh_patient_id === 'string' ? meta.kh_patient_id : null;
      const bookingKind = typeof meta.kh_booking_kind === 'string' ? meta.kh_booking_kind : null;
      const source = typeof meta.kh_source === 'string' ? meta.kh_source : null;
      const isTest = meta.kh_test === true || meta.kh_test === 'true';
      
      toSync.push({
        cal_uid: booking.uid,
        last_trigger_event: 'BOOKING_CREATED', // Assume created since we're backfilling
        organizer_username: booking.username,
        start_time: booking.startTime.toISOString(),
        end_time: booking.endTime.toISOString(),
        therapist_id: therapistId,
        patient_id: patientId,
        booking_kind: bookingKind,
        source: source,
        status: booking.status,
        is_test: isTest,
        metadata: meta,
      });
    }
    
    console.log(`\nBookings to sync: ${toSync.length}`);
    
    if (toSync.length === 0) {
      console.log('Nothing to sync!');
      return;
    }
    
    // Show what we're syncing
    console.log('\n=== Bookings to sync ===');
    for (const b of toSync) {
      console.log(`  ${b.cal_uid}: ${b.organizer_username} | ${b.booking_kind} | patient=${b.patient_id ? 'yes' : 'no'} | test=${b.is_test}`);
    }
    
    if (dryRun) {
      console.log('\n[DRY RUN] Would insert the above bookings');
      return;
    }
    
    // Insert into Supabase
    console.log('\nInserting bookings...');
    const { data: inserted, error } = await supabase
      .from('cal_bookings')
      .upsert(toSync, { onConflict: 'cal_uid' })
      .select('cal_uid');
    
    if (error) {
      console.error('Insert error:', error);
      return;
    }
    
    console.log(`Successfully synced ${inserted?.length || 0} bookings`);
    
  } finally {
    calClient.release();
    await calPool.end();
  }
}

syncBookings().catch(console.error);
