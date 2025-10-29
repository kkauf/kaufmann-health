import { test, expect, request } from '@playwright/test';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';

// Helper to create a unique key per test run
const uid = () => Math.random().toString(36).slice(2);

// Minimal therapist fixture assumptions:
// - There is at least one verified therapist returned by /api/public/therapists
async function getAnyVerifiedTherapist() {
  const ctx = await request.newContext();
  const res = await ctx.get(`${base}/api/public/therapists`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const t = (json?.data || [])[0];
  expect(t?.id).toBeTruthy();
  return t;
}

// Basic contact API E2E (server contract validation)
// These tests exercise the endpoint behavior with idempotency and validation.

test('contact accepts message when reason is empty', async () => {
  const t = await getAnyVerifiedTherapist();
  const ctx = await request.newContext();
  const payload = {
    therapist_id: t.id,
    contact_type: 'booking',
    patient_name: 'E2E Tester',
    patient_email: `e2e-${uid()}@example.com`,
    contact_method: 'email',
    patient_reason: '',
    patient_message: 'Nur Nachricht vorhanden',
    session_format: 'online',
  };
  const res = await ctx.post(`${base}/api/public/contact`, { data: payload });
  const json = await res.json();
  expect(res.status()).toBe(200);
  expect(json?.data?.match_id).toBeTruthy();
});

test('contact rejects when both reason and message are empty', async () => {
  const t = await getAnyVerifiedTherapist();
  const ctx = await request.newContext();
  const payload = {
    therapist_id: t.id,
    contact_type: 'consultation',
    patient_name: 'E2E Tester',
    patient_email: `e2e-${uid()}@example.com`,
    contact_method: 'email',
    patient_reason: '',
    patient_message: '',
  };
  const res = await ctx.post(`${base}/api/public/contact`, { data: payload });
  expect(res.status()).toBe(400);
});

test('idempotency: repeated contact with same key returns same match', async () => {
  const t = await getAnyVerifiedTherapist();
  const ctx = await request.newContext();
  const key = `e2e:${uid()}:${t.id}:booking`;
  const basePayload = {
    therapist_id: t.id,
    contact_type: 'booking' as const,
    patient_name: 'E2E Tester',
    patient_email: `e2e-${uid()}@example.com`,
    contact_method: 'email' as const,
    patient_reason: 'E2E Reason',
    patient_message: 'E2E Message',
    session_format: 'online' as const,
    idempotency_key: key,
  };
  const res1 = await ctx.post(`${base}/api/public/contact`, { data: basePayload });
  expect(res1.ok()).toBeTruthy();
  const j1 = await res1.json();
  expect(j1?.data?.match_id).toBeTruthy();

  const res2 = await ctx.post(`${base}/api/public/contact`, { data: basePayload });
  expect(res2.ok()).toBeTruthy();
  const j2 = await res2.json();
  expect(j2?.data?.match_id).toBe(j1?.data?.match_id);
});
