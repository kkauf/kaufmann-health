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

/**
 * NOTE: These tests were designed for the anonymous 5-step flow where
 * DIRECT_BOOKING_FLOW=true would skip contact verification. That flow
 * was removed - needsVerificationFlow is now hardcoded to true in SignupWizard,
 * meaning ALL flows require 9 steps with contact info + verification.
 * 
 * The tests below verify the post-verification booking modal experience
 * on the /matches page, not the questionnaire-to-redirect flow.
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
    await page.waitForTimeout(1000);
    const schwerpunkteVisible = await page.getByText(/Was beschäftigt dich/i).isVisible().catch(() => false);
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);
    
    if (schwerpunkteVisible) {
      // SHOW_SCHWERPUNKTE=true flow: skip Schwerpunkte selection
      await page.getByRole('button', { name: /Überspringen/i }).click();
    } else if (whatBringsYouVisible) {
      // SHOW_SCHWERPUNKTE=false flow: fill required text and continue
      await page.getByLabel(/Was bringt dich zur Therapie/i).fill('E2E Test: kurzbeschreibung');
      await page.getByRole('button', { name: 'Weiter →' }).click();
    }
    
    // Step 3: Modality - wait for it and select "Nein"
    await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    const noBtn = page.getByRole('button', { name: /^Nein/i });
    await expect(noBtn).toBeEnabled();
    await noBtn.click();
    
    // Step 4: Location/Session preference
    await expect(page.getByText(/Wie möchtest du die Sitzungen machen\?/i)).toBeVisible({ timeout: 8000 });
    const onlineBtn = page.getByRole('button', { name: /Online \(Video\)/i });
    await expect(onlineBtn).toBeEnabled();
    await onlineBtn.click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    
    // Step 5: Time preferences
    await expect(page.getByText(/Wann hast du Zeit/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Bin flexibel' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    
    // Note: With DIRECT_BOOKING_FLOW=true, the wizard submits after step 5
    // and redirects to /matches. Verification happens in ContactModal there.
  }

  test.beforeEach(async ({ page }) => {
    // Skip all tests - the anonymous 5-step flow was removed.
    // needsVerificationFlow is hardcoded to true, so questionnaire always goes
    // through 9 steps with contact collection. These tests need refactoring.
    test.skip(true, 'Anonymous 5-step flow removed - needsVerificationFlow is now always true');

    await page.addInitScript(() => {
      try {
        localStorage.removeItem('kh_wizard_data');
        localStorage.removeItem('kh_wizard_step');
        localStorage.removeItem('kh_form_session_id');
        localStorage.removeItem('anonymousPatientId');
      } catch {}
    });
  });

  test('completes full booking flow with email verification', async ({ page }) => {
    // Stub questionnaire → matches
    await page.route('**/api/public/questionnaire-submit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patientId: 'p1', matchesUrl: '/matches/test-uuid', matchQuality: 'exact' }, error: null }) }));
    await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patient: { status: 'anonymous' }, therapists: [{ id: 't1', first_name: 'Silvia', last_name: 'Hoffmann', city: 'Berlin', accepting_new: true, session_preferences: ['online','in_person'], availability: [{ date_iso: '2099-12-30', time_label: '10:00', format: 'online' }] }], metadata: { match_type: 'exact' } }, error: null }) }));

    // Use restart=1 to clear localStorage and start fresh
    await page.goto('/fragebogen?restart=1');
    await completeQuestionnaire(page);

    await expect(page).toHaveURL(/\/matches\/test-uuid$/);
    const bookBtn = page.getByRole('button', { name: /Direkt buchen/i });
    await expect(bookBtn).toBeVisible();
    await bookBtn.click();
    await expect(page.getByTestId('contact-modal')).toBeVisible();

    const modal = page.getByTestId('contact-modal');
    await modal.locator('button[title="Online"]').first().click();
    await modal.getByRole('button', { name: /Weiter zur Eingabe/i }).click();
    await expect(modal.getByLabel(/Name/i)).toBeVisible({ timeout: 8000 });
  });

  test('completes full booking flow with SMS verification', async ({ page }) => {
    await page.route('**/api/public/questionnaire-submit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patientId: 'p2', matchesUrl: '/matches/test-uuid', matchQuality: 'exact' }, error: null }) }));
    await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { patient: { status: 'anonymous' }, therapists: [{ id: 't2', first_name: 'Alex', last_name: 'Mustermann', city: 'Berlin', accepting_new: true, session_preferences: ['online'], availability: [{ date_iso: '2099-12-30', time_label: '10:00', format: 'online' }] }], metadata: { match_type: 'exact' } }, error: null }) }));

    // Use restart=1 to clear localStorage and start fresh
    await page.goto('/fragebogen?restart=1');
    await completeQuestionnaire(page);

    await expect(page).toHaveURL(/\/matches\/test-uuid$/);
    const bookBtn2 = page.getByRole('button', { name: /Direkt buchen/i }).first();
    await expect(bookBtn2).toBeVisible();
    await bookBtn2.click();
    await expect(page.getByTestId('contact-modal')).toBeVisible();

    const modal = page.getByTestId('contact-modal');
    await modal.locator('button[title="Online"]').first().click();
    await modal.getByRole('button', { name: /Weiter zur Eingabe/i }).click();
    await expect(modal.getByLabel(/Name/i)).toBeVisible({ timeout: 8000 });
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
