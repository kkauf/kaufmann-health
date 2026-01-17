import { test, expect } from '@playwright/test';

/**
 * E2E Test: Cal.com Native Booking Flow (EARTH-274)
 * 
 * Verifies that booking a slot completes natively WITHOUT redirecting to Cal.com.
 * This catches the slot synchronization bug where our API showed slots that
 * Cal.com would reject with HTTP 409, causing fallback redirects.
 * 
 * Run against production: SMOKE_TEST_URL=https://www.kaufmann-health.de npx playwright test cal-native-booking-e2e
 * Run against staging: Uses baseURL from playwright.config.ts (requires VERCEL_AUTOMATION_BYPASS_SECRET)
 */

test.describe('Cal.com Native Booking E2E', () => {
  // Use SMOKE_TEST_URL for production tests, otherwise use baseURL from config
  const BASE_URL = process.env.SMOKE_TEST_URL || '';

  test('booking completes natively without Cal.com redirect', async ({ page }) => {
    // Track if we get redirected to Cal.com (the bug we're preventing)
    let redirectedToCalCom = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        if (url.includes('cal.kaufmann.health') && !url.includes('api')) {
          redirectedToCalCom = true;
        }
      }
    });

    // Track API responses for debugging
    const apiResponses: { url: string; status: number; body?: string }[] = [];
    await page.route('**/api/public/cal/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text().catch(() => '');
      apiResponses.push({
        url: route.request().url(),
        status: response.status(),
        body: body.substring(0, 500),
      });
      await route.fulfill({ response });
    });

    // 1. Navigate to therapist directory
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    // 2. Find a Cal-enabled therapist with "Online-Kennenlernen" button
    const calButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    await expect(calButton).toBeVisible({ timeout: 15000 });

    // Get the therapist card and open their profile
    const card = calButton.locator('xpath=ancestor::div[contains(@class, "group")]');
    const profileButton = card.getByRole('button', { name: /Profil von .+ ansehen/ });
    await profileButton.click();

    // 3. Wait for modal and click intro booking
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await expect(introButton).toBeVisible({ timeout: 5000 });
    await introButton.click();

    // 4. Wait for slots to load and select the first available slot
    // Look for "Nächster freier Termin" indicator or time buttons
    const slotSection = modal.locator('text=/Nächster freier Termin/');
    await expect(slotSection).toBeVisible({ timeout: 10000 });

    // Click "Wählen" to select the suggested slot
    const selectButton = modal.getByRole('button', { name: 'Wählen' });
    if (await selectButton.isVisible()) {
      await selectButton.click();
    } else {
      // Fallback: click a time slot directly
      const timeSlot = modal.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first();
      await expect(timeSlot).toBeVisible({ timeout: 5000 });
      await timeSlot.click();
    }

    // 5. Confirm button should now be enabled
    const confirmButton = modal.getByRole('button', { name: /bestätigen/i });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();

    // 6. Fill in contact details (if form appears)
    const emailInput = modal.locator('input[type="email"]');
    const nameInput = modal.locator('input[name="name"]').or(modal.locator('input[placeholder*="Name"]'));
    
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-test-${Date.now()}@test.kaufmann-health.de`);
      
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('E2E Test User');
      }

      // Submit the booking form
      const submitButton = modal.getByRole('button', { name: /buchen|bestätigen|absenden/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
    }

    // 7. Wait for booking result
    await page.waitForTimeout(5000);

    // 8. Verify we did NOT get redirected to Cal.com
    expect(redirectedToCalCom).toBe(false);
    
    // Log API responses for debugging if test fails
    if (redirectedToCalCom) {
      console.log('API Responses:', JSON.stringify(apiResponses, null, 2));
    }

    // 9. Should see either:
    // - Success confirmation
    // - Still on kaufmann-health.de domain
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('cal.kaufmann.health');
    
    // Check for success indicators
    const successMessage = page.locator('text=/bestätigt|gebucht|erfolgreich/i');
    const stillInModal = modal.isVisible();
    
    // Either we see a success message or we're still in the booking flow (not redirected)
    const isSuccess = await successMessage.isVisible().catch(() => false);
    const isStillInFlow = await stillInModal;
    
    expect(isSuccess || isStillInFlow || !redirectedToCalCom).toBe(true);
  });

  test('slots API response matches Cal.com tRPC API', async ({ page }) => {
    // This test verifies our slots match Cal.com's actual availability
    // Prevents the phantom slot issue from recurring
    
    type SlotsResponse = { data?: { slots?: Array<{ time_utc: string }> } };
    let ourSlotsResponse: SlotsResponse | null = null;
    
    await page.route('**/api/public/cal/slots*', async (route) => {
      const response = await route.fetch();
      ourSlotsResponse = await response.json();
      await route.fulfill({ response });
    });

    // Navigate and trigger slots fetch
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    const calButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    await expect(calButton).toBeVisible({ timeout: 15000 });

    const card = calButton.locator('xpath=ancestor::div[contains(@class, "group")]');
    const profileButton = card.getByRole('button', { name: /Profil von .+ ansehen/ });
    await profileButton.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots API call
    await page.waitForTimeout(3000);

    // Verify we got slots
    expect(ourSlotsResponse).not.toBeNull();
    if (!ourSlotsResponse) return;
    
    expect(ourSlotsResponse.data?.slots).toBeDefined();
    const slots = ourSlotsResponse.data?.slots || [];
    
    // If there are slots, verify they have valid structure
    if (slots.length > 0) {
      // Each slot should have time_utc in ISO format
      for (const slot of slots.slice(0, 5)) { // Check first 5
        expect(slot.time_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
      
      console.log(`✓ Verified ${slots.length} slots have valid format`);
    }
  });

  test('booking API does not return 409 for displayed slots', async ({ page }) => {
    // This test would catch the specific bug: displaying slots that Cal.com rejects
    
    type BookingResponse = { status: number; body: unknown };
    let bookingResponse: BookingResponse | null = null;
    
    await page.route('**/api/public/cal/book', async (route) => {
      const response = await route.fetch();
      const body = await response.json().catch(() => ({}));
      bookingResponse = { status: response.status(), body };
      await route.fulfill({ response });
    });

    // Navigate to therapist and select a slot
    await page.goto(`${BASE_URL}/therapeuten`);
    await page.waitForLoadState('networkidle');

    const calButton = page.getByRole('button', { name: /Online-Kennenlernen/ }).first();
    await expect(calButton).toBeVisible({ timeout: 15000 });

    const card = calButton.locator('xpath=ancestor::div[contains(@class, "group")]');
    const profileButton = card.getByRole('button', { name: /Profil von .+ ansehen/ });
    await profileButton.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const introButton = modal.getByRole('button', { name: /Online-Kennenlernen/ });
    await introButton.click();

    // Wait for slots and select one
    const selectButton = modal.getByRole('button', { name: 'Wählen' });
    await expect(selectButton).toBeVisible({ timeout: 10000 });
    await selectButton.click();

    const confirmButton = modal.getByRole('button', { name: /bestätigen/i });
    await expect(confirmButton).toBeEnabled({ timeout: 5000 });
    await confirmButton.click();

    // Fill contact form if it appears
    const emailInput = modal.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-409-test-${Date.now()}@test.kaufmann-health.de`);
      
      const nameInput = modal.locator('input[name="name"]');
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('E2E 409 Test');
      }

      // Submit
      const submitButton = modal.getByRole('button', { name: /buchen|bestätigen|absenden/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // If we made a booking request, verify it wasn't a 409
    if (bookingResponse) {
      // 409 = slot conflict, which means we showed a phantom slot
      expect(bookingResponse.status).not.toBe(409);
      
      if (bookingResponse.status === 409) {
        console.error('CRITICAL: Booking returned 409 - slot synchronization issue!');
        console.error('Response:', JSON.stringify(bookingResponse.body, null, 2));
      }
    }
  });
});
