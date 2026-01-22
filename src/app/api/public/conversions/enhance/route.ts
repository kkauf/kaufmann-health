/**
 * POST /api/public/conversions/enhance
 *
 * Trigger server-side Enhanced Conversion for Google Ads.
 *
 * IMPORTANT: This endpoint should be called AFTER the client-side base conversion
 * (gtag) has been fired. The base conversion must exist in Google's system before
 * the enhancement can be matched to it.
 *
 * Flow:
 * 1. Client fires base conversion via gtag (fireLeadVerifiedConversion)
 * 2. Client calls this endpoint to trigger server-side enhancement
 * 3. Server sends enhancement data (hashed email/phone) to Google Ads API
 * 4. Google matches enhancement to base conversion via orderId (transaction_id)
 */

import { NextRequest, NextResponse } from 'next/server';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { supabaseServer } from '@/lib/supabase-server';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';
import { logError, track } from '@/lib/logger';
import { z } from 'zod';

const EnhanceRequestSchema = z.object({
  patient_id: z.string().uuid(),
  verification_method: z.enum(['email', 'sms']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 requests per minute per IP
    const limiter = getFixedWindowLimiter('conversions-enhance', 20, 60_000);
    const { allowed, retryAfterSec } = limiter.check(extractIpFromHeaders(req.headers));
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = EnhanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { patient_id, verification_method } = parsed.data;

    // Fetch patient data for enhancement
    type PersonRow = {
      id: string;
      email?: string | null;
      phone_number?: string | null;
      type?: string | null;
      metadata?: Record<string, unknown> | null;
    };

    const { data: person, error: fetchErr } = await supabaseServer
      .from('people')
      .select('id,email,phone_number,type,metadata')
      .eq('id', patient_id)
      .single<PersonRow>();

    if (fetchErr || !person) {
      // Don't expose whether the patient exists
      return NextResponse.json({ data: { enhanced: false } });
    }

    // Only patients should trigger conversions
    if ((person.type || '').toLowerCase() !== 'patient') {
      return NextResponse.json({ data: { enhanced: false } });
    }

    // Extract IP and UA for logging
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || undefined;
    const ua = req.headers.get('user-agent') || undefined;

    // Fire the server-side Enhanced Conversion
    // This will be deduplicated by maybeFirePatientConversion using metadata.google_ads_conversion_fired_at
    const result = await maybeFirePatientConversion({
      patient_id: person.id,
      email: person.email || undefined,
      phone_number: person.phone_number || undefined,
      verification_method: verification_method || 'email',
      ip,
      ua,
    });

    // Track the enhancement attempt
    void track({
      type: 'conversion_enhance_requested',
      level: 'info',
      source: 'api.conversions.enhance',
      ip,
      ua,
      props: {
        patient_id,
        fired: result.fired,
        reason: result.reason,
      },
    });

    return NextResponse.json({
      data: { enhanced: result.fired },
    });
  } catch (error) {
    await logError('api.conversions.enhance', error, { stage: 'enhance_conversion' });
    return NextResponse.json(
      { error: 'Enhancement failed' },
      { status: 500 }
    );
  }
}
