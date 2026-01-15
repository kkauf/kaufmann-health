/**
 * POST /api/public/cal/book
 *
 * Native booking via Cal.com's internal /api/book/event endpoint (EARTH-271)
 *
 * This proxy avoids CORS issues and allows us to:
 * - Look up eventTypeId from therapist's Cal.com username
 * - Add server-side metadata
 * - Track booking attempts
 *
 * Contract:
 * - Input: CalNativeBookingInput (therapist_id, slot, name, email, location, metadata)
 * - Output: CalBookingResult (success with booking OR error with retry/fallback info)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import { parseRequestBody } from '@/lib/api-utils';
import { ServerAnalytics } from '@/lib/server-analytics';
import { logError } from '@/lib/logger';
import {
  CalBookingKind,
  CalKhMetadata,
  type CalBookingResult,
} from '@/contracts/cal';
import { createCalBooking, buildBookingLocation } from '@/lib/cal/book';
import { getEventType } from '@/lib/cal/slots-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Input schema for native booking request
 */
const CalNativeBookingInput = z.object({
  therapist_id: z.string().uuid(),
  kind: CalBookingKind,
  slot_utc: z.string().datetime(), // ISO 8601 UTC timestamp
  name: z.string().min(1),
  email: z.string().email(),
  location_type: z.enum(['video', 'in_person']).default('video'),
  location_address: z.string().optional(),
  metadata: CalKhMetadata.partial().optional(),
});

type CalNativeBookingInput = z.infer<typeof CalNativeBookingInput>;

/**
 * Response type for the booking API
 */
interface CalNativeBookingResponse {
  data: CalBookingResult | null;
  error: string | null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    // Parse and validate request body
    const parsed = await parseRequestBody(req, CalNativeBookingInput);
    if (!parsed.success) {
      return parsed.response;
    }

    const {
      therapist_id,
      kind,
      slot_utc,
      name,
      email,
      location_type,
      location_address,
      metadata,
    } = parsed.data;

    // Look up therapist's Cal.com username
    const { data: therapist, error: therapistErr } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, cal_username, cal_enabled, email')
      .eq('id', therapist_id)
      .single();

    if (therapistErr || !therapist) {
      return NextResponse.json(
        { data: null, error: 'Therapist not found' } satisfies CalNativeBookingResponse,
        { status: 404 }
      );
    }

    if (!therapist.cal_enabled || !therapist.cal_username) {
      return NextResponse.json(
        { data: null, error: 'Cal.com not enabled for this therapist' } satisfies CalNativeBookingResponse,
        { status: 400 }
      );
    }

    // Get event type ID from Cal.com database
    const eventSlug = kind === 'intro' ? 'intro' : 'full-session';
    const eventType = await getEventType(therapist.cal_username, eventSlug);

    if (!eventType) {
      void logError(
        'api.cal.book',
        new Error('Event type not found'),
        { therapist_id, kind, cal_username: therapist.cal_username },
        ip,
        ua
      );
      return NextResponse.json(
        { data: null, error: 'Event type not configured for this therapist' } satisfies CalNativeBookingResponse,
        { status: 400 }
      );
    }

    // Build location object
    const location = buildBookingLocation(location_type, location_address);

    // Track booking attempt
    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'native_booking_attempt',
      source: 'api.cal.book',
      props: {
        therapist_id,
        kind,
        slot_utc,
        location_type,
        event_type_id: eventType.eventTypeId,
      },
    });

    // Call Cal.com's internal booking API
    const result = await createCalBooking({
      eventTypeId: eventType.eventTypeId,
      start: slot_utc,
      responses: {
        name,
        email,
        location,
      },
      timeZone: 'Europe/Berlin',
      language: 'de',
      metadata: {
        kh_therapist_id: therapist_id,
        kh_booking_kind: kind,
        kh_source: 'directory',
        ...metadata,
        kh_gclid: metadata?.kh_gclid,
        kh_utm_source: metadata?.kh_utm_source,
        kh_utm_medium: metadata?.kh_utm_medium,
        kh_utm_campaign: metadata?.kh_utm_campaign,
        kh_utm_term: metadata?.kh_utm_term,
        kh_utm_content: metadata?.kh_utm_content,
      },
    });

    // Track result
    if (result.success) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'native_booking_success',
        source: 'api.cal.book',
        props: {
          therapist_id,
          kind,
          booking_uid: result.booking.uid,
          video_url: result.booking.metadata?.videoCallUrl,
        },
      });
    } else {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'native_booking_failed',
        source: 'api.cal.book',
        props: {
          therapist_id,
          kind,
          error: result.error,
          message: result.message,
          can_retry: result.canRetry,
          fallback_to_redirect: result.fallbackToRedirect,
        },
      });
    }

    return NextResponse.json({ data: result, error: null } satisfies CalNativeBookingResponse);
  } catch (error) {
    void logError('api.cal.book', error, { path: req.nextUrl.pathname }, ip, ua);

    return NextResponse.json(
      {
        data: {
          success: false,
          error: 'api_error',
          fallbackToRedirect: true,
          message: 'Internal server error',
        } as CalBookingResult,
        error: null,
      } satisfies CalNativeBookingResponse,
      { status: 500 }
    );
  }
}
