/**
 * POST /api/admin/therapists/[id]/fix-cal-events
 *
 * Fix missing Cal.com event types for a therapist who already has a Cal account.
 * Uses Playwright to create event types via UI (SQL-created ones don't work on booking pages).
 *
 * Contract:
 * - Input: None (therapist ID from URL)
 * - Output: { data: { ok, intro_id, full_session_id }, error }
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Playwright needs more time

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;

    // Get therapist Cal.com info
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('email, cal_user_id, cal_username, cal_intro_event_type_id, cal_full_session_event_type_id')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      return NextResponse.json({ data: null, error: 'Therapist not found' }, { status: 404 });
    }

    const calUserId = therapist.cal_user_id;
    const calUsername = therapist.cal_username;
    const email = therapist.email;

    if (!calUserId || !calUsername) {
      return NextResponse.json({ data: null, error: 'Therapist has no Cal.com account' }, { status: 400 });
    }

    // Check if we need to fix anything - look up actual event types in Cal DB
    if (!CAL_DATABASE_URL) {
      return NextResponse.json({ data: null, error: 'Cal.com database not configured' }, { status: 500 });
    }

    const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
      const client = await pool.connect();
      
      // Get existing event types
      const { rows: existingEvents } = await client.query(
        'SELECT id, slug FROM "EventType" WHERE "userId" = $1',
        [calUserId]
      );
      
      const hasIntro = existingEvents.some(e => e.slug === 'intro');
      const hasFullSession = existingEvents.some(e => e.slug === 'full-session');
      
      client.release();
      
      if (hasIntro && hasFullSession) {
        // Both events exist, just update KH database with the IDs
        const introId = existingEvents.find(e => e.slug === 'intro')?.id;
        const fullSessionId = existingEvents.find(e => e.slug === 'full-session')?.id;
        
        await supabaseServer
          .from('therapists')
          .update({
            cal_intro_event_type_id: introId,
            cal_full_session_event_type_id: fullSessionId,
          })
          .eq('id', id);
        
        return NextResponse.json({
          data: {
            ok: true,
            message: 'Event types already exist',
            intro_id: introId,
            full_session_id: fullSessionId,
          },
          error: null,
        });
      }
      
      // Need to create missing event types via Playwright
      // First, we need the user's password - generate a new one and update it
      const bcrypt = await import('bcryptjs');
      const tempPassword = Array.from({ length: 16 }, () => 
        'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 54)]
      ).join('');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      
      const client2 = await pool.connect();
      await client2.query(
        'UPDATE "UserPassword" SET hash = $1 WHERE "userId" = $2',
        [passwordHash, calUserId]
      );
      client2.release();
      
      // Now use Playwright to create events
      const { createEventTypesViaUI } = await import('@/lib/cal/createEventTypes');
      
      const eventsToCreate = [];
      if (!hasIntro) {
        const { KH_INTRO_EVENT } = await import('@/lib/cal/createEventTypes');
        eventsToCreate.push(KH_INTRO_EVENT);
      }
      if (!hasFullSession) {
        const { KH_FULL_SESSION_EVENT } = await import('@/lib/cal/createEventTypes');
        eventsToCreate.push(KH_FULL_SESSION_EVENT);
      }
      
      const result = await createEventTypesViaUI(email!, tempPassword, calUsername, eventsToCreate);
      
      // Update KH database with new event IDs
      const updateData: Record<string, unknown> = {};
      if (result.introId) updateData.cal_intro_event_type_id = result.introId;
      if (result.fullSessionId) updateData.cal_full_session_event_type_id = result.fullSessionId;
      
      if (Object.keys(updateData).length > 0) {
        await supabaseServer
          .from('therapists')
          .update(updateData)
          .eq('id', id);
      }
      
      void track({
        type: 'cal_events_fixed',
        level: 'info',
        source: 'admin.api.therapists.fix-cal-events',
        props: {
          therapist_id: id,
          cal_user_id: calUserId,
          intro_id: result.introId,
          full_session_id: result.fullSessionId,
          success: result.success,
        },
      });
      
      return NextResponse.json({
        data: {
          ok: result.success,
          intro_id: result.introId,
          full_session_id: result.fullSessionId,
          error: result.error,
        },
        error: result.success ? null : result.error,
      });
      
    } finally {
      await pool.end();
    }
    
  } catch (e) {
    await logError('admin.api.therapists.fix-cal-events', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 });
  }
}
