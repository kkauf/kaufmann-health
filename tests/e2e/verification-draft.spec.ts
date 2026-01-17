import { test, expect, request } from '@playwright/test';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
const defaultTherapistId = hideIdsEnv ? hideIdsEnv.split(',').map((s) => s.trim()).filter(Boolean)[0] : undefined;
const therapistId = process.env.E2E_THERAPIST_ID || defaultTherapistId;
const smsBypass = process.env.E2E_SMS_BYPASS === 'true';
const smsCode = process.env.E2E_SMS_CODE || '000000';

const uid = () => Math.random().toString(36).slice(2);

// Skip for remote runs - creates real verification data and draft contacts
const isRemoteRun = base.includes('staging') || base.includes('kaufmann-health.de') || !!process.env.SMOKE_TEST_URL;
test.skip(isRemoteRun, 'Skipped for staging/production - creates real verification/contact data');
// Require therapist id for these flows
test.skip(!therapistId, 'Set E2E_THERAPIST_ID to a verified therapist UUID to run draft auto-send E2E tests.');

// EMAIL: draft auto-send after confirm
// Flow: send-code(email + draft_contact) → leads/confirm → contact(idempotent) returns same match on repeat
// This indirectly verifies that the draft was processed server-side during confirm.
test('email draft auto-send: confirm processes draft and idempotency holds', async () => {
  const ctx = await request.newContext({ extraHTTPHeaders: { Cookie: 'kh_test=1' } });
  const email = `e2e-${uid()}@example.com`;

  // 1) send-code with draft_contact
  const draft = {
    therapist_id: therapistId,
    contact_type: 'booking',
    patient_reason: '',
    patient_message: 'E2E auto message (email confirm)',
    session_format: 'online' as const,
  };
  const scRes = await ctx.post(`${base}/api/public/verification/send-code`, {
    data: {
      contact: email,
      contact_type: 'email',
      name: 'E2E Tester',
      redirect: '/therapeuten',
      draft_contact: draft,
    },
  });
  expect(scRes.ok()).toBeTruthy();
  const scJson = await scRes.json();
  const token = scJson?.data?.token as string;
  const personId = scJson?.data?.person_id as string | undefined;
  expect(token).toBeTruthy();
  expect(personId).toBeTruthy();

  // 2) confirm via GET (server processes draft)
  const confirmUrl = `${base}/api/public/leads/confirm?token=${encodeURIComponent(token)}&id=${encodeURIComponent(personId!)}`;
  const conf = await ctx.get(confirmUrl, { maxRedirects: 0 });
  expect([302, 200, 204]).toContain(conf.status());

  // 3) re-post contact with same idempotency_key → should return the existing match
  const idemKey = `${personId}:${therapistId}:booking`;
  const payload = {
    therapist_id: therapistId,
    contact_type: 'booking' as const,
    patient_name: 'E2E Tester',
    patient_email: email,
    contact_method: 'email' as const,
    patient_reason: 'E2E reason (post-confirm)',
    patient_message: 'E2E message (post-confirm)',
    session_format: 'online' as const,
    idempotency_key: idemKey,
  };

  const r1 = await ctx.post(`${base}/api/public/contact`, { data: payload });
  expect(r1.ok()).toBeTruthy();
  const j1 = await r1.json();
  expect(j1?.data?.match_id).toBeTruthy();

  const r2 = await ctx.post(`${base}/api/public/contact`, { data: payload });
  expect(r2.ok()).toBeTruthy();
  const j2 = await r2.json();
  expect(j2?.data?.match_id).toBe(j1?.data?.match_id);
});

// SMS: draft auto-send after verify-code
// Flow: send-code(phone + draft_contact) → verify-code (bypass) → contact(idempotent)
// Requires server env: NEXT_PUBLIC_VERIFICATION_MODE=sms and E2E_SMS_BYPASS=true

test.skip(!smsBypass, 'Set E2E_SMS_BYPASS=true and NEXT_PUBLIC_VERIFICATION_MODE=sms to run SMS draft auto-send test.');

test('sms draft auto-send: verify-code processes draft and idempotency holds', async () => {
  const ctx = await request.newContext({ extraHTTPHeaders: { Cookie: 'kh_test=1' } });
  const phone = '+4915212345678';

  const draft = {
    therapist_id: therapistId,
    contact_type: 'booking',
    patient_reason: 'E2E SMS reason',
    patient_message: '',
    session_format: 'online' as const,
  };

  // 1) send-code with phone
  const scRes = await ctx.post(`${base}/api/public/verification/send-code`, {
    data: {
      contact: phone,
      contact_type: 'phone',
      name: 'E2E Tester',
      draft_contact: draft,
    },
  });
  expect(scRes.ok()).toBeTruthy();

  // 2) verify-code with bypass code
  const vRes = await ctx.post(`${base}/api/public/verification/verify-code`, {
    data: {
      contact: phone,
      contact_type: 'phone',
      code: smsCode,
    },
  });
  expect(vRes.ok()).toBeTruthy();
  const vJson = await vRes.json();
  const personId = vJson?.data?.person_id as string | undefined;
  expect(personId).toBeTruthy();

  // 3) idempotency check
  const idemKey = `${personId}:${therapistId}:booking`;
  const payload = {
    therapist_id: therapistId,
    contact_type: 'booking' as const,
    patient_name: 'E2E Tester',
    patient_phone: phone,
    contact_method: 'phone' as const,
    patient_reason: 'E2E post-verify',
    patient_message: 'E2E post-verify msg',
    session_format: 'online' as const,
    idempotency_key: idemKey,
  };
  const r1 = await ctx.post(`${base}/api/public/contact`, { data: payload });
  expect(r1.ok()).toBeTruthy();
  const j1 = await r1.json();
  expect(j1?.data?.match_id).toBeTruthy();

  const r2 = await ctx.post(`${base}/api/public/contact`, { data: payload });
  expect(r2.ok()).toBeTruthy();
  const j2 = await r2.json();
  expect(j2?.data?.match_id).toBe(j1?.data?.match_id);
});
