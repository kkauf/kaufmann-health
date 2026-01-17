import { test, expect } from '@playwright/test';
import { adminLogin, setPracticeAddress, upsertSlots, deleteSlot, getBerlinDayIndex, tomorrowInBerlin, fmtYmd, resetTherapistSlots } from './utils';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
const defaultTherapistId = hideIdsEnv ? hideIdsEnv.split(',').map((s) => s.trim()).filter(Boolean)[0] : undefined;
const therapistId = process.env.E2E_THERAPIST_ID || defaultTherapistId;

// Skip for remote runs - requires admin API access to manipulate slots
const isRemoteRun = base.includes('staging') || base.includes('kaufmann-health.de') || !!process.env.SMOKE_TEST_URL;
test.skip(!therapistId, 'Set E2E_THERAPIST_ID to run booking UI E2E tests.');
test.skip(isRemoteRun, 'Skipped for staging/production - requires admin API to manipulate slots');

function buildSlotTimes(baseHour = 10) {
  const d = tomorrowInBerlin(1);
  const dow = getBerlinDayIndex(d);
  const ymd = fmtYmd(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  const inPersonTime = `${pad(baseHour)}:00`;
  const onlineTime = `${pad(baseHour + 1)}:00`;
  return { d, dow, ymd, inPersonTime, onlineTime };
}

async function seedSlots(baseHour = 10) {
  const admin = await adminLogin();
  await resetTherapistSlots(admin, therapistId!);
  const { dow, inPersonTime, onlineTime } = buildSlotTimes(baseHour);
  await setPracticeAddress(admin, therapistId!, 'Teststraße 1, 10115 Berlin');
  const result = await upsertSlots(admin, therapistId!, [
    { day_of_week: dow, time_local: inPersonTime, format: 'in_person', address: '' },
    { day_of_week: dow, time_local: onlineTime, format: 'online' },
  ]);
  return { admin, created: result };
}

async function cleanupSlots(adminCtx: Awaited<ReturnType<typeof adminLogin>>, slotIds: string[]) {
  for (const id of slotIds) {
    await deleteSlot(adminCtx, therapistId!, id);
  }
}

test.describe('Direct Booking UI Flow', () => {
  test('complete booking flow from directory to verification', async ({ page }) => {
    const { admin, created } = await seedSlots(10);
    try {
      // Navigate to directory
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      // Find therapist card with our test therapist
      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      await expect(therapistCard).toBeVisible();

      // Click "Therapeut:in buchen" button
      const bookingButton = therapistCard.locator('button:has-text("Therapeut:in buchen")');
      await bookingButton.click();

      // Modal should open with slot picker
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator('text=Nachricht schreiben')).toBeVisible();

      // Verify format selector is present
      await expect(modal.locator('button:has-text("Online")')).toBeVisible();
      await expect(modal.locator('button:has-text("Vor Ort")')).toBeVisible();

      // Select "Online" format
      await modal.locator('button:has-text("Online")').click();

      // Verify slot picker shows slots
      const slotPicker = modal.locator('[aria-label*="Woche"]').first();
      await expect(slotPicker).toBeVisible();

      // Select an online slot (should be visible after format selection)
      const { onlineTime } = buildSlotTimes(10);
      const slotButton = modal.locator(`button:has-text("${onlineTime}")`).first();
      await expect(slotButton).toBeVisible();
      await slotButton.click();

      // Verify slot is highlighted/selected (has ring-2 ring-emerald-300)
      await expect(slotButton).toHaveClass(/ring-2/);
      await expect(slotButton).toHaveClass(/ring-emerald-300/);

      // Verify "Termin buchen" button is enabled
      const confirmButton = modal.locator('button:has-text("Termin buchen")');
      await expect(confirmButton).toBeEnabled();

      // Verify selected slot confirmation box appears
      await expect(modal.locator('text=Ausgewählter Termin')).toBeVisible();
      await expect(modal.locator(`text=${onlineTime}`)).toBeVisible();

      // Click "Termin buchen" to proceed to verification
      await confirmButton.click();

      // Should now be on verification step
      await expect(modal.locator('text=Anmelden um zu senden')).toBeVisible();

      // Verify slot confirmation appears on verification screen
      await expect(modal.locator('text=Du buchst deine Online‑Therapiesitzung')).toBeVisible();
      await expect(modal.locator(`text=${onlineTime}`)).toBeVisible();

      // Fill in verification details
      await modal.locator('input[name="name"]').fill('E2E Test User');
      await modal.locator('button:has-text("E-Mail")').click();
      await modal.locator('input[type="email"]').fill('e2e-test@example.com');

      // Note: We don't actually submit to avoid email/SMS in E2E
      // Just verify the form is ready
      const submitButton = modal.locator('button:has-text("Bestätigen")');
      await expect(submitButton).toBeEnabled();
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });

  test('in-person booking shows address pill', async ({ page }) => {
    const { admin, created } = await seedSlots(11);
    try {
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      const bookingButton = therapistCard.locator('button:has-text("Therapeut:in buchen")');
      await bookingButton.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Select "Vor Ort" format
      await modal.locator('button:has-text("Vor Ort")').click();

      // Verify address pill appears with MapPin icon
      const addressPill = modal.locator('text=Teststraße 1, 10115 Berlin');
      await expect(addressPill).toBeVisible();
      
      // Verify MapPin icon is present
      const mapPinIcon = modal.locator('svg').filter({ hasText: '' }).first();
      await expect(mapPinIcon).toBeVisible();

      // Select an in-person slot
      const { inPersonTime } = buildSlotTimes(11);
      const slotButton = modal.locator(`button:has-text("${inPersonTime}")`).first();
      await slotButton.click();

      // Verify "Termin buchen" button is enabled
      const confirmButton = modal.locator('button:has-text("Termin buchen")');
      await expect(confirmButton).toBeEnabled();
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });

  test('consultation flow locks to online format', async ({ page }) => {
    const { admin, created } = await seedSlots(12);
    try {
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      
      // Click "Kostenloses Erstgespräch buchen" button
      const consultationButton = therapistCard.locator('button:has-text("Kostenloses Erstgespräch")');
      await consultationButton.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Verify format selector is NOT present (consultation is locked to online)
      await expect(modal.locator('button:has-text("Vor Ort")')).not.toBeVisible();
      
      // Verify reason/message fields are present (not slot picker)
      await expect(modal.locator('label:has-text("Worum geht es?")')).toBeVisible();
      await expect(modal.locator('textarea')).toBeVisible();
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });

  test('week navigation updates available slots', async ({ page }) => {
    const { admin, created } = await seedSlots(13);
    try {
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      const bookingButton = therapistCard.locator('button:has-text("Therapeut:in buchen")');
      await bookingButton.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Select format to show slots
      await modal.locator('button:has-text("Online")').click();

      // Verify current week label is visible
      const weekLabel = modal.locator('text=/\\d{2}\\.\\d{2}\\s*–\\s*\\d{2}\\.\\d{2}/').first();
      await expect(weekLabel).toBeVisible();
      const currentWeekText = await weekLabel.textContent();

      // Click next week button
      const nextButton = modal.locator('button[aria-label="Nächste Woche"]');
      await nextButton.click();

      // Verify week label changed
      const newWeekText = await weekLabel.textContent();
      expect(newWeekText).not.toBe(currentWeekText);

      // Click previous week button
      const prevButton = modal.locator('button[aria-label="Vorherige Woche"]');
      await prevButton.click();

      // Should be back to original week
      const backToOriginalText = await weekLabel.textContent();
      expect(backToOriginalText).toBe(currentWeekText);
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });

  test('format filter shows only matching slots', async ({ page }) => {
    const { admin, created } = await seedSlots(14);
    try {
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      const bookingButton = therapistCard.locator('button:has-text("Therapeut:in buchen")');
      await bookingButton.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      const { inPersonTime, onlineTime } = buildSlotTimes(14);

      // Select "Online" format
      await modal.locator('button:has-text("Online")').click();

      // Verify only online slot is visible
      await expect(modal.locator(`button:has-text("${onlineTime}")`).first()).toBeVisible();
      await expect(modal.locator(`button:has-text("${inPersonTime}")`)).not.toBeVisible();

      // Switch to "Vor Ort" format
      await modal.locator('button:has-text("Vor Ort")').click();

      // Verify only in-person slot is visible
      await expect(modal.locator(`button:has-text("${inPersonTime}")`).first()).toBeVisible();
      await expect(modal.locator(`button:has-text("${onlineTime}")`)).not.toBeVisible();
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });

  test('"Termin buchen" CTA is prominent and impossible to miss', async ({ page }) => {
    const { admin, created } = await seedSlots(15);
    try {
      await page.goto(`${base}/therapeuten`);
      await page.waitForLoadState('networkidle');

      const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
      const bookingButton = therapistCard.locator('button:has-text("Therapeut:in buchen")');
      await bookingButton.click();

      const modal = page.locator('[role="dialog"]');
      await modal.locator('button:has-text("Online")').click();

      const { onlineTime } = buildSlotTimes(15);
      await modal.locator(`button:has-text("${onlineTime}")`).first().click();

      const confirmButton = modal.locator('button:has-text("Termin buchen")');
      
      // Verify button is large (h-12 sm:h-14)
      const buttonBox = await confirmButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(48); // h-12 = 48px

      // Verify button has shadow (check class contains shadow-lg)
      const buttonClass = await confirmButton.getAttribute('class');
      expect(buttonClass).toContain('shadow-lg');
      expect(buttonClass).toContain('bg-emerald-600');
    } finally {
      await cleanupSlots(admin, created.map((s) => s.id));
    }
  });
});
