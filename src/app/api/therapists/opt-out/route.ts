import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { verifyTherapistOptOutToken } from '@/lib/signed-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function html(body: string) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Kaufmann Health</title><style>body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5;padding:24px;color:#111827}.card{max-width:560px;margin:40px auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}h1{font-size:20px;margin:0 0 12px}p{margin:0 0 10px;color:#374151}a{color:#2563eb}</style></head><body><div class="card">${body}</div></body></html>`;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token) {
      return new NextResponse(html('<h1>Ungültiger Link</h1><p>Es fehlt ein Token.</p>'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const res = await verifyTherapistOptOutToken(token);
    if (!res.ok || !res.therapistId) {
      void track({ type: 'therapist_reminders_optout_failed', level: 'warn', source: 'api.therapists.optout', props: { reason: res.reason } });
      return new NextResponse(html('<h1>Link abgelaufen oder ungültig</h1><p>Bitte öffne den neuesten Opt‑Out‑Link oder kontaktiere uns.</p>'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const tid = res.therapistId;
    const { data: t, error } = await supabaseServer
      .from('therapists')
      .select('id, metadata')
      .eq('id', tid)
      .single();
    if (error || !t) {
      await logError('api.therapists.optout', error, { stage: 'fetch', therapist_id: tid }, ip, ua);
      return new NextResponse(html('<h1>Fehler</h1><p>Wir konnten deine Anfrage nicht verarbeiten. Bitte versuche es später erneut.</p>'), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const meta = (t as { metadata?: unknown }).metadata;
    const base = (meta && typeof meta === 'object') ? (meta as Record<string, unknown>) : {};
    const notifications = (base.notifications && typeof base.notifications === 'object') ? (base.notifications as Record<string, unknown>) : {};
    const nextMeta = { ...base, notifications: { ...notifications, reminders_opt_out: true } };

    const { error: upErr } = await supabaseServer
      .from('therapists')
      .update({ metadata: nextMeta })
      .eq('id', tid);
    if (upErr) {
      await logError('api.therapists.optout', upErr, { stage: 'update', therapist_id: tid }, ip, ua);
      return new NextResponse(html('<h1>Fehler</h1><p>Wir konnten deine Einstellungen nicht speichern. Bitte versuche es später erneut.</p>'), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    void track({ type: 'therapist_reminders_opted_out', level: 'info', source: 'api.therapists.optout', props: { therapist_id: tid } });
    return new NextResponse(html('<h1>Erinnerungen pausiert</h1><p>Du erhältst keine weiteren Profil‑Erinnerungs‑E-Mails mehr. Du kannst dein Profil jederzeit in Ruhe vervollständigen.</p>'), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    await logError('api.therapists.optout', e, { stage: 'exception' });
    return new NextResponse(html('<h1>Fehler</h1><p>Unerwarteter Fehler.</p>'), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
