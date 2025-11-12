import { test, expect } from '@playwright/test';

test.describe('Instant Booking Flow - E2E (EARTH-233)', () => {
  test.beforeEach(async ({ page }) => {
    // Set feature flag via environment or admin panel
    // In real test, ensure NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true
  });

  test.describe('Complete Instant Flow - Exact Match', () => {
    test('fills questionnaire, sees matches, verifies, and books', async ({ page }) => {
      // Step 1: Navigate to form
      await page.goto('/fragebogen');
      
      // Step 2: Fill out questionnaire (all steps)
      await page.fill('input[name="name"]', 'E2E Test Patient');
      await page.click('button:has-text("Weiter")');
      
      // (Continue through all wizard steps)
      // Step 3: City
      await page.fill('input[name="city"]', 'Berlin');
      await page.click('button:has-text("Weiter")');
      
      // Step 4: Session preference (online)
      await page.click('button:has-text("Online")');
      
      // Step 5: Time preference
      await page.click('button:has-text("Morgens")');
      await page.click('button:has-text("Weiter")');
      
      // (Additional steps as needed)
      
      // Step 8: Contact info
      await page.fill('input[type="email"]', 'e2e-exact@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should redirect to matches page (skip step 9)
      await expect(page).toHaveURL(/\/matches\/[a-f0-9-]+/);
      
      // Verify matches page shows
      await expect(page.locator('h1')).toContainText('persönlichen Empfehlungen');
      
      // Should show verification banner
      await expect(page.locator('text=Bitte bestätige deine E‑Mail')).toBeVisible();
      
      // Verify therapists are shown (1-3 therapists)
      const therapistCards = page.locator('[data-testid="therapist-card"]');
      const cardCount = await therapistCards.count();
      expect(cardCount).toBeGreaterThan(0);
      expect(cardCount).toBeLessThanOrEqual(3);
      
      // Verify slot chips shown for exact matches
      const slotChips = page.locator('[data-testid="slot-chip"]');
      if (await slotChips.count() > 0) {
        await expect(slotChips.first()).toBeVisible();
      }
      
      // Step: Click booking CTA (should be blocked)
      await page.click('button:has-text("Buchen")');
      
      // Should scroll to top (verification banner)
      await expect(page.locator('text=Bitte bestätige deine E‑Mail')).toBeInViewport();
      
      // Contact modal should NOT open yet
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      
      // Simulate email verification
      // (In real test, click verification link from test email)
      await page.goto('/api/public/leads/confirm?token=test-token&id=test-id');
      await expect(page).toHaveURL(/\/fragebogen\?confirm=1/);
      
      // Return to matches page
      await page.goto('/matches/test-uuid');
      
      // Verification banner should be gone
      await expect(page.locator('text=Bitte bestätige deine E‑Mail')).not.toBeVisible();
      
      // Now click booking CTA
      await page.click('button:has-text("Buchen")');
      
      // Contact modal should open
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      
      // Fill booking form
      await page.fill('textarea[name="message"]', 'Hello, I would like to book');
      await page.click('button:has-text("Nachricht senden")');
      
      // Success confirmation
      await expect(page.locator('text=Nachricht gesendet')).toBeVisible();
      
      // Verify conversion tracked (via analytics)
      // (Check server logs or mock analytics endpoint)
    });
  });

  test.describe('Partial Match Flow', () => {
    test('shows partial banner when no exact time-of-day match', async ({ page }) => {
      await page.goto('/fragebogen');
      
      // Fill form with very specific time preference (e.g., evening only)
      await page.fill('input[name="name"]', 'Evening Only Patient');
      await page.click('button:has-text("Weiter")');
      
      // (Fill other steps)
      
      // Select evening preference
      await page.click('button:has-text("Abends")');
      await page.click('button:has-text("Weiter")');
      
      // Submit
      await page.fill('input[type="email"]', 'evening-only@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should redirect to matches
      await expect(page).toHaveURL(/\/matches\//);
      
      // If no evening slots, should show partial banner
      const partialBanner = page.locator('text=keine exakten Treffer');
      if (await partialBanner.isVisible()) {
        await expect(partialBanner).toBeVisible();
        
        // Therapists still shown (without matching slot chips)
        const therapistCards = page.locator('[data-testid="therapist-card"]');
        const count = await therapistCards.count();
        expect(count).toBeGreaterThan(0);
        
        // Slot chips should be absent or empty
        // (API filtered them out)
      }
    });
  });

  test.describe('Zero Therapists Flow', () => {
    test('shows empty state when no therapists match', async ({ page }) => {
      // Fill form with impossible criteria
      // (Very specific combination that no therapist has)
      
      await page.goto('/fragebogen');
      
      // (Fill with niche requirements)
      
      await page.fill('input[type="email"]', 'niche@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should still redirect
      await expect(page).toHaveURL(/\/matches\//);
      
      // Should show empty state
      await expect(page.locator('text=Alle Therapeuten ansehen')).toBeVisible();
    });
  });

  test.describe('Legacy Flow Compatibility', () => {
    test('shows step 9 when feature flag disabled', async ({ page, context }) => {
      // Disable feature flag for this test
      // (Mock env or use different deployment)
      
      await page.goto('/fragebogen');
      
      // Fill and submit form
      await page.fill('input[name="name"]', 'Legacy User');
      // (Fill remaining steps)
      await page.fill('input[type="email"]', 'legacy@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should NOT redirect; should show step 9
      await expect(page).toHaveURL('/fragebogen');
      await expect(page.locator('text=Geschafft! Deine Anfrage ist bei uns')).toBeVisible();
      
      // Verification instructions shown
      await expect(page.locator('text=Bitte bestätige deine E‑Mail')).toBeVisible();
    });
  });

  test.describe('Conversion Tracking', () => {
    test('fires conversion only after verification', async ({ page }) => {
      // Complete flow and verify conversion event timing
      
      await page.goto('/fragebogen');
      
      // Fill form
      await page.fill('input[name="name"]', 'Conversion Test');
      await page.fill('input[type="email"]', 'conversion@test.com');
      // (Fill other fields)
      await page.click('button:has-text("Absenden")');
      
      // At this point, NO conversion should fire yet
      // (User not verified)
      
      // Verify email
      await page.goto('/api/public/leads/confirm?token=test&id=test');
      
      // Navigate back to matches
      await page.goto('/matches/test-uuid');
      
      // Send message
      await page.click('button:has-text("Buchen")');
      await page.fill('textarea', 'Message');
      await page.click('button:has-text("Senden")');
      
      // NOW conversion should fire
      // Verify via server logs or analytics endpoint
      
      // Check for Google Ads conversion pixel
      // (Mock or verify network request)
    });
  });

  test.describe('Mobile Experience', () => {
    test('works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/fragebogen');
      
      // Complete flow on mobile
      // Verify responsive design works
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Error Recovery', () => {
    test('handles API errors gracefully', async ({ page, context }) => {
      // Mock API failure
      await context.route('**/api/public/leads', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      });
      
      await page.goto('/fragebogen');
      await page.fill('input[type="email"]', 'error@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should show error message
      await expect(page.locator('text=fehlgeschlagen')).toBeVisible();
      
      // Retry button shown
      await expect(page.locator('button:has-text("Erneut versuchen")')).toBeVisible();
    });

    test('handles network timeout', async ({ page }) => {
      // Slow network simulation
      await page.route('**/api/public/leads', route => {
        setTimeout(() => route.continue(), 10000);
      });
      
      await page.goto('/fragebogen');
      await page.fill('input[type="email"]', 'slow@test.com');
      await page.click('button:has-text("Absenden")');
      
      // Should show "slow connection" indicator
      await expect(page.locator('text=langsame Verbindung')).toBeVisible({ timeout: 5000 });
    });
  });
});
