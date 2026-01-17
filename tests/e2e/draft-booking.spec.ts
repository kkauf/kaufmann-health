import { test, expect, request } from '@playwright/test';
import { adminLogin, setPracticeAddress, upsertSlots, deleteSlot, getBerlinDayIndex, tomorrowInBerlin, fmtYmd, resetTherapistSlots } from './utils';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
const defaultTherapistId = hideIdsEnv ? hideIdsEnv.split(',').map((s) => s.trim()).filter(Boolean)[0] : undefined;
const therapistId = process.env.E2E_THERAPIST_ID || defaultTherapistId;

const uid = () => Math.random().toString(36).slice(2);

// Skip for remote runs - requires admin API access to manipulate slots
const isRemoteRun = base.includes('staging') || base.includes('kaufmann-health.de') || !!process.env.SMOKE_TEST_URL;
test.skip(isRemoteRun, 'Skipped for staging/production - requires admin API to manipulate slots');
test.skip(!therapistId, 'Set E2E_THERAPIST_ID to a verified therapist UUID to run draft booking E2E tests.');

function buildSlotTimes(baseHour = 14) {
  const d = tomorrowInBerlin(1);
  const dow = getBerlinDayIndex(d);
  const ymd = fmtYmd(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  const inPersonTime = `${pad(baseHour)}:00`;
  return { d, dow, ymd, inPersonTime };
}

async function seedInPersonSlot(baseHour = 14) {
  const admin = await adminLogin();
  // Ensure a clean slate so our seeded slot appears in availability (cap 9)
  await resetTherapistSlots(admin, therapistId!);
  const { dow, inPersonTime } = buildSlotTimes(baseHour);
  await setPracticeAddress(admin, therapistId!, 'Testallee 5, 10117 Berlin');
  const result = await upsertSlots(admin, therapistId!, [
    { day_of_week: dow, time_local: inPersonTime, format: 'in_person', address: '' },
  ]);
  return { admin, created: result };
}

async function cleanup(adminCtx: Awaited<ReturnType<typeof adminLogin>>, slotIds: string[]) {
  for (const id of slotIds) {
    await deleteSlot(adminCtx, therapistId!, id);
  }
}

// Normal confirm processes draft_booking and consumes the slot
// Flow: send-code(email + draft_booking) -> GET leads/confirm (no kh_test cookie) -> slot disappears
test('draft booking via leads.confirm consumes slot (normal mode)', async () => {
  const baseHour = 14;
  const { admin, created } = await seedInPersonSlot(baseHour);
  try {
    const { ymd, inPersonTime } = buildSlotTimes(baseHour);
    const ctx = await request.newContext({ baseURL: base });
    const email = `e2e-draft-${uid()}@example.com`;

    const payload = {
      contact: email,
      contact_type: 'email' as const,
      name: 'E2E Draft',
      redirect: '/therapeuten',
      draft_booking: {
        therapist_id: therapistId!,
        date_iso: ymd,
        time_label: inPersonTime,
        format: 'in_person' as const,
      },
    };

    const sc = await ctx.post('/api/public/verification/send-code', { data: payload });
    expect(sc.ok()).toBeTruthy();
    const j = await sc.json();
    const token: string = j?.data?.token;
    const personId: string = j?.data?.person_id;
    expect(token).toBeTruthy();
    expect(personId).toBeTruthy();

    // Confirm (normal)
    const conf = await ctx.get(`/api/public/leads/confirm?token=${encodeURIComponent(token)}&id=${encodeURIComponent(personId)}`, { maxRedirects: 0 });
    expect([302, 200, 204]).toContain(conf.status());

    // Slot should be consumed
    const dir = await ctx.get('/api/public/therapists');
    expect(dir.ok()).toBeTruthy();
    const dj = await dir.json();
    const t = (dj?.therapists || []).find((x: any) => x.id === therapistId);
    const avail = (t?.availability || []) as Array<{ date_iso: string; time_label: string; format: string }>; 
    expect(avail.some((s) => s.date_iso === ymd && s.time_label === inPersonTime && s.format === 'in_person')).toBe(false);
  } finally {
    await cleanup(admin, created.map((s) => s.id));
  }
});

// Dry-run confirm: with kh_test=1 cookie, draft booking does NOT insert and slot remains available
// Flow: send-code(email + draft_booking) -> GET leads/confirm with kh_test=1 -> slot remains
test('draft booking via leads.confirm dry-run keeps slot available', async () => {
  const baseHour = 15; // different from previous test to avoid existing booking overlap
  const { admin, created } = await seedInPersonSlot(baseHour);
  try {
    const { ymd, inPersonTime } = buildSlotTimes(baseHour);
    const email = `e2e-draft-${uid()}@example.com`;
    const ctx = await request.newContext({ baseURL: base });

    const sc = await ctx.post('/api/public/verification/send-code', {
      data: {
        contact: email,
        contact_type: 'email' as const,
        name: 'E2E Draft 2',
        redirect: '/therapeuten',
        draft_booking: { therapist_id: therapistId!, date_iso: ymd, time_label: inPersonTime, format: 'in_person' as const },
      },
    });
    expect(sc.ok()).toBeTruthy();
    const j = await sc.json();
    const token: string = j?.data?.token;
    const personId: string = j?.data?.person_id;
    expect(token).toBeTruthy();
    expect(personId).toBeTruthy();

    // Confirm with kh_test=1 cookie
    const ctx2 = await request.newContext({ baseURL: base, extraHTTPHeaders: { Cookie: 'kh_test=1' } });
    const conf = await ctx2.get(`/api/public/leads/confirm?token=${encodeURIComponent(token)}&id=${encodeURIComponent(personId)}`, { maxRedirects: 0 });
    expect([302, 200, 204]).toContain(conf.status());

    // Slot should still be present
    const dir = await ctx.get('/api/public/therapists');
    expect(dir.ok()).toBeTruthy();
    const dj = await dir.json();
    const t = (dj?.therapists || []).find((x: any) => x.id === therapistId);
    const avail = (t?.availability || []) as Array<{ date_iso: string; time_label: string; format: string }>; 
    expect(avail.some((s) => s.date_iso === ymd && s.time_label === inPersonTime && s.format === 'in_person')).toBe(true);
  } finally {
    await cleanup(admin, created.map((s) => s.id));
  }
});
