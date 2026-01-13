/**
 * Rebuild matches for patients affected by the Jan 11-13 matching bug.
 * 
 * Usage:
 *   npx tsx -r dotenv/config scripts/rebuild-affected-matches.ts [--dry-run]
 * 
 * This script uses the PRODUCTION matching algorithm from the codebase.
 * The `-r dotenv/config` preloads env vars before any module initialization.
 */

// Affected patients from the bug window (Jan 11 20:34 - Jan 13 16:45)
// Excludes those who already got matches later (Alaska, Julis, Angela)
const AFFECTED_PATIENTS = [
  { id: '98589ffb-6b7d-4992-8c3e-36b1d03aa39e', name: 'Enes', contact: 'phone' },
  { id: '7e2bfbd9-1ddf-4261-891a-5701ea352887', name: 'Kamy', contact: 'email' },
  { id: '78b9a2c7-b696-49f5-81e7-e22f3b621092', name: 'Cinzia Buemi', contact: 'email' },
  { id: '4ecbfc10-419c-4ef4-8fb4-317df7db09b2', name: 'Laura Teschner', contact: 'phone' },
  { id: '03e94443-f07c-4236-a0b1-bbab8c3eb8bb', name: 'Lucien', contact: 'email' },
  { id: '34fc6775-5f22-4d98-a421-c579b6d4e8ba', name: 'Hansi', contact: 'phone' },
  { id: '9948fcf2-14f8-47a7-b637-d4a51495c4a6', name: 'Ina', contact: 'email' },
];

import { createInstantMatchesForPatient } from '../src/features/leads/lib/match';
import { supabaseServer } from '../src/lib/supabase-server';

async function rebuildMatches(dryRun: boolean) {
  console.log(`\n=== Rebuild Affected Matches ${dryRun ? '(DRY RUN)' : ''} ===\n`);
  console.log('Using PRODUCTION matching algorithm from src/features/leads/lib/match.ts\n');
  
  const results: { patient: string; status: string; matchesUrl?: string; therapists?: string[]; quality?: string }[] = [];

  for (const patient of AFFECTED_PATIENTS) {
    console.log(`\nProcessing ${patient.name} (${patient.id})...`);

    // 1. Get patient metadata
    const { data: personData, error: personErr } = await supabaseServer
      .from('people')
      .select('metadata')
      .eq('id', patient.id)
      .single();

    if (personErr || !personData) {
      console.error(`  ❌ Failed to load patient: ${personErr?.message}`);
      results.push({ patient: patient.name, status: 'patient_not_found' });
      continue;
    }

    const meta = personData.metadata as Record<string, unknown> || {};
    console.log(`  Preferences: city=${meta.city}, gender=${meta.gender_preference}, schwerpunkte=${JSON.stringify(meta.schwerpunkte)}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would call createInstantMatchesForPatient()`);
      results.push({ patient: patient.name, status: 'dry_run' });
      continue;
    }

    // 2. Delete existing empty/incorrect match records
    const { error: deleteErr, count } = await supabaseServer
      .from('matches')
      .delete()
      .eq('patient_id', patient.id)
      .is('therapist_id', null);
    
    if (deleteErr) {
      console.error(`  ❌ Failed to delete empty matches: ${deleteErr.message}`);
    } else {
      console.log(`  Deleted ${count ?? 0} empty match record(s)`);
    }

    // 3. Call the PRODUCTION matching algorithm
    try {
      const matchResult = await createInstantMatchesForPatient(patient.id, undefined, meta);
      
      if (matchResult?.matchesUrl) {
        // Get the created matches to show therapist names
        const { data: matches } = await supabaseServer
          .from('matches')
          .select('therapist_id, therapists!inner(first_name)')
          .eq('patient_id', patient.id)
          .not('therapist_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(3);

        const therapistNames = ((matches || []) as unknown as { therapists: { first_name: string } }[])
          .map((m) => m.therapists?.first_name)
          .filter(Boolean) as string[];

        console.log(`  ✅ Created matches: ${therapistNames.join(', ') || 'none'}`);
        console.log(`  URL: ${matchResult.matchesUrl}`);
        console.log(`  Quality: ${matchResult.matchQuality}`);
        
        results.push({
          patient: patient.name,
          status: 'success',
          matchesUrl: matchResult.matchesUrl,
          therapists: therapistNames,
          quality: matchResult.matchQuality,
        });
      } else {
        console.log(`  ⚠️ No matches created`);
        results.push({ patient: patient.name, status: 'no_matches' });
      }
    } catch (e) {
      console.error(`  ❌ Matching failed: ${e instanceof Error ? e.message : e}`);
      results.push({ patient: patient.name, status: 'match_failed' });
    }
  }

  // Summary
  console.log('\n=== Summary ===\n');
  console.log('Patient           | Status       | Therapists');
  console.log('------------------|--------------|------------------');
  for (const r of results) {
    const therapists = r.therapists?.join(', ') || '-';
    console.log(`${r.patient.padEnd(17)} | ${r.status.padEnd(12)} | ${therapists}`);
  }

  // Output for email sending
  const successful = results.filter(r => r.status === 'success' && r.matchesUrl);
  if (successful.length > 0) {
    console.log('\n=== Patients to Email ===\n');
    for (const r of successful) {
      const patient = AFFECTED_PATIENTS.find(p => p.name === r.patient);
      console.log(`- ${r.patient} (${patient?.contact}): https://kaufmann-health.de${r.matchesUrl}`);
    }
  }

  return results;
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

rebuildMatches(dryRun)
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
