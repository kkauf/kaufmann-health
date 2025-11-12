import { supabaseServer } from '../src/lib/supabase-server';

async function main() {
  const therapistId = process.argv[2];
  const dateIso = process.argv[3];
  const timeLabel = process.argv[4];
  if (!therapistId || !dateIso || !timeLabel) {
    console.error('Usage: tsx scripts/check-booking.ts <therapist_id> <YYYY-MM-DD> <HH:MM>');
    process.exit(1);
  }
  const { data, error } = await supabaseServer
    .from('bookings')
    .select('id, patient_id, therapist_id, date_iso, time_label, format, created_at')
    .eq('therapist_id', therapistId)
    .eq('date_iso', dateIso)
    .eq('time_label', timeLabel)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log(JSON.stringify({ count: (data||[]).length, rows: data }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
