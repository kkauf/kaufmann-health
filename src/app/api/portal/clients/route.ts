/**
 * GET /api/portal/clients
 *
 * Returns recent clients for the authenticated therapist (from cal_bookings).
 * Used by the portal "Book a client" feature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';
import { verifyTherapistSessionToken, getTherapistSessionCookieName } from '@/lib/auth/therapistSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RecentClient {
  patient_id: string;
  name: string | null;
  email: string;
  last_session: string;
  session_count: number;
}

export async function GET(_req: NextRequest) {
  try {
    // Verify therapist session
    const cookieStore = await cookies();
    const cookieName = getTherapistSessionCookieName();
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (!cookieValue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyTherapistSessionToken(cookieValue);
    if (!payload?.therapist_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const therapistId = payload.therapist_id;

    // Fetch recent clients from cal_bookings
    // Group by patient, get latest session date and count
    const { data, error } = await supabaseServer.rpc('get_therapist_recent_clients', {
      p_therapist_id: therapistId,
      p_limit: 20,
    });

    if (error) {
      // Fallback: If RPC doesn't exist, use raw query approach
      // This shouldn't happen in production but helps during development
      console.error('[api.portal.clients] RPC error, using fallback:', error);

      const { data: fallbackData, error: fallbackError } = await supabaseServer
        .from('cal_bookings')
        .select(`
          patient_id,
          start_time,
          people!inner(id, name, email)
        `)
        .eq('therapist_id', therapistId)
        .eq('is_test', false)
        .in('status', ['ACCEPTED', 'PENDING'])
        .not('patient_id', 'is', null)
        .order('start_time', { ascending: false })
        .limit(100);

      if (fallbackError) {
        console.error('[api.portal.clients] Fallback query error:', fallbackError);
        return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
      }

      // Dedupe and aggregate client-side
      const clientMap = new Map<string, RecentClient>();
      for (const row of fallbackData || []) {
        // Supabase join can return array or object depending on relationship
        const peopleData = row.people as unknown;
        const people = (Array.isArray(peopleData) ? peopleData[0] : peopleData) as { id: string; name: string | null; email: string } | null;
        if (!people?.email) continue;

        const existing = clientMap.get(people.id);
        if (existing) {
          existing.session_count++;
          // Keep the most recent session
          if (row.start_time > existing.last_session) {
            existing.last_session = row.start_time;
          }
        } else {
          clientMap.set(people.id, {
            patient_id: people.id,
            name: people.name,
            email: people.email,
            last_session: row.start_time,
            session_count: 1,
          });
        }
      }

      // Sort by last_session descending and take top 20
      const clients = Array.from(clientMap.values())
        .sort((a, b) => new Date(b.last_session).getTime() - new Date(a.last_session).getTime())
        .slice(0, 20);

      return NextResponse.json({ clients });
    }

    return NextResponse.json({ clients: data || [] });
  } catch (err) {
    console.error('[api.portal.clients] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
