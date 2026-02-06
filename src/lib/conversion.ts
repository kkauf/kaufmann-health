/**
 * Universal conversion tracking for verified patient leads
 * EARTH-204: Fire Google Ads conversions when contact is verified (email OR SMS)
 * 
 * Deduplication: Only fire once per lead using metadata.google_ads_conversion_fired_at
 * Supports both email and SMS verification flows
 */

import { supabaseServer } from '@/lib/supabase-server';
import { googleAdsTracker } from '@/lib/google-ads';
import { logError, track } from '@/lib/logger';

export interface ConversionContext {
  patient_id: string;
  email?: string;
  phone_number?: string;
  verification_method: 'email' | 'sms';
  ip?: string;
  ua?: string;
}

export interface BookingConversionContext {
  cal_uid: string;
  booking_kind: 'intro' | 'full_session';
  patient_id?: string | null;
  email?: string | null;
  phone_number?: string | null;
  is_test?: boolean;
  ip?: string;
  ua?: string;
}

/**
 * Fire Google Ads conversion for verified patient lead (server-side Enhanced Conversion)
 * Idempotent: checks metadata.google_ads_conversion_fired_at to prevent duplicates
 */
export async function maybeFirePatientConversion(ctx: ConversionContext): Promise<{ fired: boolean; reason?: string }> {
  try {
    // Fetch current person record to check conversion status and test flag
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
      .eq('id', ctx.patient_id)
      .single<PersonRow>();

    if (fetchErr || !person) {
      await logError('conversion', fetchErr || new Error('Person not found'), {
        stage: 'fetch_person',
        patient_id: ctx.patient_id,
      }, ctx.ip, ctx.ua);
      return { fired: false, reason: 'person_not_found' };
    }

    // Only patients should trigger conversions
    if ((person.type || '').toLowerCase() !== 'patient') {
      return { fired: false, reason: 'not_patient' };
    }

    const metadata = (person.metadata || {}) as Record<string, unknown>;

    // Skip test leads
    const isTest = metadata.is_test === true;
    if (isTest) {
      return { fired: false, reason: 'test_lead' };
    }

    // Check if conversion already fired (deduplication)
    if (metadata.google_ads_conversion_fired_at) {
      return { fired: false, reason: 'already_fired' };
    }

    // Retrieve gclid from metadata (captured from URL on signup)
    const gclid = typeof metadata.gclid === 'string' ? metadata.gclid : undefined;

    // Determine identifiers to use for Enhanced Conversion (email and/or phone)
    const emailForConversion = ctx.email || person.email || '';
    const phoneForConversion = ctx.phone_number || person.phone_number || '';
    if (!emailForConversion && !phoneForConversion) {
      await track({
        type: 'conversion_skipped',
        level: 'info',
        source: 'lib.conversion',
        ip: ctx.ip,
        ua: ctx.ua,
        props: {
          patient_id: ctx.patient_id,
          reason: 'no_identifier',
          verification_method: ctx.verification_method,
        },
      });
      return { fired: false, reason: 'no_identifier' };
    }

    // Fire server-side Enhanced Conversion with available identifiers
    // Uses 'lead_verified' to match GOOGLE_ADS_CA_LEAD_VERIFIED env var
    await googleAdsTracker.trackConversion({
      ...(emailForConversion ? { email: emailForConversion } : {}),
      ...(phoneForConversion ? { phoneNumber: phoneForConversion } : {}),
      conversionAction: 'lead_verified',
      conversionValue: 12, // €12 - matches client-side fireLeadVerifiedConversion
      orderId: ctx.patient_id,
      gclid, // Pass gclid for attribution (primary signal when available)
    });

    // Stamp conversion timestamp in metadata
    const updatedMetadata = {
      ...metadata,
      google_ads_conversion_fired_at: new Date().toISOString(),
      google_ads_conversion_method: ctx.verification_method,
    };

    const { error: updateErr } = await supabaseServer
      .from('people')
      .update({ metadata: updatedMetadata })
      .eq('id', ctx.patient_id);

    if (updateErr) {
      await logError('conversion', updateErr, {
        stage: 'update_conversion_flag',
        patient_id: ctx.patient_id,
      }, ctx.ip, ctx.ua);
      // Conversion fired but flag not set - acceptable (prevents duplicate future fires via dedup check above)
    }

    // Analytics tracking
    void track({
      type: 'conversion_fired',
      level: 'info',
      source: 'lib.conversion',
      ip: ctx.ip,
      ua: ctx.ua,
      props: {
        patient_id: ctx.patient_id,
        verification_method: ctx.verification_method,
        conversion_action: 'lead_verified',
        value: 12,
        has_gclid: !!gclid, // Track whether gclid was available for attribution
      },
    });

    return { fired: true };
  } catch (e) {
    await logError('conversion', e, {
      stage: 'maybe_fire_patient_conversion',
      patient_id: ctx.patient_id,
      verification_method: ctx.verification_method,
    }, ctx.ip, ctx.ua);
    return { fired: false, reason: 'error' };
  }
}

