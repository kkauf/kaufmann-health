import { NextResponse } from 'next/server';
import { track } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/events
 * @description Minimal tracking endpoint. Returns { data, error }.
 */
export async function POST(req: Request) {
  try {
    const {
      type,
      id,
      title,
      session_id,
      referrer: referrerBody,
      utm_source,
      utm_medium,
      utm_campaign,
      properties,
    } = (await req.json()) as {
      type?: string;
      id?: string;
      title?: string;
      session_id?: string;
      referrer?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      properties?: Record<string, unknown>;
    };

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ data: null, error: 'Missing type' }, { status: 400 });
    }

    // Optional metadata
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ua = req.headers.get('user-agent') || undefined;
    const referrerHeader = req.headers.get('referer') || undefined;
    const referrer = (referrerBody || referrerHeader) ?? undefined;

    const mergedProps: Record<string, unknown> = {
      id,
      title,
      path: '/api/events',
      session_id,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      ...(properties && typeof properties === 'object' ? properties : {}),
    };

    // Unified logger (best-effort)
    void track({
      type,
      level: 'info',
      ip: ip || undefined,
      ua,
      source: 'api.events',
      props: mergedProps,
    });

    return NextResponse.json({ data: { received: true }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

