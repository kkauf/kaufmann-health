/**
 * Rebuild matches for patients affected by the Jan 11-13 matching bug.
 * 
 * Uses the SAME scoring logic as production but with its own Supabase client
 * to avoid ESM import hoisting issues.
 * 
 * Usage: npx tsx scripts/rebuild-affected-matches-v2.ts [--dry-run]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test therapist to exclude (Konstantin)
const HIDE_THERAPIST_ID = 'e5de1fb4-90c6-4681-aa23-b4e84e7defa8';

const AFFECTED_PATIENTS = [
  { id: '98589ffb-6b7d-4992-8c3e-36b1d03aa39e', name: 'Enes', contact: 'phone' },
  { id: '7e2bfbd9-1ddf-4261-891a-5701ea352887', name: 'Kamy', contact: 'email' },
  { id: '78b9a2c7-b696-49f5-81e7-e22f3b621092', name: 'Cinzia Buemi', contact: 'email' },
  { id: '4ecbfc10-419c-4ef4-8fb4-317df7db09b2', name: 'Laura Teschner', contact: 'phone' },
  { id: '03e94443-f07c-4236-a0b1-bbab8c3eb8bb', name: 'Lucien', contact: 'email' },
  { id: '34fc6775-5f22-4d98-a421-c579b6d4e8ba', name: 'Hansi', contact: 'phone' },
  { id: '9948fcf2-14f8-47a7-b637-d4a51495c4a6', name: 'Ina', contact: 'email' },
];

type Therapist = {
  id: string;
  first_name: string;
  gender: string | null;
  city: string | null;
  session_preferences: string[] | null;
  accepting_new: boolean | null;
  cal_bookings_live: boolean | null;
  schwerpunkte: string[] | null;
  photo_url: string | null;
  metadata?: { profile?: { approach_text?: string; who_comes_to_me?: string } } | null;
};

type PatientMeta = {
  city?: string;
  gender_preference?: string;
  session_preference?: string;
  session_preferences?: string[];
  schwerpunkte?: string[];
};

/**
 * Production eligibility filter (from match.ts isEligible)
 */
function isEligible(t: Therapist, meta: PatientMeta): boolean {
  // Must be accepting new patients
  if (t.accepting_new === false) return false;
  
  // Gender filter
  const gp = meta.gender_preference;
  if (gp && gp !== 'any' && gp !== 'no_preference') {
    const tGender = (t.gender || '').toLowerCase();
    if (tGender && tGender !== gp) return false;
  }
  
  // Session format filter (only if patient wants EXCLUSIVELY one format)
  const sp = meta.session_preference;
  const sps = meta.session_preferences;
  if (sp && !sps) {
    const tPrefs = t.session_preferences || [];
    if (!tPrefs.includes(sp)) return false;
  }
  
  return true;
}

/**
 * Production scoring logic (from match.ts calculateMatchScore + calculatePlatformScore)
 */
function scoreTherapist(t: Therapist, meta: PatientMeta): number {
  let score = 0;
  
  // Platform Score (max 70)
  if (t.cal_bookings_live) score += 30;
  const hasApproach = Boolean(t.metadata?.profile?.approach_text);
  const hasWhoComes = Boolean(t.metadata?.profile?.who_comes_to_me);
  if (t.photo_url && hasApproach && hasWhoComes) score += 15;
  else if (t.photo_url && t.city) score += 5;
  
  // Match Score - Schwerpunkte overlap (max 40)
  const patientSchwer = meta.schwerpunkte || [];
  const therapistSchwer = t.schwerpunkte || [];
  if (patientSchwer.length > 0) {
    const patientSet = new Set(patientSchwer);
    const overlap = therapistSchwer.filter(s => patientSet.has(s)).length;
    const overlapRatio = overlap / patientSchwer.length;
    score += Math.round(overlapRatio * 40);
  }
  
  // Match Score - Session format (max 20)
  const sp = meta.session_preference;
  const tPrefs = t.session_preferences || [];
  if (sp && tPrefs.includes(sp)) score += 20;
  else if (!sp) score += 10; // No preference = partial match
  
  return score;
}

