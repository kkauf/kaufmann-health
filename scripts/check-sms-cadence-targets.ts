#!/usr/bin/env npx tsx
/**
 * Check which phone-only patients will receive SMS cadence reminders
 * Usage: npx tsx scripts/check-sms-cadence-targets.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env
config({ path: resolve(process.cwd(), '.env.local') });
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Get phone-only patients in status "new"
  const { data: patients, error } = await supabase
    .from('people')
    .select('id, name, phone_number, email, status, created_at')
    .eq('type', 'patient')
    .eq('status', 'new')
    .not('phone_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Query error:', error);
    process.exit(1);
  }

  // Filter to phone-only (no email or temp email)
  const phoneOnly = (patients || []).filter(p => {
    const email = p.email?.trim() || '';
    const isTemp = email.startsWith('temp_') && email.endsWith('@kaufmann.health');
    return !email || isTemp;
  });

  console.log(`\n📱 Phone-only patients in status "new": ${phoneOnly.length}\n`);

  for (const p of phoneOnly) {
    const createdAt = new Date(p.created_at);
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    
    let stage = 'outside_windows';
    if (hoursOld >= 48 && hoursOld < 72) stage = 'day2';
    else if (hoursOld >= 120 && hoursOld < 144) stage = 'day5';
    else if (hoursOld >= 240 && hoursOld < 264) stage = 'day10';

    // Get matches
    const { data: matches } = await supabase
      .from('matches')
      .select('id, status, secure_uuid')
      .eq('patient_id', p.id);

    const matchCount = matches?.length || 0;
    const hasSelected = matches?.some(m => m.status === 'patient_selected');
    const secureUuid = matches?.[0]?.secure_uuid;

    console.log(`─────────────────────────────────────`);
    console.log(`Name: ${p.name || 'Unknown'}`);
    console.log(`Phone: ***${p.phone_number?.slice(-6) || 'N/A'}`);
    console.log(`Created: ${createdAt.toISOString()} (${hoursOld.toFixed(1)}h ago)`);
    console.log(`Matches: ${matchCount}, Selected: ${hasSelected ? 'YES' : 'no'}`);
    console.log(`SMS Stage: ${stage}`);
    
    if (stage !== 'outside_windows' && matchCount > 0 && !hasSelected) {
      console.log(`✅ WILL RECEIVE ${stage.toUpperCase()} SMS`);
      if (secureUuid) {
        console.log(`   URL: https://www.kaufmann-health.de/matches/${secureUuid}`);
      }
    } else if (stage === 'outside_windows') {
      console.log(`⏭️  Outside time windows (${hoursOld.toFixed(0)}h old)`);
    } else if (matchCount === 0) {
      console.log(`⏭️  No matches yet`);
    } else if (hasSelected) {
      console.log(`⏭️  Already selected`);
    }
    console.log('');
  }

  // Summary
  const willReceive = phoneOnly.filter(p => {
    const hoursOld = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
    return (hoursOld >= 48 && hoursOld < 72) || 
           (hoursOld >= 120 && hoursOld < 144) || 
           (hoursOld >= 240 && hoursOld < 264);
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total phone-only (status=new): ${phoneOnly.length}`);
  console.log(`   In SMS windows: ${willReceive.length}`);
}

main().catch(console.error);
