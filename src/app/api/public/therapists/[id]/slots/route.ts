import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getTherapistSession } from '@/lib/auth/therapistSession';
import { logError, track } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Slot = {
  id: string;
  therapist_id: string;
  day_of_week: number;
  time_local: string;
  format: 'online' | 'in_person' | 'both';
  address: string;
  duration_minutes: number;
  active: boolean;
  is_recurring: boolean;
  specific_date: string | null;
  end_date: string | null;
};

/**
 * GET /api/public/therapists/[id]/slots
 * 
 * Fetch slots for a verified therapist (requires session auth)
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Verify session
    const session = await getTherapistSession(req);
    if (!session || session.therapist_id !== id) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch slots
    const { data, error } = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, is_recurring, specific_date, end_date')
      .eq('therapist_id', id)
      .order('is_recurring', { ascending: false })
      .order('day_of_week', { ascending: true })
      .order('specific_date', { ascending: true })
      .order('time_local', { ascending: true });

    if (error) {
      await logError('api.therapists.slots', error, { stage: 'fetch', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch slots' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], error: null });
  } catch (e) {
    await logError('api.therapists.slots', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

/**
 * POST /api/public/therapists/[id]/slots
 * 
 * Upsert slots for a verified therapist (requires session auth)
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Verify session
    const session = await getTherapistSession(req);
    if (!session || session.therapist_id !== id) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const slots = Array.isArray(body?.slots) ? body.slots : [];

    if (slots.length === 0) {
      return NextResponse.json({ data: null, error: 'No slots provided' }, { status: 400 });
    }

    // Get practice address fallback + session preferences for format validation
    let practiceAddress = '';
    let allowsOnline = true;
    let allowsInPerson = true;
    try {
      const { data: t } = await supabaseServer
        .from('therapists')
        .select('metadata, session_preferences')
        .eq('id', id)
        .single();
      const md = (t?.metadata as Record<string, unknown>) || {};
      const prof = (md['profile'] as Record<string, unknown> | undefined) || undefined;
      const pa = typeof prof?.['practice_address'] === 'string' ? (prof['practice_address'] as string) : '';
      practiceAddress = (pa || '').trim();

      const prefsRaw = (t?.session_preferences as unknown) || null;
      if (Array.isArray(prefsRaw) && prefsRaw.length > 0) {
        allowsOnline = prefsRaw.includes('online');
        allowsInPerson = prefsRaw.includes('in_person');
      }
    } catch {}

    // Validate and sanitize slots
    const isValidTime = (v: string) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
    const isValidDate = (v: string) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

    const sanitized: Slot[] = [];
    for (const s of slots) {
      const isRecurring = s?.is_recurring !== false;
      const fmtRaw = String(s?.format || '').trim();
      const fmt: 'online' | 'in_person' | 'both' = fmtRaw === 'in_person' ? 'in_person' : (fmtRaw === 'both' ? 'both' : 'online');
      const t = String(s?.time_local || '').slice(0, 5);
      const dur = Number.isFinite(Number(s?.duration_minutes)) ? Math.max(30, Math.min(240, Number(s!.duration_minutes))) : 60;
      const act = s?.active === false ? false : true;
      const addr = (fmt === 'in_person' || fmt === 'both') ? (String(s?.address || '').trim() || practiceAddress) : '';
      const endDateStr = String(s?.end_date || '').trim();
      const endDate = endDateStr && isValidDate(endDateStr) ? endDateStr : null;

      // Enforce format constraints based on therapist session preferences
      if (fmt === 'online' && !allowsOnline) {
        return NextResponse.json({ data: null, error: 'In deinem Profil sind aktuell nur Vor-Ort-Termine aktiviert. Bitte passe zuerst dein Profil an.' }, { status: 400 });
      }
      if (fmt === 'in_person' && !allowsInPerson) {
        return NextResponse.json({ data: null, error: 'In deinem Profil sind aktuell nur Online-Termine aktiviert. Bitte passe zuerst dein Profil an.' }, { status: 400 });
      }
      if (fmt === 'both' && !(allowsOnline && allowsInPerson)) {
        return NextResponse.json({ data: null, error: 'Format "Beides" ist nur verfügbar, wenn Online- und Vor-Ort-Termine im Profil aktiviert sind.' }, { status: 400 });
      }

      if (isRecurring) {
        const dow = Number(s?.day_of_week);
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
          return NextResponse.json({ data: null, error: 'Ungültiger Wochentag' }, { status: 400 });
        }
        if (!isValidTime(t)) {
          return NextResponse.json({ data: null, error: 'Ungültige Uhrzeit (HH:MM erwartet)' }, { status: 400 });
        }
        sanitized.push({
          id: s?.id || '',
          therapist_id: id,
          day_of_week: dow,
          time_local: t,
          format: fmt,
          address: addr,
          duration_minutes: dur,
          active: act,
          is_recurring: true,
          specific_date: null,
          end_date: endDate,
        });
      } else {
        const specificDate = String(s?.specific_date || '');
        if (!isValidDate(specificDate)) {
          return NextResponse.json({ data: null, error: 'Ungültiges Datum' }, { status: 400 });
        }
        if (!isValidTime(t)) {
          return NextResponse.json({ data: null, error: 'Ungültige Uhrzeit (HH:MM erwartet)' }, { status: 400 });
        }
        const dateObj = new Date(specificDate + 'T12:00:00');
        sanitized.push({
          id: s?.id || '',
          therapist_id: id,
          day_of_week: dateObj.getDay(),
          time_local: t,
          format: fmt,
          address: addr,
          duration_minutes: dur,
          active: act,
          is_recurring: false,
          specific_date: specificDate,
          end_date: null,
        });
      }
    }

    // Check for missing addresses
    const needsAddress = sanitized.some((s) => (s.format === 'in_person' || s.format === 'both') && !s.address);
    if (needsAddress) {
      return NextResponse.json({ data: null, error: 'Für Vor-Ort-Termine bitte zuerst eine Praxis-Adresse im Profil speichern.' }, { status: 400 });
    }

    // Cap: max 5 active slots
    const { data: existing } = await supabaseServer
      .from('therapist_slots')
      .select('id')
      .eq('therapist_id', id)
      .eq('active', true);
    
    const existingIds = new Set((existing || []).map((s: { id: string }) => s.id));
    const newActiveCount = sanitized.filter(s => s.active && !existingIds.has(s.id)).length;
    const currentActiveCount = (existing || []).length;
    const totalAfter = currentActiveCount + newActiveCount;
    
    if (totalAfter > 5) {
      return NextResponse.json({ data: null, error: 'Maximal 5 aktive Termine erlaubt' }, { status: 400 });
    }

    // Upsert slots
    for (const s of sanitized) {
      const { id: slotId, ...slotData } = s;
      
      if (slotId) {
        // Update existing
        const { error: updateErr } = await supabaseServer
          .from('therapist_slots')
          .update(slotData)
          .eq('id', slotId)
          .eq('therapist_id', id); // Security: only update own slots
        
        if (updateErr) {
          await logError('api.therapists.slots', updateErr, { stage: 'update', therapist_id: id, slot_id: slotId }, ip, ua);
          return NextResponse.json({ data: null, error: 'Speichern fehlgeschlagen' }, { status: 500 });
        }
      } else {
        // Insert new
        const { error: insertErr } = await supabaseServer
          .from('therapist_slots')
          .insert(slotData);
        
        if (insertErr) {
          await logError('api.therapists.slots', insertErr, { stage: 'insert', therapist_id: id }, ip, ua);
          return NextResponse.json({ data: null, error: 'Speichern fehlgeschlagen' }, { status: 500 });
        }
      }
    }

    void track({
      type: 'therapist_slots_updated',
      level: 'info',
      source: 'api.therapists.slots',
      ip,
      ua,
      props: { therapist_id: id, slot_count: sanitized.length },
    });

    // Fetch updated slots
    const { data: updated, error: fetchErr } = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, is_recurring, specific_date, end_date')
      .eq('therapist_id', id)
      .order('is_recurring', { ascending: false })
      .order('day_of_week', { ascending: true })
      .order('time_local', { ascending: true });

    if (fetchErr) {
      return NextResponse.json({ data: [], error: null }); // Saved but fetch failed
    }

    return NextResponse.json({ data: updated || [], error: null });
  } catch (e) {
    await logError('api.therapists.slots', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

/**
 * DELETE /api/public/therapists/[id]/slots?slot_id=xxx
 * 
 * Delete a slot for a verified therapist (requires session auth)
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Verify session
    const session = await getTherapistSession(req);
    if (!session || session.therapist_id !== id) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const slotId = url.searchParams.get('slot_id');

    if (!slotId) {
      return NextResponse.json({ data: null, error: 'slot_id required' }, { status: 400 });
    }

    // Delete slot (only if it belongs to this therapist)
    const { error } = await supabaseServer
      .from('therapist_slots')
      .delete()
      .eq('id', slotId)
      .eq('therapist_id', id);

    if (error) {
      await logError('api.therapists.slots', error, { stage: 'delete', therapist_id: id, slot_id: slotId }, ip, ua);
      return NextResponse.json({ data: null, error: 'Löschen fehlgeschlagen' }, { status: 500 });
    }

    void track({
      type: 'therapist_slot_deleted',
      level: 'info',
      source: 'api.therapists.slots',
      ip,
      ua,
      props: { therapist_id: id, slot_id: slotId },
    });

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('api.therapists.slots', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
