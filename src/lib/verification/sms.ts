/**
 * SMS verification via Twilio Verify API
 * EARTH-191: SMS verification for faster mobile onboarding
 */

import twilio from 'twilio';
import { normalizePhoneNumber } from './phone';

interface SendCodeResult {
  success: boolean;
  error?: string;
  sid?: string; // Twilio verification SID
}

interface VerifyCodeResult {
  success: boolean;
  error?: string;
}

/**
 * Send SMS verification code via Twilio Verify
 * Returns success=false if SMS fails (caller should fallback to email)
 */
export async function sendSmsCode(phoneNumber: string): Promise<SendCodeResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // Check configuration
  if (!accountSid || !authToken || !serviceSid) {
    console.error('[sms] Missing Twilio configuration');
    return { success: false, error: 'SMS service not configured' };
  }

  // Normalize phone to E.164
  const e164Phone = normalizePhoneNumber(phoneNumber);
  if (!e164Phone) {
    return { success: false, error: 'Invalid German mobile number' };
  }

  try {
    const client = twilio(accountSid, authToken);
    
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
    
    // Return user-friendly error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `SMS delivery failed: ${message}` };
  }
}

/**
 * Verify SMS code via Twilio Verify
 */
export async function verifySmsCode(
  phoneNumber: string,
  code: string
): Promise<VerifyCodeResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    return { success: false, error: 'SMS service not configured' };
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
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Verification failed: ${message}` };
  }
}
