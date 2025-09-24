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

function contentTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; type: string[] }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, type } = await ctx.params;
    const segments = Array.isArray(type) ? type : [];
    if (segments.length === 0) {
      return NextResponse.json({ data: null, error: 'Missing type' }, { status: 400 });
    }

    // Fetch therapist metadata to locate path
    const { data: row, error } = await supabaseServer
      .from('therapists')
      .select('metadata')
      .eq('id', id)
      .single();
    if (error) {
      await logError('admin.api.therapists.documents', error, { stage: 'fetch_therapist', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    type Documents = { license?: string; specialization?: Record<string, string[]> };
    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    function isDocuments(v: unknown): v is Documents {
      if (!isObject(v)) return false;
      if ('license' in v && typeof (v as Record<string, unknown>).license !== 'string') return false;
      if ('specialization' in v) {
        const spec = (v as Record<string, unknown>).specialization;
        if (!isObject(spec)) return false;
        for (const val of Object.values(spec)) {
          if (!Array.isArray(val) || !val.every((s) => typeof s === 'string')) return false;
        }
      }
      return true;
    }

    const metadataUnknown = (row?.metadata ?? {}) as unknown;
    let docs: Documents = {};
    if (isObject(metadataUnknown)) {
      const maybeDocs = (metadataUnknown as { documents?: unknown }).documents;
      if (isDocuments(maybeDocs)) docs = maybeDocs;
    }

    let path: string | undefined;
    if (segments[0] === 'license') {
      path = typeof docs.license === 'string' ? docs.license : undefined;
    } else if (segments[0] === 'specialization') {
      const slug = segments[1];
      const index = Number(segments[2] ?? '0');
      const specMap = docs.specialization || {};
      const arr = slug ? specMap[slug] : undefined;
      if (slug && Array.isArray(arr) && Number.isInteger(index) && index >= 0 && index < arr.length) {
        path = arr[index];
      }
    }

    if (!path) {
      return NextResponse.json({ data: null, error: 'Document not found' }, { status: 404 });
    }

    const { data: file, error: dlErr } = await supabaseServer.storage
      .from('therapist-documents')
      .download(path);
    if (dlErr || !file) {
      await logError('admin.api.therapists.documents', dlErr, { stage: 'download', path });
      return NextResponse.json({ data: null, error: 'Failed to download' }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const contentType = contentTypeFromPath(path);
    return new NextResponse(Buffer.from(arrayBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${encodeURIComponent(path.split('/').pop() || 'document')}"`,
      },
    });
  } catch (e) {
    await logError('admin.api.therapists.documents', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
