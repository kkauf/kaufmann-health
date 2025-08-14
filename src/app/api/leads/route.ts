import { NextResponse } from 'next/server';

/**
 * @endpoint POST /api/leads
 * @description Form handler for incoming lead submissions. Returns { data, error }.
 */

type LeadPayload = {
  name?: string;
  email: string;
  phone?: string;
  notes?: string;
};

function sanitize(v?: string) {
  if (!v) return undefined;
  return v.toString().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 1000);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Partial<LeadPayload>;
    const email = sanitize(payload.email)?.toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ data: null, error: 'Invalid email' }, { status: 400 });
    }

    const data: LeadPayload = {
      name: sanitize(payload.name),
      email,
      phone: sanitize(payload.phone),
      notes: sanitize(payload.notes),
    };

    // TODO: Persist to Supabase using a server-side client (Edge Function or service role)
    // Intentionally not writing here to avoid exposing secrets. See src/lib/supabase.ts

    return NextResponse.json({ data, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
