import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const segments = Array.isArray(path) ? path : [];
  if (segments.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const relPath = segments.join('/');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Upstream not configured' }, { status: 500 });
  }

  // Build upstream URL to Supabase public storage bucket
  const upstream = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/therapist-profiles/${relPath}`;

  try {
    const res = await fetch(upstream, {
      // Hint we expect image content
      headers: { Accept: 'image/*' },
      // Revalidate moderately; images rarely change once published under the same path
      cache: 'no-store',
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const buf = await res.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', res.headers.get('content-type') || 'application/octet-stream');
    // Cache aggressively on client and CDN; safe because photos are addressed by stable path
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    const etag = res.headers.get('etag');
    if (etag) headers.set('ETag', etag);

    return new NextResponse(buf, { status: 200, headers });
  } catch (e) {
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }
}
