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

function normalizeSpec(v: string): string {
  // Canonicalize to a simple slug for robust matching
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[–—−]/g, '-') // normalize dash variants to hyphen
    .replace(/[_\s]+/g, '-') // spaces/underscores -> hyphen
    .replace(/[^a-z0-9-]/g, ''); // drop punctuation/symbols (e.g., ®)
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

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const city = url.searchParams.get('city')?.trim() || undefined;
    const status = (url.searchParams.get('status')?.trim() || 'verified') as 'pending_verification' | 'verified' | 'rejected' | undefined;
    const sessionPref = url.searchParams.get('session_preference') as 'online' | 'in_person' | null;
    // Accept multiple specialization params: ?specialization=narm&specialization=hakomi
    // Match ANY of the provided values (OR). Backwards compatible with single value.
    const specializationParams = url.searchParams
      .getAll('specialization')
      .map((v) => normalizeSpec(v))
      .filter(Boolean);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 200);

    let query = supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, phone, gender, city, session_preferences, modalities, schwerpunkte, typical_rate, accepting_new, status, created_at, metadata, photo_url')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }
    // Admin should see ALL therapists regardless of accepting_new flag
    if (city) {
      // Case-insensitive partial match on city column
      query = query.ilike('city', `%${city}%`);
    }
    // Session preference filter: fetch first (bounded by limit) and filter in code to support OR logic.
    // Note: We intentionally avoid DB prefilter on modalities to allow normalization (spaces vs hyphens, etc.).

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.therapists', error, { stage: 'fetch' });
      return NextResponse.json({ data: null, error: 'Failed to fetch therapists' }, { status: 500 });
    }

    // Fetch Cal.com slot counts from cache for all therapists
    const therapistIds = (data || []).map((r: { id: string }) => r.id);
    type CalSlotCache = { therapist_id: string; slots_count: number | null; full_slots_count: number | null };
    const slotCountByTid = new Map<string, { intro: number; full: number }>();
    if (therapistIds.length > 0) {
      const { data: slotRows } = await supabaseServer
        .from('cal_slots_cache')
        .select('therapist_id, slots_count, full_slots_count')
        .in('therapist_id', therapistIds);
      if (Array.isArray(slotRows)) {
        for (const s of slotRows as CalSlotCache[]) {
          slotCountByTid.set(s.therapist_id, {
            intro: s.slots_count || 0,
            full: s.full_slots_count || 0,
          });
        }
      }
    }
    // Normalize to existing shape expected by Admin UI
    type Row = {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone?: string | null;
      gender?: string | null;
      city?: string | null;
      session_preferences?: unknown;
      modalities?: unknown;
      schwerpunkte?: unknown;
      typical_rate?: number | null;
      accepting_new?: boolean | null;
      status?: 'pending_verification' | 'verified' | 'rejected' | null;
      created_at?: string | null;
      metadata?: unknown;
      photo_url?: string | null;
    };
    let rows = (data || []) as Row[];

    if (sessionPref === 'online' || sessionPref === 'in_person') {
      const target = sessionPref;
      rows = rows.filter((r) => {
        const prefs = Array.isArray(r.session_preferences)
          ? (r.session_preferences as unknown[]).map((v) => String(v))
          : [];
        return prefs.includes(target);
      });
    }
    if (specializationParams.length > 0) {
      rows = rows.filter((r) => {
        const specs = Array.isArray(r.modalities)
          ? (r.modalities as unknown[]).map((v) => normalizeSpec(String(v)))
          : [];
        return specializationParams.some((s) => specs.includes(s));
      });
    }

    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }

    const result = rows.map((r) => {
      const name = [r.first_name || '', r.last_name || ''].join(' ').trim() || null;
      const md = isObject((r as Row).metadata) ? ((r as Row).metadata as Record<string, unknown>) : {};
      const profileVal = (md as Record<string, unknown>)['profile'];
      const profileMeta = isObject(profileVal) ? (profileVal as Record<string, unknown>) : {};
      const has_photo_pending = typeof profileMeta.photo_pending_path === 'string' && !!String(profileMeta.photo_pending_path);
      const has_approach_text = typeof profileMeta.approach_text === 'string' && String(profileMeta.approach_text).trim().length > 0;
      const has_photo_public = typeof (r as Row).photo_url === 'string' && !!(r as Row).photo_url;
      const documentsVal = (md as Record<string, unknown>)['documents'];
      const documentsObj = isObject(documentsVal) ? (documentsVal as Record<string, unknown>) : {};
      const has_license_doc = typeof documentsObj.license === 'string' && String(documentsObj.license).length > 0;
      let has_specialization_docs = false;
      const specVal = documentsObj.specialization;
      if (isObject(specVal)) {
        for (const v of Object.values(specVal as Record<string, unknown>)) {
          if (Array.isArray(v) && v.length > 0) { has_specialization_docs = true; break; }
        }
      }
      const notificationsVal = (md as Record<string, unknown>)['notifications'];
      const notificationsObj = isObject(notificationsVal) ? (notificationsVal as Record<string, unknown>) : {};
      const opted_out = Boolean((notificationsObj as { reminders_opt_out?: unknown }).reminders_opt_out === true);
      const requires_action = Boolean(has_license_doc || has_specialization_docs || has_photo_pending || has_approach_text);
      const is_test = Boolean(md.is_test === true);
      const is_hidden = md.hidden === true || String(md.hidden).toLowerCase() === 'true';

      // Extract practice address from profile metadata
      const practiceStreet = typeof profileMeta.practice_street === 'string' ? profileMeta.practice_street : '';
      const practicePostalCode = typeof profileMeta.practice_postal_code === 'string' ? profileMeta.practice_postal_code : '';
      const practiceCity = typeof profileMeta.practice_city === 'string' ? profileMeta.practice_city : '';
      const practiceAddress = [practiceStreet, practicePostalCode, practiceCity].filter(Boolean).join(', ') ||
        (typeof profileMeta.practice_address === 'string' ? profileMeta.practice_address : '');
      
      // Extract profile text fields for preview
      const whoComesToMe = typeof profileMeta.who_comes_to_me === 'string' ? profileMeta.who_comes_to_me : '';
      const sessionFocus = typeof profileMeta.session_focus === 'string' ? profileMeta.session_focus : '';
      const firstSession = typeof profileMeta.first_session === 'string' ? profileMeta.first_session : '';
      const aboutMe = typeof profileMeta.about_me === 'string' ? profileMeta.about_me : '';
      const approachText = typeof profileMeta.approach_text === 'string' ? profileMeta.approach_text : '';
      
      const metadata = {
        city: r.city || undefined,
        session_preferences: Array.isArray(r.session_preferences)
          ? (r.session_preferences as unknown[]).map((v) => (v === 'in_person' || v === 'online' ? v : String(v)))
          : [],
        specializations: Array.isArray(r.modalities)
          ? (r.modalities as unknown[]).map((v) => String(v))
          : [],
      } as const;
      return {
        id: r.id,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        name,
        email: r.email || null,
        phone: r.phone || null,
        gender: r.gender || null,
        accepting_new: typeof (r as Row).accepting_new === 'boolean' ? (r as Row).accepting_new : undefined,
        status: r.status || 'pending_verification',
        photo_url: (r as Row).photo_url || null,
        metadata,
        created_at: r.created_at || null,
        opted_out,
        // Enhanced profile data for admin display
        schwerpunkte: Array.isArray(r.schwerpunkte) ? (r.schwerpunkte as string[]) : [],
        typical_rate: r.typical_rate || null,
        practice_address: practiceAddress || null,
        // Backward compatible profile flags
        profile: {
          has_photo_pending,
          has_photo_public,
          has_approach_text,
        },
        // Extended profile data for preview
        profile_data: {
          who_comes_to_me: whoComesToMe,
          session_focus: sessionFocus,
          first_session: firstSession,
          about_me: aboutMe,
          approach_text: approachText,
        },
        documents: {
          has_license_doc,
          has_specialization_docs,
        },
        requires_action,
        is_test,
        is_hidden,
        // Cal.com slot counts from cache
        cal_slots: slotCountByTid.get(r.id) || { intro: 0, full: 0 },
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    await logError('admin.api.therapists', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
