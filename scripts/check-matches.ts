import { supabaseServer } from '../src/lib/supabase-server';

const uuid = process.argv[2];

if (!uuid) {
  console.error('Usage: tsx scripts/check-matches.ts <secure_uuid>');
  process.exit(1);
}

async function main() {
  const { data: matches, error } = await supabaseServer
    .from('matches')
    .select('id, patient_id, therapist_id, status, created_at')
    .eq('secure_uuid', uuid)
    .order('created_at');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${matches?.length || 0} matches for UUID ${uuid}:`);
  console.table(matches);

  if (matches && matches.length > 0) {
    const patientId = matches[0].patient_id;
    const { data: patient } = await supabaseServer
      .from('people')
      .select('email, metadata')
      .eq('id', patientId)
      .single();

    console.log('\nPatient preferences:');
    console.log('Email:', patient?.email);
    console.log('Metadata:', JSON.stringify(patient?.metadata, null, 2));
  }
}

main().catch(console.error);
