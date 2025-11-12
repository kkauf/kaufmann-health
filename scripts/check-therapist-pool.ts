import { supabaseServer } from '../src/lib/supabase-server';

async function main() {
  type TR = { id: string; accepting_new?: boolean | null; metadata?: Record<string, unknown> | null };
  const { data: trows, error } = await supabaseServer
    .from('therapists')
    .select('id, accepting_new, metadata')
    .eq('status', 'verified')
    .limit(1000);
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  const therapists = Array.isArray(trows) ? (trows as TR[]) : [];
  const filtered = therapists.filter(t => {
    if (t.accepting_new === false) return false;
    const hide = ((t.metadata || {}) as any)['hide_from_directory'] === true;
    if (hide) return false;
    return true;
  });
  console.log('Verified therapists:', therapists.length);
  console.log('After filters (accepting_new!=false and not hidden):', filtered.length);
  console.log('IDs (first 10):', filtered.slice(0,10).map(t=>t.id));
}

main().catch(e => { console.error(e); process.exit(1); });
