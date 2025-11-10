import { test, expect, request } from '@playwright/test';
import { adminLogin, setPracticeAddress, upsertSlots, deleteSlot, getBerlinDayIndex, tomorrowInBerlin, fmtYmd, resetTherapistSlots } from './utils';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const therapistId = process.env.E2E_THERAPIST_ID;
const verificationMode = process.env.NEXT_PUBLIC_VERIFICATION_MODE || 'email';

const uid = () => Math.random().toString(36).slice(2);

// Skip entire file if we don't have a target therapist
test.skip(!therapistId, 'Set E2E_THERAPIST_ID to a verified therapist UUID to run booking E2E tests.');
// Email confirm flow requires RESEND_API_KEY to be configured in the server env
test.skip(!process.env.RESEND_API_KEY, 'Set RESEND_API_KEY to run booking E2E tests (email confirm flow).');

async function createVerifiedClientSessionCookie(): Promise<string> {
  // Use email confirm flow to obtain kh_client cookie
  if (verificationMode === 'sms') test.skip(true, 'Email verification not enabled in this environment');
  const ctx = await request.newContext({ baseURL: base });
  const email = `e2e-book-${uid()}@example.com`;
  const sc = await ctx.post('/api/public/verification/send-code', {
    data: { contact: email, contact_type: 'email', name: 'E2E Booker', redirect: '/therapeuten' },
  });
  expect(sc.ok()).toBeTruthy();
  const { data } = await sc.json();
  const token: string = data?.token;
  const personId: string = data?.person_id;
  expect(token).toBeTruthy();
  expect(personId).toBeTruthy();
  const confirm = await ctx.get(`/api/public/leads/confirm?token=${encodeURIComponent(token)}&id=${encodeURIComponent(personId)}`, { maxRedirects: 0 });
  expect([302, 200, 204]).toContain(confirm.status());
  const setCookie = confirm.headers()['set-cookie'] || confirm.headers()['Set-Cookie'] || '';
  const m = /kh_client=([^;]+)/.exec(setCookie);
  expect(m).toBeTruthy();
  return decodeURIComponent(m![1]);
}

