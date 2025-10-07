import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TherapistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  modalities: unknown;
  session_preferences: unknown;
  accepting_new: boolean | null;
  photo_url: string | null;
  status: string | null;
  metadata: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, city, modalities, session_preferences, accepting_new, photo_url, status, metadata')
      .eq('status', 'verified')
      .not('photo_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api.public.therapists] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapists' },
        { status: 500 }
      );
    }

    const rows = (data as TherapistRow[] | null) || [];

    const therapists = rows.map((row) => {
      const mdObj: Record<string, unknown> =
        row?.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {};

      const profileUnknown = mdObj['profile'];
      const profile: Record<string, unknown> =
        profileUnknown && typeof profileUnknown === 'object'
          ? (profileUnknown as Record<string, unknown>)
          : {};

      const approach_text =
        typeof profile['approach_text'] === 'string'
          ? (profile['approach_text'] as string)
          : '';

      return {
        id: row.id,
        first_name: String(row.first_name || ''),
        last_name: String(row.last_name || ''),
        city: String(row.city || ''),
        modalities: Array.isArray(row.modalities) ? (row.modalities as string[]) : [],
        session_preferences: Array.isArray(row.session_preferences) ? (row.session_preferences as string[]) : [],
        accepting_new: Boolean(row.accepting_new),
        photo_url: row.photo_url || undefined,
        approach_text,
        metadata: mdObj,
      };
    });

    return NextResponse.json({ therapists }, { status: 200 });
  } catch (err) {
    console.error('[api.public.therapists] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
