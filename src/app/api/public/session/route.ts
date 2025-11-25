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

    // Fetch current name from database (in case it was updated after the cookie was created)
    let currentName = sessionName;
    if (patient_id) {
      try {
        const { data: person } = await supabaseServer
          .from('people')
          .select('name')
          .eq('id', patient_id)
          .single();
        if (person?.name) {
          currentName = person.name;
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
      },
      error: null
    });
  } catch {
    return NextResponse.json({ data: { verified: false }, error: null }, { status: 200 });
  }
}
