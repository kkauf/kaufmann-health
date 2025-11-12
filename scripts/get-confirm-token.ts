import { supabaseServer } from '../src/lib/supabase-server';

const email = process.argv[2];
if (!email) {
  console.error('Usage: tsx scripts/get-confirm-token.ts <email>');
  process.exit(1);
}

async function main() {
  const { data, error } = await supabaseServer
    .from('people')
    .select('id, metadata')
    .eq('email', email)
    .limit(1);
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  const row = Array.isArray(data) ? (data[0] as any) : null;
  if (!row) {
    console.log(JSON.stringify({ ok: false, reason: 'not_found' }));
    return;
  }
  const md = (row.metadata || {}) as Record<string, any>;
  console.log(JSON.stringify({ ok: true, id: row.id, token: md.confirm_token || null, redirect: md.last_confirm_redirect_path || null }));
}

main().catch((e) => { console.error(e); process.exit(1); });
