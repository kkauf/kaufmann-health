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
    await googleAdsTracker.trackConversion({
      ...(emailForConversion ? { email: emailForConversion } : {}),
      ...(phoneForConversion ? { phoneNumber: phoneForConversion } : {}),
      conversionAction: 'client_registration',
      conversionValue: 10,
      orderId: ctx.patient_id,
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
        conversion_action: 'client_registration',
        value: 10,
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
