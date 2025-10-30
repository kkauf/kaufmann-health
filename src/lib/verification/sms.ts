/**
 * SMS verification via Twilio Verify API
 * EARTH-191: SMS verification for faster mobile onboarding
 */

import twilio from 'twilio';
import { normalizePhoneNumber } from './phone';
import { logError } from '@/lib/logger';

interface SendCodeResult {
  success: boolean;
  error?: string;
  sid?: string; // Twilio verification SID
  // Optional diagnostics (not exposed to users)
  twilio_status?: number;
  twilio_code?: number;
  classification?: 'config' | 'auth' | 'provider' | 'unexpected';
}

interface VerifyCodeResult {
  success: boolean;
  error?: string;
  twilio_status?: number;
  twilio_code?: number;
  classification?: 'config' | 'auth' | 'provider' | 'unexpected';
}

function extractTwilioError(err: unknown): {
  message: string;
  status?: number;
  code?: number;
  classification: 'auth' | 'provider' | 'unexpected';
} {
  const anyErr = err as { status?: unknown; code?: unknown; message?: unknown; moreInfo?: unknown };
  const status = typeof anyErr?.status === 'number' ? anyErr.status : undefined;
  const code = typeof anyErr?.code === 'number' ? anyErr.code : undefined;
  const rawMessage = typeof anyErr?.message === 'string' ? anyErr.message : String(err);
  const msg = rawMessage || 'Unknown error';
  // Twilio common auth error code: 20003, or HTTP 401, or message contains "Authenticate"
  const isAuth = status === 401 || code === 20003 || /authenticate/i.test(msg);
  return {
    message: msg,
    status,
    code,
    classification: isAuth ? 'auth' : 'provider',
  };
}

/**
 * Send SMS verification code via Twilio Verify
 * Returns success=false if SMS fails (caller should fallback to email)
 */
export async function sendSmsCode(phoneNumber: string): Promise<SendCodeResult> {
  // E2E bypass: pretend SMS sent successfully in non-production
  if (process.env.E2E_SMS_BYPASS === 'true') {
    return { success: true, sid: 'e2e-bypass' };
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // Check configuration
  if (!accountSid || !authToken || !serviceSid) {
    console.error('[sms] Missing Twilio configuration');
    // Emit structured error log without secrets
    void logError('verification.sms.send', new Error('Missing Twilio configuration'), {
      twilio_config_present: {
        accountSid: Boolean(accountSid),
        authToken: Boolean(authToken),
        serviceSid: Boolean(serviceSid),
      },
    });
    return { success: false, error: 'SMS service not configured', classification: 'config' };
  }

  // Normalize phone to E.164
  const e164Phone = normalizePhoneNumber(phoneNumber);
  console.log('[sms] Normalizing phone:', phoneNumber, '→', e164Phone);
  if (!e164Phone) {
    return { success: false, error: 'Invalid German mobile number' };
  }

  try {
    const client = twilio(accountSid, authToken);

    console.log('[sms] Sending verification to:', e164Phone);
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: e164Phone,
        channel: 'sms',
        locale: 'de', // German language
      });

    if (verification.status === 'pending') {
      return { success: true, sid: verification.sid };
    }

    return { success: false, error: `Unexpected status: ${verification.status}` };
  } catch (error) {
    console.error('[sms] Failed to send verification code:', error);
    const info = extractTwilioError(error);
    // Log detailed provider error for observability (PII-free)
    void logError('verification.sms.send', error, {
      twilio_status: info.status,
      twilio_code: info.code,
      classification: info.classification,
    });
    // Return user-friendly error
    return {
      success: false,
      error: `SMS delivery failed: ${info.message}`,
      twilio_status: info.status,
      twilio_code: info.code,
      classification: info.classification,
    };
  }
}

/**
 * Verify SMS code via Twilio Verify
 */
export async function verifySmsCode(
  phoneNumber: string,
  code: string
): Promise<VerifyCodeResult> {
  // E2E bypass: accept a fixed code without calling Twilio
  if (process.env.E2E_SMS_BYPASS === 'true') {
    const okCode = (process.env.E2E_SMS_CODE || '000000').trim();
    if (code.trim() === okCode) return { success: true };
    return { success: false, error: 'Falscher Code' };
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    void logError('verification.sms.verify', new Error('Missing Twilio configuration'));
    return { success: false, error: 'SMS service not configured', classification: 'config' };
  }

  const e164Phone = normalizePhoneNumber(phoneNumber);
  if (!e164Phone) {
    return { success: false, error: 'Invalid phone number' };
  }

  try {
    const client = twilio(accountSid, authToken);
    
    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: e164Phone,
        code: code.trim(),
      });

    if (verificationCheck.status === 'approved') {
      return { success: true };
    }

    // Twilio returns 'pending' if code is wrong
    return { success: false, error: 'Falscher Code' };
  } catch (error) {
    console.error('[sms] Failed to verify code:', error);
    const info = extractTwilioError(error);
    void logError('verification.sms.verify', error, {
      twilio_status: info.status,
      twilio_code: info.code,
      classification: info.classification,
    });
    return {
      success: false,
      error: `Verification failed: ${info.message}`,
      twilio_status: info.status,
      twilio_code: info.code,
      classification: info.classification,
    };
  }
}

