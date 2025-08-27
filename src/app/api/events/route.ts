import { NextResponse } from 'next/server';
import { track } from '@/lib/logger';

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

    // Unified logger (best-effort)
    void track({
      type,
      level: 'info',
      ip: ip || undefined,
      ua,
      source: 'api.events',
      props: { id, title, path: '/api/events' },
    });

    return NextResponse.json({ data: { received: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
