import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function getFileExtension(fileName: string, contentType: string): string {
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function isValidUpload(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_FILE_TYPES.has(file.type)) return { ok: false, reason: 'Unsupported file type' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'File too large' };
  return { ok: true };
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Validate therapist exists and is pending verification
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('id, status, metadata')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      await logError('api.therapists.documents', fetchErr, { stage: 'fetch_therapist', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    if ((therapist as { status?: string }).status !== 'pending_verification') {
      // Hide details; treat as not found to avoid information leak
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    const form = await req.formData();
    const license = form.get('psychotherapy_license');
    const specAll = form.getAll('specialization_cert');

    if (!(license instanceof File) || license.size === 0) {
      return NextResponse.json({ data: null, error: 'Missing psychotherapy_license' }, { status: 400 });
    }

    const specializationFiles = specAll.filter((x): x is File => x instanceof File && x.size > 0);
    if (specializationFiles.length === 0) {
      return NextResponse.json({ data: null, error: 'Missing specialization_cert' }, { status: 400 });
    }

    // Validate and upload license
    const licValid = isValidUpload(license);
    if (!licValid.ok) {
      return NextResponse.json({ data: null, error: `license: ${licValid.reason}` }, { status: 400 });
    }
    const bucket = 'therapist-documents';
    const licExt = getFileExtension(license.name || '', license.type);
    const licPath = `therapists/${id}/license-${Date.now()}${licExt}`;
    const licBuf = await fileToBuffer(license);
    const { error: upLicErr } = await supabaseServer.storage
      .from(bucket)
      .upload(licPath, licBuf, { contentType: license.type, upsert: false });
    if (upLicErr) {
      await logError('api.therapists.documents', upLicErr, { stage: 'upload_license', therapist_id: id, path: licPath }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to upload document' }, { status: 500 });
    }

    // Validate and upload specialization certs
    const specPaths: string[] = [];
    for (const file of specializationFiles) {
      const v = isValidUpload(file);
      if (!v.ok) return NextResponse.json({ data: null, error: `specialization: ${v.reason}` }, { status: 400 });
      const ext = getFileExtension(file.name || '', file.type);
      const path = `therapists/${id}/specialization-${Date.now()}${ext}`;
      const buf = await fileToBuffer(file);
      const { error: upErr } = await supabaseServer.storage
        .from(bucket)
        .upload(path, buf, { contentType: file.type, upsert: false });
      if (upErr) {
        await logError('api.therapists.documents', upErr, { stage: 'upload_specialization', therapist_id: id, path }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to upload document' }, { status: 500 });
      }
      specPaths.push(path);
    }

    // Merge metadata.documents
    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const metadata = (therapist as { metadata?: unknown }).metadata;
    const metaObj: Record<string, unknown> = isObject(metadata) ? (metadata as Record<string, unknown>) : {};
    const docsUnknown = (metaObj as { documents?: unknown }).documents;
    const docs: { license?: string; specialization?: Record<string, string[]> } = isObject(docsUnknown)
      ? (docsUnknown as { license?: string; specialization?: Record<string, string[]> })
      : {};

    docs.license = licPath;
    const spec = docs.specialization || {};
    spec.uncategorized = [...(spec.uncategorized || []), ...specPaths];
    docs.specialization = spec;

    metaObj.documents = docs;

    const { error: updateErr } = await supabaseServer
      .from('therapists')
      .update({ metadata: metaObj })
      .eq('id', id);
    if (updateErr) {
      await logError('api.therapists.documents', updateErr, { stage: 'update_metadata', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    void track({ type: 'therapist_documents_uploaded', level: 'info', source: 'api.therapists.documents', ip, ua, props: { therapist_id: id, license: true, specialization_count: specPaths.length } });

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('api.therapists.documents', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
