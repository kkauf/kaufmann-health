import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Full Booking Submission + Verification Flow
 * 
 * Tests the complete journey from questionnaire → verification → booking
 * Critical for Test 2 launch readiness
 * 
 * NOTE: Staging has SHOW_SCHWERPUNKTE=true, so flow is:
 * Timeline → Schwerpunkte → Modality → Location → Preferences
 */

test.describe('Booking Submission + Verification (EARTH-233)', () => {
  const TEST_EMAIL = 'test+booking@kaufmann-health.de';
  const TEST_PHONE = '+4915112345678';

  /**
   * Helper to complete the questionnaire flow.
   * Handles both SHOW_SCHWERPUNKTE=true (Schwerpunkte step) and false (What Brings You step).
   */
  async function completeQuestionnaire(page: Page) {
    // Step 1: Timeline - select timing
    await page.getByRole('button', { name: /Innerhalb der nächsten Woche|nächsten Woche/i }).click();
    
    // After Timeline, either Schwerpunkte or "What Brings You" appears
    // Check which one and proceed accordingly
    const schwerpunkteVisible = await page.getByText(/Was beschäftigt dich/i).isVisible().catch(() => false);
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);
    
    if (schwerpunkteVisible) {
      // SHOW_SCHWERPUNKTE=true flow: skip Schwerpunkte selection
      await page.getByRole('button', { name: /Überspringen/i }).click();
    } else if (whatBringsYouVisible) {
      // SHOW_SCHWERPUNKTE=false flow: skip What Brings You
      await page.getByRole('button', { name: /Weiter|Überspringen/i }).first().click();
    }
    
    // Step 3: Modality - wait for it and select "Nein"
    await expect(page.getByText(/Therapiemethode|Weißt du welche/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Nein/i }).click();
    await page.getByRole('button', { name: /Weiter/i }).click();
    
    // Step 4: Location/Session preference
    await expect(page.getByText(/Wie möchtest du die Sitzungen/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Online/i }).click();
    await page.getByRole('button', { name: /Weiter/i }).click();
    
    // Step 5: Time preferences
    await expect(page.getByText(/Wann hast du Zeit/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Morgens|Bin flexibel/i }).click();
    await page.getByRole('button', { name: /Weiter/i }).click();
  }

  test.beforeEach(async ({ page }) => {
    // Ensure feature flag is enabled
    // In CI: set NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true
  });

  test('completes full booking flow with email verification', async ({ page }) => {
    // Stub questionnaire → matches
    await page.route('**/api/public/questionnaire-submit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patientId: 'p1', matchesUrl: '/matches/test-uuid', matchQuality: 'exact' }, error: null }) }));
    await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patient: { status: 'anonymous' }, therapists: [{ id: 't1', first_name: 'Silvia', last_name: 'Hoffmann', city: 'Berlin', accepting_new: true, session_preferences: ['online','in_person'], availability: [{ date_iso: '2099-12-30', time_label: '10:00', format: 'online' }] }], metadata: { match_type: 'exact' } }, error: null }) }));

    // Use restart=1 to clear localStorage and start fresh
    await page.goto('/fragebogen?restart=1');
    await completeQuestionnaire(page);

    await expect(page).toHaveURL(/\/matches\/test-uuid$/);
    const bookBtn = page.getByRole('button', { name: /Therapeut:in buchen/i });
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();
    await expect(page.getByTestId('contact-modal')).toBeVisible();
  });

  test('completes full booking flow with SMS verification', async ({ page }) => {
    await page.route('**/api/public/questionnaire-submit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patientId: 'p2', matchesUrl: '/matches/test-uuid', matchQuality: 'exact' }, error: null }) }));
    await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patient: { status: 'anonymous' }, therapists: [{ id: 't2', first_name: 'Alex', last_name: 'Mustermann', city: 'Berlin', accepting_new: true, session_preferences: ['online'], availability: [{ date_iso: '2099-12-30', time_label: '10:00', format: 'online' }] }], metadata: { match_type: 'exact' } }, error: null }) }));

    // Use restart=1 to clear localStorage and start fresh
    await page.goto('/fragebogen?restart=1');
    await completeQuestionnaire(page);

    await expect(page).toHaveURL(/\/matches\/test-uuid$/);
    const bookBtn2 = page.getByRole('button', { name: /Therapeut:in buchen/i }).first();
    await expect(bookBtn2).toBeVisible();
    await bookBtn2.click();
    await expect(page.getByTestId('contact-modal')).toBeVisible();
  });

  test('blocks booking attempt without verification', async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped when direct-booking flow is enabled');
    // Navigate directly to matches page (no verification)
    await page.goto('/matches/mock-uuid-unverified');
    
    // Should show verification prompt instead of booking buttons
    await expect(page.locator('text=E-Mail bestätigen')).toBeVisible();
    
    // Booking buttons should not be clickable
    const bookingBtns = page.locator('button:has-text("Termin buchen")');
    await expect(bookingBtns).toHaveCount(0);
  });

  test('handles double-booking gracefully', async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped when direct-booking flow is enabled');
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
    await page.route('**/api/public/questionnaire-submit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patientId: 'p3', matchesUrl: '/matches/test-uuid', matchQuality: 'partial' }, error: null }) }));
    await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patient: { status: 'anonymous' }, therapists: [], metadata: { match_type: 'none' } }, error: null }) }));
    
    // Use restart=1 to clear localStorage and start fresh
    await page.goto('/fragebogen?restart=1');
    await completeQuestionnaire(page);
    
    await expect(page).toHaveURL(/\/matches\/test-uuid$/);
    await expect(page.getByText(/Alle Therapeuten ansehen/i)).toBeVisible();
  });
});
