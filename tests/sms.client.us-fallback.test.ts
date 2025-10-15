import { describe, it, expect, vi, beforeEach } from 'vitest';

let createdParams: any = null;

vi.mock('twilio', () => {
  return {
    default: (sid: string, token: string) => ({
      messages: {
        create: vi.fn(async (params: any) => {
          createdParams = params;
          return { sid: 'SM_test' };
        }),
      },
    }),
  } as any;
});

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(async () => {}),
}));

describe('sendTransactionalSms US fallback', () => {
  beforeEach(() => {
    createdParams = null;
    process.env.TWILIO_ACCOUNT_SID = 'AC_x';
    process.env.TWILIO_AUTH_TOKEN = 'auth';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_service';
    process.env.TWILIO_FROM_NUMBER = '+18335551234';
    process.env.TWILIO_STATUS_CALLBACK_URL = '';
  });

  it('uses from number for +1 destinations even when messagingServiceSid is set', async () => {
    const { sendTransactionalSms } = await import('@/lib/sms/client');
    const ok = await sendTransactionalSms('+12125550123', 'hello');
    expect(ok).toBe(true);
    expect(createdParams).toMatchObject({ to: '+12125550123', from: '+18335551234' });
    expect(createdParams).not.toHaveProperty('messagingServiceSid');
  });

  it('uses messagingServiceSid for non-US destinations', async () => {
    const { sendTransactionalSms } = await import('@/lib/sms/client');
    const ok = await sendTransactionalSms('+491234567890', 'hello');
    expect(ok).toBe(true);
    expect(createdParams).toMatchObject({ to: '+491234567890', messagingServiceSid: 'MG_service' });
  });
});