async function rebuildMatches(dryRun: boolean) {
  console.log(`\n=== Rebuild Matches ${dryRun ? '(DRY RUN)' : ''} ===`);
  console.log('Using production scoring logic\n');
  
  // Load therapists
  const { data: allTherapists, error: tErr } = await supabase
    .from('therapists')
    .select('id, first_name, gender, city, session_preferences, accepting_new, cal_bookings_live, schwerpunkte, photo_url, metadata')
    .eq('status', 'verified')
    .neq('id', HIDE_THERAPIST_ID);
  
  if (tErr || !allTherapists) {
    console.error('Failed to load therapists:', tErr?.message);
    process.exit(1);
  }
  
  console.log(`Loaded ${allTherapists.length} verified therapists\n`);
  
  const results: { patient: string; status: string; url?: string; therapists?: string[] }[] = [];

  for (const patient of AFFECTED_PATIENTS) {
    console.log(`Processing ${patient.name}...`);

    // Get patient metadata
    const { data: personData } = await supabase
      .from('people')
      .select('metadata')
      .eq('id', patient.id)
      .single();

    const meta = (personData?.metadata || {}) as PatientMeta;
    console.log(`  Gender: ${meta.gender_preference || 'any'}, Schwerpunkte: ${JSON.stringify(meta.schwerpunkte || [])}`);

    // Filter eligible therapists
    const eligible = (allTherapists as Therapist[]).filter(t => isEligible(t, meta));
    console.log(`  Eligible: ${eligible.length}/${allTherapists.length}`);

    // Score and sort
    const scored = eligible.map(t => ({ t, score: scoreTherapist(t, meta) }));
    scored.sort((a, b) => b.score - a.score);
    
    // Take top 3
    const top3 = scored.slice(0, 3);
    
    if (top3.length === 0) {
      console.log(`  ⚠️ No eligible therapists`);
      results.push({ patient: patient.name, status: 'no_matches' });
      continue;
    }

    console.log(`  Top matches: ${top3.map(x => `${x.t.first_name}(${x.score})`).join(', ')}`);

    if (dryRun) {
      results.push({ patient: patient.name, status: 'dry_run', therapists: top3.map(x => x.t.first_name) });
      continue;
    }

    // Delete existing empty/no-match records
    await supabase
      .from('matches')
      .delete()
      .eq('patient_id', patient.id)
      .is('therapist_id', null);

    // Create matches
    let secureUuid: string | null = null;
    const names: string[] = [];
    
    for (let i = 0; i < top3.length; i++) {
      const { t, score } = top3[i];
      const isPerfect = score >= 60; // High score = perfect match
      
      const { data: row, error: insertErr } = await supabase
        .from('matches')
        .insert({
          patient_id: patient.id,
          therapist_id: t.id,
          status: 'proposed',
          metadata: { 
            match_quality: isPerfect ? 'exact' : 'partial',
            match_score: score,
            rebuilt_at: new Date().toISOString()
          }
        })
        .select('secure_uuid')
        .single();
      
      if (insertErr) {
        console.error(`  Failed to insert match for ${t.first_name}: ${insertErr.message}`);
        continue;
      }
      
      if (i === 0 && row) secureUuid = row.secure_uuid;
      names.push(t.first_name);
    }
    
    if (secureUuid) {
      const url = `https://kaufmann-health.de/matches/${secureUuid}`;
      console.log(`  ✅ Created: ${names.join(', ')}`);
      console.log(`  URL: ${url}`);
      results.push({ patient: patient.name, status: 'success', url, therapists: names });
    } else {
      results.push({ patient: patient.name, status: 'insert_failed' });
    }
  }

  // Summary
  console.log('\n=== Summary ===\n');
  for (const r of results) {
    const therapists = r.therapists?.join(', ') || '-';
    console.log(`${r.patient.padEnd(17)} | ${r.status.padEnd(12)} | ${therapists}`);
  }

  // Email list
  const success = results.filter(r => r.status === 'success' && r.url);
  if (success.length > 0) {
    console.log('\n=== To Email/SMS ===\n');
    for (const r of success) {
      const p = AFFECTED_PATIENTS.find(x => x.name === r.patient);
      console.log(`- ${r.patient} (${p?.contact}): ${r.url}`);
    }
  }
}

// Main
const dryRun = process.argv.includes('--dry-run');
rebuildMatches(dryRun).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
