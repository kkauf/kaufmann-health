import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/events
 * @description Minimal tracking endpoint. Returns { data, error }.
 */
export async function POST(req: Request) {
  try {
    const { type, id, title } = (await req.json()) as {
      type?: string;
      id?: string;
      title?: string;
    };

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ data: null, error: 'Missing type' }, { status: 400 });
    }

    // Optional metadata
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ua = req.headers.get('user-agent') || undefined;

    // Log server-side (can be wired to analytics later)
    console.log('[event]', JSON.stringify({
      ts: new Date().toISOString(),
      type,
      id,
      title,
      ip,
      ua,
      path: '/api/events',
    }));

    return NextResponse.json({ data: { received: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
