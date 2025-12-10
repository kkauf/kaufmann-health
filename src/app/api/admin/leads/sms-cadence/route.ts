/**
 * SMS Cadence for Phone-Only Patients
 * 
 * Sends follow-up SMS to patients who:
 * - Have phone_number but NO email (or temp placeholder)
 * - Have matches created
 * - Haven't selected a therapist yet
 * - Match the day window for this stage
 * - Haven't received this SMS stage yet
 * 
 * Usage:
 *   GET /api/admin/leads/sms-cadence?stage=day2
 *   GET /api/admin/leads/sms-cadence?stage=day5
 *   GET /api/admin/leads/sms-cadence?stage=day10
 * 
 * Cron: Configure in vercel.json (e.g., 10:00 daily for each stage)
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendTransactionalSms } from '@/lib/sms/client';
import { BASE_URL } from '@/lib/constants';
import { createShortLinkOrFallback } from '@/lib/short-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Stage = 'day2' | 'day5' | 'day10';

const STAGE_CONFIG: Record<Stage, { minHours: number; maxHours: number; smsTemplate: (url: string) => string }> = {
  day2: {
    minHours: 48,
    maxHours: 72,
    smsTemplate: (url) => 
      `Deine Therapeuten-Auswahl wartet: ${url} – Fragen? Antworte "Hilfe" für einen Rückruf.`,
  },
  day5: {
    minHours: 120,
    maxHours: 144,
    smsTemplate: (url) =>
      `Noch unsicher? Wir helfen bei der Auswahl. Antworte "Hilfe" und wir rufen dich an. ${url}`,
  },
  day10: {
    minHours: 240,
    maxHours: 264,
    smsTemplate: () =>
      `Kurze Frage: Was hält dich zurück? (Auswahl/Preis/Timing?) Antworte kurz – wir lesen alles persönlich.`,
  },
};

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
    return token ? await verifySessionToken(token) : false;
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  
  const cronHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  if (cronHeader === cronSecret) return true;
  
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) return true;
  
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (token === cronSecret) return true;
  } catch {}
  
  return false;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// Check if we already sent this stage to this patient
async function alreadySentStage(patientId: string, stage: Stage): Promise<boolean> {
  try {
    const { data } = await supabaseServer
      .from('events')
      .select('id')
      .eq('type', 'sms_sent')
      .gte('created_at', hoursAgo(24 * 30)) // Look back 30 days
      .limit(500);
    
    if (!data) return false;
    
    // Check properties for matching patient_id and stage
    for (const event of data) {
      const props = (event as { properties?: Record<string, unknown> }).properties;
      if (props?.patient_id === patientId && 
          props?.kind === 'sms_cadence' && 
          props?.stage === stage) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Check if any SMS was sent to this patient recently (prevent spam)
async function sentRecentSms(patientId: string, hours = 24): Promise<boolean> {
  try {
    const { data } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'sms_sent')
      .gte('created_at', hoursAgo(hours))
      .limit(200);
    
    if (!data) return false;
    
    for (const event of data) {
      const props = (event as { properties?: Record<string, unknown> }).properties;
      if (props?.patient_id === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || '';
  const startedAt = Date.now();

  try {
    const isAdmin = await assertAdmin(req);
    const isCron = isCronAuthorized(req);
    
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const stage = url.searchParams.get('stage') as Stage | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
    const dryRun = url.searchParams.get('dry') === 'true';

    if (!stage || !STAGE_CONFIG[stage]) {
      return NextResponse.json({ 
        data: null, 
        error: 'Invalid stage. Use: day2, day5, day10' 
      }, { status: 400 });
    }

    const config = STAGE_CONFIG[stage];
    const fromIso = hoursAgo(config.maxHours);
    const toIso = hoursAgo(config.minHours);

    // Find phone-only patients with matches in the time window
    // Phone-only = has phone_number AND (no email OR temp email)
    const { data: candidates, error: candidatesError } = await supabaseServer
      .from('people')
      .select(`
        id,
        name,
        phone_number,
        email,
        status,
        metadata
      `)
      .eq('type', 'patient')
      .not('phone_number', 'is', null)
      .in('status', ['new', 'email_confirmed'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .limit(limit * 2); // Fetch extra to account for filtering

    if (candidatesError) {
      await logError('api.admin.leads.sms_cadence', candidatesError, { stage }, ip, ua);
      return NextResponse.json({ data: null, error: 'Database error' }, { status: 500 });
    }

    // Filter to phone-only (no email or temp email)
    const phoneOnly = (candidates || []).filter(p => {
      const email = p.email?.trim() || '';
      const isTemp = email.startsWith('temp_') && email.endsWith('@kaufmann.health');
      return p.phone_number && (!email || isTemp);
    });

    let processed = 0;
    let sent = 0;
    let skippedNoMatches = 0;
    let skippedAlreadySelected = 0;
    let skippedAlreadySent = 0;
    let skippedRecentSms = 0;
    let skippedTest = 0;

    for (const patient of phoneOnly.slice(0, limit)) {
      processed++;

      // Skip test users
      const meta = patient.metadata as Record<string, unknown> | null;
      if (meta?.is_test) {
        skippedTest++;
        continue;
      }

      // Check if patient has matches
      const { data: matches } = await supabaseServer
        .from('matches')
        .select('id, secure_uuid, status')
        .eq('patient_id', patient.id)
        .limit(5);

      if (!matches || matches.length === 0) {
        skippedNoMatches++;
        continue;
      }

      // Check if already selected
      const hasSelected = matches.some(m => m.status === 'patient_selected');
      if (hasSelected) {
        skippedAlreadySelected++;
        continue;
      }

      // Check if already sent this stage
      if (await alreadySentStage(patient.id, stage)) {
        skippedAlreadySent++;
        continue;
      }

      // Check if sent any SMS recently (24h spam prevention)
      if (await sentRecentSms(patient.id, 24)) {
        skippedRecentSms++;
        continue;
      }

      // Get secure_uuid for matches URL
      const secureUuid = matches[0]?.secure_uuid;
      if (!secureUuid) {
        skippedNoMatches++;
        continue;
      }

      // Create short link for cleaner SMS
      // ?direct=1 skips loading animation on the matches page
      const fullMatchesUrl = `${BASE_URL}/matches/${secureUuid}?direct=1`;
      const matchesUrl = await createShortLinkOrFallback({
        targetUrl: fullMatchesUrl,
        utmSource: 'sms',
        utmMedium: 'transactional',
        utmCampaign: `sms_cadence_${stage}`,
        patientId: patient.id,
      });
      const smsBody = config.smsTemplate(matchesUrl);

      if (dryRun) {
        console.log(`[sms-cadence] DRY RUN: Would send to ${patient.phone_number}: ${smsBody}`);
        sent++;
        continue;
      }

      // Send SMS
      void track({
        type: 'sms_attempted',
        level: 'info',
        source: 'api.admin.leads.sms_cadence',
        props: { kind: 'sms_cadence', stage, patient_id: patient.id },
      });

      const ok = await sendTransactionalSms(patient.phone_number!, smsBody);
      
      if (ok) {
        void track({
          type: 'sms_sent',
          level: 'info',
          source: 'api.admin.leads.sms_cadence',
          props: { kind: 'sms_cadence', stage, patient_id: patient.id },
        });
        sent++;
      } else {
        await logError('api.admin.leads.sms_cadence', new Error('SMS send failed'), {
          stage,
          patient_id: patient.id,
        }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'api.admin.leads.sms_cadence',
      props: {
        stage,
        processed,
        sent,
        skipped_no_matches: skippedNoMatches,
        skipped_already_selected: skippedAlreadySelected,
        skipped_already_sent: skippedAlreadySent,
        skipped_recent_sms: skippedRecentSms,
        skipped_test: skippedTest,
        dry_run: dryRun,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        stage,
        processed,
        sent,
        skipped: {
          no_matches: skippedNoMatches,
          already_selected: skippedAlreadySelected,
          already_sent: skippedAlreadySent,
          recent_sms: skippedRecentSms,
          test: skippedTest,
        },
        dry_run: dryRun,
      },
      error: null,
    });
  } catch (e) {
    await logError('api.admin.leads.sms_cadence', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
