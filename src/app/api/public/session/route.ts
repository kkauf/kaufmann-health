import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/auth/clientSession';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getClientSession(req);
    if (!session) return NextResponse.json({ data: { verified: false }, error: null });

    const { name: sessionName, contact_method, contact_value, patient_id } = session;

    // Fetch current name and matchesUrl from database
    let currentName = sessionName;
    let matchesUrl: string | null = null;
    if (patient_id) {
      try {
        const { data: person } = await supabaseServer
          .from('people')
          .select('name,metadata')
          .eq('id', patient_id)
          .single();
        if (person?.name) {
          currentName = person.name;
        }
        // Extract matchesUrl from metadata (stored as last_confirm_redirect_path)
        const meta = person?.metadata as Record<string, unknown> | null;
        if (meta?.last_confirm_redirect_path && typeof meta.last_confirm_redirect_path === 'string') {
          matchesUrl = meta.last_confirm_redirect_path;
        }
      } catch {
        // Fall back to session name if DB fetch fails
      }
    }

    return NextResponse.json({
      data: {
        verified: true,
        name: currentName || null,
        contact_method,
        contact_value,
        patient_id,
        matchesUrl,
      },
      error: null
    });
  } catch {
    return NextResponse.json({ data: { verified: false }, error: null }, { status: 200 });
  }
}
