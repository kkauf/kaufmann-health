import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const url = new URL(req.url);
    const action = (url.searchParams.get('action') || '').trim();
    const match_id = (url.searchParams.get('match_id') || '').trim();
    const redirectRaw = (url.searchParams.get('redirect') || '').trim();

    if (!action) return NextResponse.json({ data: null, error: 'Missing action' }, { status: 400 });
    if (!match_id) return NextResponse.json({ data: null, error: 'Missing match_id' }, { status: 400 });
    if (!redirectRaw) return NextResponse.json({ data: null, error: 'Missing redirect' }, { status: 400 });

    // Only allow mailto redirects to avoid open redirect abuse
    if (!redirectRaw.toLowerCase().startsWith('mailto:')) {
      return NextResponse.json({ data: null, error: 'Invalid redirect' }, { status: 400 });
    }

    // Update match action timestamp (best effort)
    try {
      if (action === 'email_clicked') {
        await supabaseServer
          .from('matches')
          .update({ therapist_contacted_at: new Date().toISOString() })
          .eq('id', match_id);
      }
    } catch (e) {
      await logError('api.track.therapist_action', e, { stage: 'update_match', action, match_id }, ip, ua);
    }

    // Track event (fire-and-forget)
    try {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'therapist_action_email_clicked',
        source: 'api.track.therapist_action',
        props: { action, match_id },
      });
    } catch {}

    // 302 redirect to the mailto link (must use a plain Response for non-http schemes)
    return new Response(null, { status: 302, headers: { Location: redirectRaw } });
  } catch (e) {
    await logError('api.track.therapist_action', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
