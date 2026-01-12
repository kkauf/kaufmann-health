import { test, expect } from '@playwright/test';

/**
 * E2E Smoke Test: Cal.com Slot Display
 * 
 * Quick production smoke test that verifies Cal.com slots are displaying
 * correctly on the therapist directory. This catches regressions in:
 * - Cal.com database connection
 * - Slot caching
 * - Frontend slot rendering
 * 
 * Run against production: SMOKE_TEST_URL=https://www.kaufmann-health.de npx playwright test cal-slots-smoke
 * Run against staging: Uses baseURL from playwright.config.ts
 */

test.describe('Cal.com Slots Smoke Test', () => {
  // Use SMOKE_TEST_URL for production tests, otherwise use baseURL from config
  const BASE_URL = process.env.SMOKE_TEST_URL || '';

  test('therapist directory shows Cal.com slots on cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Check that at least one therapist card shows a next intro slot
    const slotIndicator = page.locator('text=/Nächster Intro-Termin:/').first();
    
    // Should find at least one slot indicator within 10 seconds
    await expect(slotIndicator).toBeVisible({ timeout: 10000 });

    // Verify slot format (e.g., "Di 13. Jan um 10:00")
    const slotText = await slotIndicator.textContent();
    expect(slotText).toMatch(/\d{1,2}:\d{2}/); // Contains time HH:MM
  });

  test('clicking intro booking shows slot picker with available times', async ({ page }) => {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Find first therapist card button (accessible name includes "Profil von ... ansehen")
    const therapistCard = page.getByRole('button', { name: /Profil von .+ ansehen/ }).first();
    await expect(therapistCard).toBeVisible({ timeout: 10000 });
    await therapistCard.click();

    // Wait for modal to open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click the intro booking button
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await expect(introButton).toBeVisible({ timeout: 5000 });
    await introButton.click();

    // Should show slot picker with dates
    const slotPicker = modal.locator('text=/Nächster freier Termin:/');
    await expect(slotPicker).toBeVisible({ timeout: 10000 });

    // Should show "Wählen" button or date buttons with slot counts
    const selectButton = modal.getByRole('button', { name: 'Wählen' });
    const dateButtons = modal.getByRole('button', { name: /\d+ Termine/ });
    
    const hasSelectButton = await selectButton.isVisible().catch(() => false);
    const hasDateButtons = await dateButtons.first().isVisible().catch(() => false);
    
    expect(hasSelectButton || hasDateButtons).toBe(true);
  });

  test('selecting a slot enables confirmation button', async ({ page }) => {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Open therapist profile
    const therapistCard = page.getByRole('button', { name: /Profil von .+ ansehen/ }).first();
    await expect(therapistCard).toBeVisible({ timeout: 10000 });
    await therapistCard.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click intro booking
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots to load
    await page.waitForTimeout(2000);

    // Click "Wählen" to select the first available slot
    const selectButton = modal.getByRole('button', { name: 'Wählen' });
    if (await selectButton.isVisible()) {
      await selectButton.click();
      
      // Confirmation button should become enabled
      const confirmButton = modal.getByRole('button', { name: 'Termin bestätigen' });
      await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    } else {
      // If no "Wählen" button, try clicking a time slot directly
      const timeSlot = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
      await timeSlot.click();
      
      // Confirmation button should become enabled after slot selection
      const confirmButton = modal.getByRole('button', { name: 'Termin bestätigen' });
      await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    }
  });

  test('slot picker shows multiple days of availability', async ({ page }) => {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Open therapist profile
    const therapistCard = page.getByRole('button', { name: /Profil von .+ ansehen/ }).first();
    await expect(therapistCard).toBeVisible({ timeout: 10000 });
    await therapistCard.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click intro booking
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots
    await page.waitForTimeout(2000);

    // Should show multiple date options (buttons with "X Termine" text)
    const dateButtons = modal.getByRole('button', { name: /\d+ Termine/ });
    const dateCount = await dateButtons.count();
    
    // Should have at least 2 days of availability
    expect(dateCount).toBeGreaterThanOrEqual(2);
  });

  test('API returns slots in expected format', async ({ page }) => {
    // Intercept the slots API to verify response format
    let slotsResponse: unknown = null;
    
    await page.route('**/api/public/cal/slots*', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      slotsResponse = json;
      await route.fulfill({ response });
    });

    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Open therapist and trigger slots fetch
    const therapistCard = page.getByRole('button', { name: /Profil von .+ ansehen/ }).first();
    await expect(therapistCard).toBeVisible({ timeout: 10000 });
    await therapistCard.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for API call
    await page.waitForTimeout(3000);

    // Verify response structure if we captured it
    if (slotsResponse) {
      const resp = slotsResponse as { data?: { slots?: unknown[] } };
      expect(resp).toHaveProperty('data');
      expect(resp.data).toHaveProperty('slots');
      expect(Array.isArray(resp.data?.slots)).toBe(true);
      
      // If there are slots, verify structure
      const slots = resp.data?.slots as Array<{ date_iso?: string; time_label?: string }> | undefined;
      if (slots && slots.length > 0) {
        expect(slots[0]).toHaveProperty('date_iso');
        expect(slots[0]).toHaveProperty('time_label');
      }
    }
  });
});
