import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/auth/clientSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getClientSession(req);
    if (!session) return NextResponse.json({ data: { verified: false }, error: null });
    const { name, contact_method, contact_value } = session;
    return NextResponse.json({ data: { verified: true, name: name || null, contact_method, contact_value }, error: null });
  } catch (e) {
    return NextResponse.json({ data: { verified: false }, error: null }, { status: 200 });
  }
}
