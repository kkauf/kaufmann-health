import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { BASE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED: Set<string> = new Set(['scheduling', 'cost', 'changed_mind', 'no_contact', 'other']);

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const url = new URL(req.url);
    const match_id = (url.searchParams.get('match') || url.searchParams.get('match_id') || '').trim();
    const reasonRaw = (url.searchParams.get('reason') || '').trim().toLowerCase();
    const reason = ALLOWED.has(reasonRaw) ? reasonRaw : '';

    if (!match_id || !reason) {
      // Always redirect to thank-you to avoid exposing internals
      return NextResponse.redirect(`${BASE_URL}/feedback-received?ok=1`);
    }

    // Persist blocker feedback (best-effort)
    try {
      await supabaseServer.from('session_blockers').insert({ match_id, reason }).select('id').limit(1).maybeSingle();
      void track({ type: 'session_blocker_received', level: 'info', source: 'api.feedback', props: { match_id, reason }, ip, ua });
    } catch (e) {
      await logError('api.feedback', e, { stage: 'insert', match_id, reason }, ip, ua);
    }

    // High-priority alert when therapist hasn't contacted the client
    if (reason === 'no_contact') {
      const to = process.env.LEADS_NOTIFY_EMAIL;
      if (to) {
        try {
          const subject = 'URGENT: Keine Kontaktaufnahme durch Therapeut:in gemeldet';
          const text = [
            'Ein:e Klient:in hat nach 7 Tagen angegeben, dass die/der Therapeut:in sich nicht gemeldet hat.',
            `Match-ID: ${match_id}`,
            '',
            'Bitte prüfen und kontaktieren Sie die/den Therapeut:in umgehend.',
          ].join('\n');
          await sendEmail({ to, subject, text, context: { kind: 'session_blocker_alert', match_id, reason } });
          void track({ type: 'internal_alert_sent', level: 'warn', source: 'api.feedback', props: { kind: 'no_contact', match_id }, ip, ua });
        } catch (e) {
          await logError('api.feedback', e, { stage: 'send_alert', match_id }, ip, ua);
        }
      }
    }

    return NextResponse.redirect(`${BASE_URL}/feedback-received?ok=1`);
  } catch (e) {
    await logError('api.feedback', e, { stage: 'exception' }, ip, ua);
    return NextResponse.redirect(`${BASE_URL}/feedback-received?ok=1`);
  }
}
