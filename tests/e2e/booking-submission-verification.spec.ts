import { test, expect } from '@playwright/test';

/**
 * E2E: Full Booking Submission + Verification Flow
 * 
 * Tests the complete journey from questionnaire → verification → booking
 * Critical for Test 2 launch readiness
 */

test.describe('Booking Submission + Verification (EARTH-233)', () => {
  const TEST_EMAIL = 'test+booking@kaufmann-health.de';
  const TEST_PHONE = '+4915112345678';

  test.beforeEach(async ({ page }) => {
    // Ensure feature flag is enabled
    // In CI: set NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true
  });

  test('completes full booking flow with email verification', async ({ page }) => {
    // 1. Submit questionnaire (email verification)
    await page.goto('/fragebogen');
    
    // Screen 1: Name + Email
    await page.fill('input[name="name"]', 'E2E Test User');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.click('button:has-text("Weiter")');
    
    // Screen 2: City + Session Preference
    await page.fill('input[name="city"]', 'Berlin');
    await page.click('label:has-text("Online")');
    await page.click('button:has-text("Weiter")');
    
    // Screen 3: Issue
    await page.fill('textarea[name="issue"]', 'Test issue for E2E booking');
    await page.click('button:has-text("Weiter")');
    
    // Screen 4: Time slots
    await page.click('label:has-text("Morgens")');
    await page.click('button:has-text("Weiter")');
    
    // Screen 5: Method preferences
    await page.click('label:has-text("NARM")');
    await page.click('button:has-text("Absenden")');
    
    // Should redirect to matches page with verification prompt
    await expect(page).toHaveURL(/\/matches\//);
    
    // 2. Mock verification API to auto-verify
    await page.route('**/api/public/verification/verify-code', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { verified: true, session_token: 'mock-session' },
          error: null,
        }),
      });
    });
    
    // 3. Enter verification code (auto-verifies in test mode)
    const codeInput = page.locator('input[type="text"]').first();
    await codeInput.fill('123456');
    await page.click('button:has-text("Bestätigen")');
    
    // Wait for verification to complete
    await page.waitForTimeout(1000);
    
    // 4. Should now see therapists with booking buttons
    await expect(page.locator('button:has-text("Termin buchen")')).toBeVisible({ timeout: 5000 });
    
    // 5. Click first available slot
    const firstBookingBtn = page.locator('button:has-text("Termin buchen")').first();
    await firstBookingBtn.click();
    
    // 6. Booking modal should open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=Termin buchen')).toBeVisible();
    
    // 7. Submit booking (form should be prefilled from verification)
    await page.click('button:has-text("Termin buchen")');
    
    // 8. Should see confirmation
    await expect(page.locator('text=Buchung bestätigt')).toBeVisible({ timeout: 5000 });
  });

  test('completes full booking flow with SMS verification', async ({ page }) => {
    // 1. Submit questionnaire (SMS verification)
    await page.goto('/fragebogen');
    
    // Screen 1: Name + Phone
    await page.fill('input[name="name"]', 'E2E SMS User');
    await page.click('button:has-text("Telefon")'); // Toggle to phone
    await page.fill('input[name="phone"]', TEST_PHONE);
    await page.click('button:has-text("Weiter")');
    
    // Continue through screens 2-5
    await page.fill('input[name="city"]', 'Berlin');
    await page.click('label:has-text("Online")');
    await page.click('button:has-text("Weiter")');
    
    await page.fill('textarea[name="issue"]', 'Test SMS verification');
    await page.click('button:has-text("Weiter")');
    
    await page.click('label:has-text("Morgens")');
    await page.click('button:has-text("Weiter")');
    
    await page.click('label:has-text("NARM")');
    await page.click('button:has-text("Absenden")');
    
    // Should redirect to matches with SMS verification
    await expect(page).toHaveURL(/\/matches\//);
    
    // 2. Mock SMS verification
    await page.route('**/api/public/verification/send-code', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { sent: true }, error: null }),
      });
    });
    
    await page.route('**/api/public/verification/verify-code', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { verified: true, session_token: 'mock-sms-session' },
          error: null,
        }),
      });
    });
    
    // 3. Enter SMS code
    const codeInput = page.locator('input[type="text"]').first();
    await codeInput.fill('654321');
    await page.click('button:has-text("Bestätigen")');
    
    await page.waitForTimeout(1000);
    
    // 4. Complete booking
    await expect(page.locator('button:has-text("Termin buchen")')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Termin buchen")').first().click();
    
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await page.click('button:has-text("Termin buchen")');
    
    // 5. Confirmation
    await expect(page.locator('text=Buchung bestätigt')).toBeVisible({ timeout: 5000 });
  });

  test('blocks booking attempt without verification', async ({ page }) => {
    // Navigate directly to matches page (no verification)
    await page.goto('/matches/mock-uuid-unverified');
    
    // Should show verification prompt instead of booking buttons
    await expect(page.locator('text=E-Mail bestätigen')).toBeVisible();
    
    // Booking buttons should not be clickable
    const bookingBtns = page.locator('button:has-text("Termin buchen")');
    await expect(bookingBtns).toHaveCount(0);
  });

  test('handles double-booking gracefully', async ({ page }) => {
    // Complete first booking
    await page.goto('/matches/mock-uuid-verified');
    
    // Mock session as verified
    await page.context().addCookies([{
      name: 'kh_session',
      value: 'mock-verified-session',
      domain: 'localhost',
      path: '/',
    }]);
    
    await page.reload();
    
    // Try to book the same slot twice
    await page.route('**/api/public/bookings', (route, request) => {
      const callCount = (global as any).__bookingCallCount || 0;
      (global as any).__bookingCallCount = callCount + 1;
      
      if (callCount === 0) {
        // First call succeeds
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { booking_id: 'booking-1' }, error: null }),
        });
      } else {
        // Second call fails (slot taken)
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Slot already booked' }),
        });
      }
    });
    
    // First booking
    await page.locator('button:has-text("Termin buchen")').first().click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await page.click('button:has-text("Termin buchen")');
    await expect(page.locator('text=Buchung bestätigt')).toBeVisible();
    
    // Try second booking on same slot
    await page.goto('/matches/mock-uuid-verified');
    await page.locator('button:has-text("Termin buchen")').first().click();
    await page.click('button:has-text("Termin buchen")');
    
    // Should show error
    await expect(page.locator('text=bereits gebucht')).toBeVisible();
  });

  test('mobile booking flow works smoothly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/fragebogen');
    
    // Complete questionnaire on mobile
    await page.fill('input[name="name"]', 'Mobile User');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.click('button:has-text("Weiter")');
    
    await page.fill('input[name="city"]', 'Berlin');
    await page.click('label:has-text("Online")');
    await page.click('button:has-text("Weiter")');
    
    await page.fill('textarea[name="issue"]', 'Mobile test');
    await page.click('button:has-text("Weiter")');
    
    await page.click('label:has-text("Morgens")');
    await page.click('button:has-text("Weiter")');
    
    await page.click('label:has-text("NARM")');
    await page.click('button:has-text("Absenden")');
    
    // Verify matches page renders on mobile
    await expect(page).toHaveURL(/\/matches\//);
    await expect(page.locator('h1')).toBeVisible();
    
    // Verification input should be accessible
    const codeInput = page.locator('input[type="text"]').first();
    await expect(codeInput).toBeVisible();
    
    // Touch target should be >= 44px
    const btnBox = await page.locator('button:has-text("Bestätigen")').boundingBox();
    expect(btnBox?.height).toBeGreaterThanOrEqual(44);
  });
});
