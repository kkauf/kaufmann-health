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
 *   GET /api/admin/leads/sms-cadence              (processes ALL stages)
 *   GET /api/admin/leads/sms-cadence?stage=day2   (single stage)
 *   GET /api/admin/leads/sms-cadence?stage=day5
 *   GET /api/admin/leads/sms-cadence?stage=day10
 * 
 * Cron: Single daily call processes all stages sequentially
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendTransactionalSms } from '@/lib/sms/client';
import { BASE_URL } from '@/lib/constants';
import { createShortLinkOrFallback } from '@/lib/short-links';
import { isCronAuthorized as isCronAuthorizedShared } from '@/lib/cron-auth';

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
  return isCronAuthorizedShared(req);
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

// Process a single stage and return counters
async function processStage(
  stage: Stage,
  limit: number,
  dryRun: boolean,
  ip: string,
  ua: string
): Promise<{
  stage: Stage;
  processed: number;
  sent: number;
  skipped: {
    no_matches: number;
    already_selected: number;
    already_sent: number;
    recent_sms: number;
    test: number;
  };
}> {
  const config = STAGE_CONFIG[stage];
  const fromIso = hoursAgo(config.maxHours);
  const toIso = hoursAgo(config.minHours);

  // Find phone-only patients with matches in the time window
  const { data: candidates, error: candidatesError } = await supabaseServer
    .from('people')
    .select(`id, name, phone_number, email, status, metadata`)
    .eq('type', 'patient')
    .not('phone_number', 'is', null)
    .in('status', ['new', 'email_confirmed'])
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .limit(limit * 2);

  if (candidatesError) {
    await logError('api.admin.leads.sms_cadence', candidatesError, { stage }, ip, ua);
    return { stage, processed: 0, sent: 0, skipped: { no_matches: 0, already_selected: 0, already_sent: 0, recent_sms: 0, test: 0 } };
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

    const meta = patient.metadata as Record<string, unknown> | null;
    if (meta?.is_test) {
      skippedTest++;
      continue;
    }

    const { data: matches } = await supabaseServer
      .from('matches')
      .select('id, secure_uuid, status')
      .eq('patient_id', patient.id)
      .limit(5);

    if (!matches || matches.length === 0) {
      skippedNoMatches++;
      continue;
    }

    const hasSelected = matches.some(m => m.status === 'patient_selected');
    if (hasSelected) {
      skippedAlreadySelected++;
      continue;
    }

    if (await alreadySentStage(patient.id, stage)) {
      skippedAlreadySent++;
      continue;
    }

    if (await sentRecentSms(patient.id, 24)) {
      skippedRecentSms++;
      continue;
    }

    const secureUuid = matches[0]?.secure_uuid;
    if (!secureUuid) {
      skippedNoMatches++;
      continue;
    }

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

  return {
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
  };
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
    const stageParam = url.searchParams.get('stage') as Stage | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 200);
    const dryRun = url.searchParams.get('dry') === 'true';

    // If no stage specified, process ALL stages sequentially
    const stagesToProcess: Stage[] = stageParam && STAGE_CONFIG[stageParam] 
      ? [stageParam] 
      : ['day2', 'day5', 'day10'];

    const results: Array<{
      stage: Stage;
      processed: number;
      sent: number;
      skipped: { no_matches: number; already_selected: number; already_sent: number; recent_sms: number; test: number };
    }> = [];

    for (const stage of stagesToProcess) {
      const result = await processStage(stage, limit, dryRun, ip, ua);
      results.push(result);
    }

    // Aggregate totals
    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.processed,
        sent: acc.sent + r.sent,
        skipped_no_matches: acc.skipped_no_matches + r.skipped.no_matches,
        skipped_already_selected: acc.skipped_already_selected + r.skipped.already_selected,
        skipped_already_sent: acc.skipped_already_sent + r.skipped.already_sent,
        skipped_recent_sms: acc.skipped_recent_sms + r.skipped.recent_sms,
        skipped_test: acc.skipped_test + r.skipped.test,
      }),
      { processed: 0, sent: 0, skipped_no_matches: 0, skipped_already_selected: 0, skipped_already_sent: 0, skipped_recent_sms: 0, skipped_test: 0 }
    );

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'api.admin.leads.sms_cadence',
      props: {
        stages: stagesToProcess,
        ...totals,
        dry_run: dryRun,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        stages: stagesToProcess,
        results,
        totals,
        dry_run: dryRun,
      },
      error: null,
    });
  } catch (e) {
    await logError('api.admin.leads.sms_cadence', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
