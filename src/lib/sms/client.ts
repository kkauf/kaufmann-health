import twilio from 'twilio';
import { logError } from '@/lib/logger';

/**
 * Send a transactional SMS (Twilio Programmable SMS)
 * Returns true on success, false on failure. Does not throw.
 */
export async function sendTransactionalSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    void logError('sms.client.send', new Error('Missing Twilio SMS configuration'), {
      has_accountSid: Boolean(accountSid),
      has_authToken: Boolean(authToken),
      has_messagingServiceSid: Boolean(messagingServiceSid),
      has_fromNumber: Boolean(fromNumber),
    });
    return false;
  }

  try {
    const client = twilio(accountSid, authToken);
    const isUS = /^\+1\d{10}$/.test(to);
    const useFromForUS = isUS && !!fromNumber;
    const paramsBase = useFromForUS
      ? { to, body, from: fromNumber as string }
      : (messagingServiceSid
          ? { to, body, messagingServiceSid }
          : { to, body, from: fromNumber as string });
    const params: Parameters<typeof client.messages.create>[0] = (
      statusCallback
        ? { ...paramsBase, statusCallback }
        : paramsBase
    );

    const msg = await client.messages.create(params);
    return typeof msg?.sid === 'string' && !!msg.sid;
  } catch (e) {
    void logError('sms.client.send', e, { to: to?.slice(-6) ? `***${to.slice(-6)}` : 'redacted' });
    return false;
  }
}
