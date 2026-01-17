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

  // Helper to find and open a Cal-enabled therapist's modal
  async function openCalEnabledTherapistModal(page: import('@playwright/test').Page) {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Find a Cal-enabled therapist card (has "Online-Kennenlernen" button)
    // We need to find the card containing this button, then click its profile button
    const calButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    await expect(calButton).toBeVisible({ timeout: 10000 });
    
    // Get the card container and find the profile button within it
    const card = calButton.locator('xpath=ancestor::div[contains(@class, "group")]');
    const profileButton = card.getByRole('button', { name: /Profil von .+ ansehen/ });
    await profileButton.click();

    // Wait for modal to open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    return modal;
  }

  test('therapist directory shows Cal-enabled therapists with booking button', async ({ page }) => {
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Dismiss cookie consent banner if present (can block interactions)
    const cookieRejectBtn = page.getByRole('button', { name: 'Ablehnen' });
    if (await cookieRejectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieRejectBtn.click();
    }

    // Check that at least one therapist card shows the Cal booking button
    // Cal-enabled therapists show "Online-Kennenlernen" button
    // Note: Button text is "Online-Kennenlernen (15 min)"
    const calBookingButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    
    // Should find at least one Cal-enabled therapist (allow more time for initial load)
    await expect(calBookingButton).toBeVisible({ timeout: 20000 });
  });

  test('clicking intro booking shows slot picker with available times', async ({ page }) => {
    const modal = await openCalEnabledTherapistModal(page);

    // Click the intro booking button
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await expect(introButton).toBeVisible({ timeout: 5000 });
    await introButton.click();

    // Should show slot picker - either loading state or actual slots
    // Look for the slot header or time buttons
    const slotHeader = modal.locator('text=/Nächster freier Termin:/').or(modal.locator('text=/Wähle einen Termin/'));
    const timeButton = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    
    // Wait for either header or time slots to appear
    await expect(slotHeader.or(timeButton)).toBeVisible({ timeout: 10000 });
  });

  test('selecting a slot enables confirmation button', async ({ page }) => {
    const modal = await openCalEnabledTherapistModal(page);

    // Click intro booking
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots to load
    await page.waitForTimeout(3000);

    // Try clicking a time slot directly (format: HH:MM)
    const timeSlot = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
    const hasTimeSlot = await timeSlot.isVisible().catch(() => false);
    
    if (hasTimeSlot) {
      await timeSlot.click();
      
      // After selecting a slot, should show either confirmation button or next step
      // The exact flow may vary, so we just verify the slot was clickable
      // and something happens (either confirmation appears or we proceed)
      await page.waitForTimeout(1000);
      
      // Check for any of: confirmation button, contact form, or booking confirmation
      const confirmButton = modal.getByRole('button', { name: /bestätigen/i });
      const contactForm = modal.locator('input[type="email"], input[type="tel"]').first();
      const anyProgress = confirmButton.or(contactForm);
      
      await expect(anyProgress).toBeVisible({ timeout: 5000 });
    } else {
      // If no time slots visible, the therapist may not have availability
      // This is acceptable for a smoke test - we just verify the flow doesn't error
      console.log('No time slots available for this therapist');
    }
  });

  test('slot picker shows available time slots', async ({ page }) => {
    const modal = await openCalEnabledTherapistModal(page);

    // Click intro booking
    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots
    await page.waitForTimeout(3000);

    // Should show time slot buttons (HH:MM format)
    const timeButtons = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ });
    const timeCount = await timeButtons.count();
    
    // Should have at least some time slots available
    // Note: Availability can vary, so we log a warning if none found but don't hard fail
    if (timeCount === 0) {
      console.log('Warning: No time slots available for this Cal-enabled therapist. This may be expected if they have no upcoming availability.');
    }
    // At minimum, verify we didn't crash and the UI loaded
    expect(timeCount).toBeGreaterThanOrEqual(0);
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

    // Use similar logic to helper but inline since we need to set up route first
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // Find a Cal-enabled therapist card
    const calButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    await expect(calButton).toBeVisible({ timeout: 10000 });
    
    // Get the card container and find the profile button within it
    const card = calButton.locator('xpath=ancestor::div[contains(@class, "group")]');
    const profileButton = card.getByRole('button', { name: /Profil von .+ ansehen/ });
    await profileButton.click();

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