function buildSlotTimes(baseHour = 10) {
  const d = tomorrowInBerlin(1);
  const dow = getBerlinDayIndex(d);
  const ymd = fmtYmd(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  const inPersonTime = `${pad(baseHour)}:00`;
  const onlineTime = `${pad(baseHour + 1)}:00`;
  return { d, dow, ymd, inPersonTime, onlineTime };
}

// Seed: ensure practice address and two slots (in_person with empty address for fallback, and online)
async function seedSlots(baseHour = 10) {
  const admin = await adminLogin();
  // Reset to avoid slot cap and cross-test conflicts
  await resetTherapistSlots(admin, therapistId!);
  const { dow, inPersonTime, onlineTime } = buildSlotTimes(baseHour);
  await setPracticeAddress(admin, therapistId!, 'Teststraße 1, 10115 Berlin');
  const result = await upsertSlots(admin, therapistId!, [
    { day_of_week: dow, time_local: inPersonTime, format: 'in_person', address: '' },
    { day_of_week: dow, time_local: onlineTime, format: 'online' },
  ]);
  return { admin, created: result };
}

// Clean up created slots
async function cleanupSlots(adminCtx: Awaited<ReturnType<typeof adminLogin>>, slotIds: string[]) {
  for (const id of slotIds) {
    await deleteSlot(adminCtx, therapistId!, id);
  }
}

// Practice address fallback visible in directory for in_person slot
test('directory includes practice address for in_person slots when slot.address empty', async () => {
  const { admin, created } = await seedSlots(9);
  try {
    const ctx = await request.newContext({ baseURL: base });
    const res = await ctx.get('/api/public/therapists');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const { ymd, inPersonTime, onlineTime } = buildSlotTimes(9);
    const t = (json?.therapists || []).find((x: any) => x.id === therapistId);
    expect(t).toBeTruthy();
    const avail = (t?.availability || []) as Array<{ date_iso: string; time_label: string; format: string; address?: string }>; 
    const slot = avail.find((s) => s.date_iso === ymd && s.time_label === inPersonTime && s.format === 'in_person');
    expect(slot).toBeTruthy();
    // address should be present from practice_address fallback
    expect(slot!.address && slot!.address.length > 0).toBeTruthy();
    expect(slot!.address).toContain('Berlin');
    // online slot should have no address field
    const online = avail.find((s) => s.date_iso === ymd && s.time_label === onlineTime && s.format === 'online');
    expect(online).toBeTruthy();
    expect('address' in (online as any)).toBe(false);
  } finally {
    await cleanupSlots(admin, created.map((s) => s.id));
  }
});

// Dry-run booking: kh_test=1 should not consume the slot and should return {data:{dry_run:true}}
test('booking dry-run does not consume slot and returns dry_run=true', async () => {
  const { admin, created } = await seedSlots(11);
  try {
    const khClient = await createVerifiedClientSessionCookie();
    // Read availability to get exact date/time
    const ctxAuth = await request.newContext({ baseURL: base, extraHTTPHeaders: { Cookie: `kh_client=${encodeURIComponent(khClient)}` } });
    const dirRes = await ctxAuth.get('/api/public/therapists');
    expect(dirRes.ok()).toBeTruthy();
    const dirJson = await dirRes.json();
    const tEntry = (dirJson?.therapists || []).find((x: any) => x.id === therapistId);
    const availAll = (tEntry?.availability || []) as Array<{ date_iso: string; time_label: string; format: string }>;
    const pick = availAll.find((s) => s.format === 'in_person');
    expect(pick).toBeTruthy();
    const ctx = await request.newContext({ baseURL: base, extraHTTPHeaders: { Cookie: `kh_client=${encodeURIComponent(khClient)}; kh_test=1` } });

    const res = await ctx.post('/api/public/bookings', {
      data: { therapist_id: therapistId, date_iso: pick!.date_iso, time_label: pick!.time_label, format: 'in_person', session_id: uid() },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.data?.dry_run).toBe(true);

    // Slot should still appear in availability
    const dir = await ctx.get('/api/public/therapists');
    expect(dir.ok()).toBeTruthy();
    const dj = await dir.json();
    const t = (dj?.therapists || []).find((x: any) => x.id === therapistId);
    const avail = (t?.availability || []) as Array<{ date_iso: string; time_label: string; format: string }>; 
    expect(avail.some((s) => s.date_iso === pick!.date_iso && s.time_label === pick!.time_label && s.format === 'in_person')).toBe(true);
  } finally {
    await cleanupSlots(admin, created.map((s) => s.id));
  }
});

// Normal booking consumes slot; second attempt returns SLOT_TAKEN (409)
test('normal booking consumes slot and duplicate is rejected', async () => {
  const { admin, created } = await seedSlots(13);
  try {
    const khClient = await createVerifiedClientSessionCookie();
    const ctx = await request.newContext({ baseURL: base, extraHTTPHeaders: { Cookie: `kh_client=${encodeURIComponent(khClient)}` } });

    // Read availability to get exact date/time
    const dirRes = await ctx.get('/api/public/therapists');
    expect(dirRes.ok()).toBeTruthy();
    const dirJson = await dirRes.json();
    const tEntry = (dirJson?.therapists || []).find((x: any) => x.id === therapistId);
    const availAll = (tEntry?.availability || []) as Array<{ date_iso: string; time_label: string; format: string }>;
    const pick = availAll.find((s) => s.format === 'online');
    expect(pick).toBeTruthy();

    // First booking
    const r1 = await ctx.post('/api/public/bookings', {
      data: { therapist_id: therapistId, date_iso: pick!.date_iso, time_label: pick!.time_label, format: 'online', session_id: uid() },
    });
    expect(r1.ok()).toBeTruthy();
    const j1 = await r1.json();
    expect(j1?.data?.booking_id).toBeTruthy();

    // Duplicate attempt
    const r2 = await ctx.post('/api/public/bookings', {
      data: { therapist_id: therapistId, date_iso: pick!.date_iso, time_label: pick!.time_label, format: 'online', session_id: uid() },
    });
    expect(r2.status()).toBe(409);
    const j2 = await r2.json();
    expect(j2?.error).toBe('SLOT_TAKEN');
  } finally {
    await cleanupSlots(admin, created.map((s) => s.id));
  }
});