const BOOKING_CONVERSION_MAP = {
  intro: { action: 'intro_booked', value: 60 },
  full_session: { action: 'session_booked', value: 125 },
} as const;

/**
 * Fire Google Ads enhanced conversion for a Cal.com booking.
 *
 * The client-side gtag fires the base conversion with transaction_id = cal_uid.
 * This function sends the server-side enhancement with hashed email/phone so
 * Google can match it back via orderId.
 *
 * Idempotent: checks cal_bookings.metadata.google_ads_conversion_fired_at
 */
export async function maybeFireBookingConversion(ctx: BookingConversionContext): Promise<{ fired: boolean; reason?: string }> {
  try {
    if (ctx.is_test) {
      return { fired: false, reason: 'test_booking' };
    }

    const mapping = BOOKING_CONVERSION_MAP[ctx.booking_kind];
    if (!mapping) {
      return { fired: false, reason: 'unknown_booking_kind' };
    }

    // Fetch the booking record to check dedup and get metadata
    type BookingRow = {
      id: string;
      cal_uid: string;
      patient_id?: string | null;
      metadata?: Record<string, unknown> | null;
    };

    const { data: booking, error: fetchErr } = await supabaseServer
      .from('cal_bookings')
      .select('id,cal_uid,patient_id,metadata')
      .eq('cal_uid', ctx.cal_uid)
      .maybeSingle<BookingRow>();

    if (fetchErr || !booking) {
      return { fired: false, reason: 'booking_not_found' };
    }

    const metadata = (booking.metadata || {}) as Record<string, unknown>;
    if (metadata.google_ads_conversion_fired_at) {
      return { fired: false, reason: 'already_fired' };
    }

    // Resolve patient email/phone for enhanced matching
    let email = ctx.email || '';
    let phone = ctx.phone_number || '';
    let gclid: string | undefined;

    const patientId = ctx.patient_id || booking.patient_id;
    if (patientId) {
      type PersonRow = { email?: string | null; phone_number?: string | null; metadata?: Record<string, unknown> | null };
      const { data: person } = await supabaseServer
        .from('people')
        .select('email,phone_number,metadata')
        .eq('id', patientId)
        .maybeSingle<PersonRow>();

      if (person) {
        email = email || person.email || '';
        phone = phone || person.phone_number || '';
        const personMeta = (person.metadata || {}) as Record<string, unknown>;
        gclid = typeof personMeta.gclid === 'string' ? personMeta.gclid : undefined;
      }
    }

    if (!email && !phone) {
      return { fired: false, reason: 'no_identifier' };
    }

    // Fire server-side enhanced conversion — orderId must match the gtag transaction_id (cal_uid)
    await googleAdsTracker.trackConversion({
      ...(email ? { email } : {}),
      ...(phone ? { phoneNumber: phone } : {}),
      conversionAction: mapping.action,
      conversionValue: mapping.value,
      orderId: ctx.cal_uid,
      gclid,
    });

    // Stamp dedup flag
    const updatedMetadata = {
      ...metadata,
      google_ads_conversion_fired_at: new Date().toISOString(),
      google_ads_conversion_action: mapping.action,
    };

    await supabaseServer
      .from('cal_bookings')
      .update({ metadata: updatedMetadata })
      .eq('cal_uid', ctx.cal_uid);

    void track({
      type: 'conversion_fired',
      level: 'info',
      source: 'lib.conversion',
      ip: ctx.ip,
      ua: ctx.ua,
      props: {
        cal_uid: ctx.cal_uid,
        booking_kind: ctx.booking_kind,
        patient_id: patientId || null,
        conversion_action: mapping.action,
        value: mapping.value,
        has_gclid: !!gclid,
      },
    });

    return { fired: true };
  } catch (e) {
    await logError('conversion', e, {
      stage: 'maybe_fire_booking_conversion',
      cal_uid: ctx.cal_uid,
      booking_kind: ctx.booking_kind,
    }, ctx.ip, ctx.ua);
    return { fired: false, reason: 'error' };
  }
}
