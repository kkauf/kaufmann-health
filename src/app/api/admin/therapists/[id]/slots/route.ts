import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    // Try with new columns first, fallback to legacy schema if they don't exist
    let result = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at, is_recurring, specific_date, end_date')
      .eq('therapist_id', id)
      .order('is_recurring', { ascending: false })
      .order('day_of_week', { ascending: true })
      .order('specific_date', { ascending: true })
      .order('time_local', { ascending: true });
    
    // If columns don't exist, fallback to legacy schema
    if (result.error && result.error.message?.includes('does not exist')) {
      const legacyResult = await supabaseServer
        .from('therapist_slots')
        .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at')
        .eq('therapist_id', id)
        .order('day_of_week', { ascending: true })
        .order('time_local', { ascending: true });
      
      // Map legacy data to include missing fields as undefined
      if (legacyResult.data) {
        const mappedData = legacyResult.data.map(slot => ({
          ...slot,
          is_recurring: null,
          specific_date: null,
          end_date: null
        }));
        return NextResponse.json({ data: mappedData, error: null });
      }
      result = legacyResult;
    }
    
    if (result.error) {
      await logError('admin.api.therapists.slots', result.error, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to fetch slots' }, { status: 500 });
    }
    return NextResponse.json({ data: (result.data || []), error: null });
  } catch (e) {
    await logError('admin.api.therapists.slots', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const slots = Array.isArray(body?.slots) ? body.slots : [];
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ data: null, error: 'No slots provided' }, { status: 400 });
    }

    // Fallback address for in_person slots: use therapist-level practice address
    // This keeps compatibility with DBs that still enforce non-empty address for in_person.
    let practiceAddress = '';
    try {
      const { data: t } = await supabaseServer
        .from('therapists')
        .select('metadata')
        .eq('id', id)
        .single();
      const md = (t?.metadata as Record<string, unknown>) || {};
      const prof = (md['profile'] as Record<string, unknown> | undefined) || undefined;
      const pa = typeof prof?.['practice_address'] === 'string' ? (prof['practice_address'] as string) : '';
      practiceAddress = (pa || '').trim();
    } catch {}

    type SlotIn = {
      day_of_week?: number;
      time_local: string;
      format: 'online' | 'in_person' | 'both';
      address?: string;
      duration_minutes?: number;
      active?: boolean;
      is_recurring?: boolean;
      specific_date?: string | null;
      end_date?: string | null;
    };

    type LegacySlot = {
      therapist_id: string;
      day_of_week: number;
      time_local: string;
      format: 'online' | 'in_person';
      address: string;
      duration_minutes: number;
      active: boolean;
    };

    function isValidTime(v: string): boolean {
      return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
    }

    function isValidDate(v: string): boolean {
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    }

    const sanitized: (SlotIn & { therapist_id: string; address: string; duration_minutes: number; active: boolean; is_recurring: boolean; specific_date: string | null; end_date: string | null; day_of_week: number })[] = [];
    for (const s of slots as SlotIn[]) {
      const isRecurring = s?.is_recurring !== false; // Default to true
      const fmtRaw = String(s?.format || '').trim();
      const fmt: 'online' | 'in_person' | 'both' = fmtRaw === 'in_person' ? 'in_person' : (fmtRaw === 'both' ? 'both' : 'online');
      const t = String(s?.time_local || '').slice(0, 5);
      const dur = Number.isFinite(Number(s?.duration_minutes)) ? Math.max(30, Math.min(240, Number(s!.duration_minutes))) : 60;
      const act = s?.active === false ? false : true;
      // Use explicit slot address if provided; otherwise fallback to therapist practice address for in_person
      const addr = (fmt === 'in_person' || fmt === 'both') ? (String(s?.address || '').trim() || practiceAddress) : '';
      // Optional end_date for recurring series
      const endDateStr = String(s?.end_date || '').trim();
      const endDate = endDateStr && isValidDate(endDateStr) ? endDateStr : null;

      if (isRecurring) {
        // Recurring slot: validate day_of_week
        const dow = Number(s?.day_of_week);
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
          return NextResponse.json({ data: null, error: 'Invalid day_of_week for recurring slot' }, { status: 400 });
        }
        if (!isValidTime(t)) {
          return NextResponse.json({ data: null, error: 'Invalid time_local (expected HH:MM)' }, { status: 400 });
        }
        sanitized.push({
          therapist_id: id,
          day_of_week: dow,
          time_local: t,
          format: fmt,
          address: addr,
          duration_minutes: dur,
          active: act,
          is_recurring: true,
          specific_date: null,
          end_date: endDate
        });
      } else {
        // One-time slot: validate specific_date
        const specificDate = String(s?.specific_date || '');
        if (!isValidDate(specificDate)) {
          return NextResponse.json({ data: null, error: 'Invalid or missing specific_date for one-time slot' }, { status: 400 });
        }
        if (!isValidTime(t)) {
          return NextResponse.json({ data: null, error: 'Invalid time_local (expected HH:MM)' }, { status: 400 });
        }
        // For one-time appointments, we still store day_of_week for consistency (extract from date)
        const dateObj = new Date(specificDate + 'T12:00:00');
        const dow = dateObj.getDay();
        sanitized.push({
          therapist_id: id,
          day_of_week: dow,
          time_local: t,
          format: fmt,
          address: addr,
          duration_minutes: dur,
          active: act,
          is_recurring: false,
          specific_date: specificDate,
          end_date: null
        });
      }
    }

    // Cap: maximum 5 active series/appointments per therapist.
    // Count unique series by day/time (recurring) or date/time (one-time), ignoring format.
    const existingKeys = new Set<string>();
    try {
      const { data: current } = await supabaseServer
        .from('therapist_slots')
        .select('day_of_week, time_local, is_recurring, specific_date, active')
        .eq('therapist_id', id)
        .eq('active', true);
      if (Array.isArray(current)) {
        for (const s of current as { day_of_week?: number | null; time_local?: string | null; is_recurring?: boolean | null; specific_date?: string | null }[]) {
          const time = String(s.time_local || '').slice(0, 5);
          const recurring = s.is_recurring !== false; // treat undefined as recurring
          if (recurring) {
            const dow = Number(s.day_of_week);
            if (Number.isFinite(dow) && time) existingKeys.add(`R|${dow}|${time}`);
          } else {
            const date = String(s.specific_date || '').slice(0, 10);
            if (date && time) existingKeys.add(`O|${date}|${time}`);
          }
        }
      }
    } catch {
      // Fallback: legacy count (treat as recurring, dedupe by dow+time)
      try {
        const { data: legacy } = await supabaseServer
          .from('therapist_slots')
          .select('day_of_week, time_local')
          .eq('therapist_id', id)
          .eq('active', true);
        if (Array.isArray(legacy)) {
          for (const s of legacy as { day_of_week?: number | null; time_local?: string | null }[]) {
            const time = String(s.time_local || '').slice(0, 5);
            const dow = Number(s.day_of_week);
            if (Number.isFinite(dow) && time) existingKeys.add(`R|${dow}|${time}`);
          }
        }
      } catch {}
    }

    // Incoming unique keys
    const incomingKeys = new Set<string>();
    for (const s of sanitized.filter((x) => x.active)) {
      const time = String(s.time_local || '').slice(0, 5);
      if (s.is_recurring !== false) {
        if (Number.isFinite(s.day_of_week) && time) incomingKeys.add(`R|${s.day_of_week}|${time}`);
      } else {
        const date = String(s.specific_date || '').slice(0, 10);
        if (date && time) incomingKeys.add(`O|${date}|${time}`);
      }
    }

    // Compute union size
    const union = new Set<string>(existingKeys);
    for (const k of incomingKeys) union.add(k);
    if (union.size > 5) {
      return NextResponse.json({ data: null, error: 'Active slots cap exceeded (max 5 series/termine)' }, { status: 400 });
    }

    // Upsert slots in two batches with conflict keys that ignore format
    const rec = sanitized.filter((s) => s.is_recurring !== false);
    const one = sanitized.filter((s) => s.is_recurring === false);
    type UpsertErr = { message?: string } | null;
    let up1: { error: UpsertErr } = { error: null };
    if (rec.length > 0) {
      up1 = await supabaseServer
        .from('therapist_slots')
        .upsert(rec, { ignoreDuplicates: true, onConflict: 'therapist_id,day_of_week,time_local' });
      if (up1.error) {
        // If legacy unique includes address, retry with address included
        const up1b = await supabaseServer
          .from('therapist_slots')
          .upsert(rec, { ignoreDuplicates: true, onConflict: 'therapist_id,day_of_week,time_local,address' });
        if (up1b.error) up1 = up1b as { error: UpsertErr };
        else up1 = { error: null };
      }
    }
    if (!up1.error && one.length > 0) {
      const upOne = await supabaseServer
        .from('therapist_slots')
        .upsert(one, { ignoreDuplicates: true, onConflict: 'therapist_id,specific_date,time_local' });
      if (upOne.error) up1 = upOne as { error: UpsertErr };
    }

    if (up1.error) {
      const msg = up1.error.message || '';
      const missingCols = msg.includes('does not exist') || msg.includes('column');
      if (missingCols) {
        // Legacy schema fallback: if the DB doesn't have the new columns yet, retry without them for recurring slots.
        const hasOneTime = sanitized.some((s) => s.is_recurring === false);
        if (hasOneTime) {
          // One-time appointments require the new schema; fail gracefully with a helpful error.
          return NextResponse.json({ data: null, error: 'One-time appointments are not supported until the database migration is applied.' }, { status: 400 });
        }
        const legacySanitized = sanitized.map(({ is_recurring, specific_date, end_date, ...rest }) => rest) as LegacySlot[];
        const up2 = await supabaseServer
          .from('therapist_slots')
          .upsert(legacySanitized, { ignoreDuplicates: true });
        if (up2.error) {
          await logError('admin.api.therapists.slots', up2.error, { stage: 'upsert_legacy', therapist_id: id });
          return NextResponse.json({ data: null, error: 'Failed to save slots' }, { status: 500 });
        }
      } else {
        const hasInPersonNoAddress = sanitized.some((s) => s.format === 'in_person' && (!s.address || s.address.trim() === ''));
        const msg2 = (up1.error.message || '').toLowerCase();
        const addrConstraint = msg2.includes('therapist_slots_format_address_chk') || msg2.includes('violates check constraint') || (msg2.includes('address') && hasInPersonNoAddress);
        if (addrConstraint && hasInPersonNoAddress) {
          return NextResponse.json({ data: null, error: 'Für Vor-Ort-Termine bitte zuerst eine Praxis-Adresse speichern.' }, { status: 400 });
        }
        await logError('admin.api.therapists.slots', up1.error, { stage: 'upsert', therapist_id: id });
        return NextResponse.json({ data: null, error: 'Failed to save slots' }, { status: 500 });
      }
    }

    // Try with new columns first, fallback to legacy schema if they don't exist
    let result = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at, is_recurring, specific_date, end_date')
      .eq('therapist_id', id)
      .order('is_recurring', { ascending: false })
      .order('day_of_week', { ascending: true })
      .order('specific_date', { ascending: true })
      .order('time_local', { ascending: true });
    
    // If columns don't exist, fallback to legacy schema
    if (result.error && result.error.message?.includes('does not exist')) {
      const legacyResult = await supabaseServer
        .from('therapist_slots')
        .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at')
        .eq('therapist_id', id)
        .order('day_of_week', { ascending: true })
        .order('time_local', { ascending: true });
      
      // Map legacy data to include missing fields as undefined
      if (legacyResult.data) {
        const mappedData = legacyResult.data.map(slot => ({
          ...slot,
          is_recurring: null,
          specific_date: null,
          end_date: null
        }));
        return NextResponse.json({ data: mappedData, error: null });
      }
      result = legacyResult;
    }
    
    if (result.error) {
      await logError('admin.api.therapists.slots', result.error, { stage: 'fetch_after', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Saved but failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({ data: result.data || [], error: null });
  } catch (e) {
    await logError('admin.api.therapists.slots', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
