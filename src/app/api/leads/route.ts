import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

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
      notes: sanitize((payload as any).notes),
    };

    // Optional additional fields captured as metadata
    const city = sanitize((payload as any).city);
    const issue = sanitize((payload as any).issue);
    const availability = sanitize((payload as any).availability);
    const budget = sanitize((payload as any).budget);


    const { data: inserted, error } = await supabaseServer
      .from('people')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        type: 'patient',
        status: 'new',
        metadata: {
          ...(data.notes ? { notes: data.notes } : {}),
          ...(city ? { city } : {}),
          ...(issue ? { issue } : {}),
          ...(availability ? { availability } : {}),
          ...(budget ? { budget } : {}),
          funnel_type: 'narm',
          submitted_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ data: null, error: 'Failed to save lead' }, { status: 500 });
    }

    return NextResponse.json({ data: { id: inserted.id }, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
