/**
 * Send apology notifications to affected patients via the production admin API.
 * 
 * This script calls POST /api/admin/matches/email with template: 'apology'
 * which uses proper email templates with logo, branding, and SMS fallback.
 * 
 * Usage:
 *   npx tsx scripts/send-apology-via-api.ts [--dry-run] [--local]
 * 
 * Options:
 *   --dry-run  Preview what would be sent without actually sending
 *   --local    Use localhost:3000 instead of production URL
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PRODUCTION_URL = 'https://kaufmann-health.de';
const LOCAL_URL = 'http://localhost:3000';

// Affected patients from the Jan 11-13 matching bug
const AFFECTED_PATIENTS = [
  { id: '98589ffb-6b7d-4992-8c3e-36b1d03aa39e', name: 'Enes' },
  { id: '7e2bfbd9-1ddf-4261-891a-5701ea352887', name: 'Kamy' },
  { id: '78b9a2c7-b696-49f5-81e7-e22f3b621092', name: 'Cinzia Buemi' },
  { id: '4ecbfc10-419c-4ef4-8fb4-317df7db09b2', name: 'Laura Teschner' },
  { id: '03e94443-f07c-4236-a0b1-bbab8c3eb8bb', name: 'Lucien' },
  { id: '34fc6775-5f22-4d98-a421-c579b6d4e8ba', name: 'Hansi' },
  { id: '9948fcf2-14f8-47a7-b637-d4a51495c4a6', name: 'Ina' },
];

async function getAdminCookie(baseUrl: string): Promise<string | null> {
  if (!ADMIN_PASSWORD) {
    console.error('Missing ADMIN_PASSWORD env var');
    return null;
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });

    if (!res.ok) {
      console.error('Admin login failed:', await res.text());
      return null;
    }

    // Extract cookie from Set-Cookie header
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      console.error('No Set-Cookie header in login response');
      return null;
    }

    // Parse the kh_admin cookie
    const match = setCookie.match(/kh_admin=([^;]+)/);
    return match ? `kh_admin=${match[1]}` : null;
  } catch (e) {
    console.error('Login error:', e);
    return null;
  }
}

async function sendApologyNotification(
  baseUrl: string,
  cookie: string,
  patientId: string,
  patientName: string,
  dryRun: boolean
): Promise<{ ok: boolean; via?: string; error?: string }> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would send apology to ${patientName}`);
    return { ok: true, via: 'dry_run' };
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/matches/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify({
        template: 'apology',
        patient_id: patientId,
      }),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }

    return { ok: true, via: json.data?.via || 'email' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const useLocal = args.includes('--local');
  const baseUrl = useLocal ? LOCAL_URL : PRODUCTION_URL;

  console.log(`\n=== Send Apology Notifications ${dryRun ? '(DRY RUN)' : ''} ===`);
  console.log(`Target: ${baseUrl}\n`);

  // Get admin cookie
  const cookie = await getAdminCookie(baseUrl);
  if (!cookie) {
    console.error('Failed to authenticate as admin');
    process.exit(1);
  }
  console.log('✅ Admin authenticated\n');

  const results: { name: string; status: string; via?: string }[] = [];

  for (const patient of AFFECTED_PATIENTS) {
    console.log(`Processing ${patient.name}...`);

    const result = await sendApologyNotification(
      baseUrl,
      cookie,
      patient.id,
      patient.name,
      dryRun
    );

    if (result.ok) {
      console.log(`  ✅ Sent via ${result.via}`);
      results.push({ name: patient.name, status: 'sent', via: result.via });
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      results.push({ name: patient.name, status: 'failed' });
    }
  }

  // Summary
  console.log('\n=== Summary ===\n');
  for (const r of results) {
    console.log(`${r.name.padEnd(17)} | ${r.status.padEnd(8)} | ${r.via || '-'}`);
  }

  const sent = results.filter(r => r.status === 'sent').length;
  console.log(`\nTotal: ${sent}/${results.length} sent successfully`);
}

main().catch(e => { console.error(e); process.exit(1); });
