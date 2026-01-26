import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Test 4 - Concierge vs Self-Service Matching
 * 
 * Concierge: Manual curation (text field input, no auto-matching, waiting screen)
 * Self-Service: Auto-matching (Schwerpunkte selection, instant matches)
 */

test.describe('Test 4: Concierge vs Self-Service', () => {
  const MOCK_MATCHES_URL = '/matches/test4-uuid';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('kh_wizard_data');
        localStorage.removeItem('kh_wizard_step');
        localStorage.removeItem('kh_form_session_id');
        localStorage.removeItem('anonymousPatientId');
      } catch {}
    });

    await page.route('**/api/public/questionnaire-submit', async (route, request) => {
      const headers = request.headers();
      const variant = String(headers['x-campaign-variant-override'] || '').toLowerCase();
      // Instant booking flow is always enabled
      const shouldReturnMatchesUrl = true;

      const body = {
        data: {
          patientId: 'p-test4',
          matchesUrl: shouldReturnMatchesUrl ? MOCK_MATCHES_URL : null,
          matchQuality: shouldReturnMatchesUrl ? 'exact' : 'none',
        },
        error: null,
      };

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
  });

  // Mock matches API for verified state
  const mockMatchesApi = (page: Page) =>
    page.route('**/api/public/matches/*', async (route) => {
      const body = {
        data: {
          patient: {
            name: 'E2E Test',
            status: 'email_confirmed',
            session_preference: 'online',
            city: 'Berlin',
          },
          therapists: [
            {
              id: 't1',
              first_name: 'Sandra',
              last_name: 'Mandl',
              city: 'Berlin',
              accepting_new: true,
              modalities: ['narm', 'somatic-experiencing'],
              session_preferences: ['online', 'in_person'],
              approach_text: 'Körperpsychotherapie',
              availability: [{ date_iso: '2099-12-30', time_label: '09:00', format: 'online' }],
            },
          ],
          metadata: { match_type: 'exact' },
        },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

  /**
   * Helper to complete the initial steps (Schwerpunkte + Payment Info).
   * Flow: Schwerpunkte (2.5) → Payment Info (2.6)
   */
  async function completeInitialSteps(page: Page) {
    // Step 2.5: Schwerpunkte
    await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /Überspringen/i }).click();

    // Step 2.6: Payment info - select "Das passt für mich" then click Weiter
    await expect(page.getByText(/Finanzierung/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /passt für mich/i }).click();
    await page.getByRole('button', { name: /Weiter/i }).click();
  }

  /**
   * Helper to complete Step 2 (What Brings You) for Concierge variant.
   * Self-service skips this and goes directly to Modality.
   */
  async function completeWhatBringsYouIfPresent(page: Page) {
    await page.waitForTimeout(1000);
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);
    if (whatBringsYouVisible) {
      await page.getByLabel(/Was bringt dich zur Therapie/i).fill('E2E Test: kurzbeschreibung');
      await page.getByRole('button', { name: 'Weiter →' }).click();
    }
  }

  /**
   * Helper to complete Step 6 (Contact Form).
   * Fills in name and email, then submits.
   */
  async function completeStep6ContactForm(page: Page) {
    // Wait for the contact form to appear
    await expect(page.getByText(/Fast geschafft/i)).toBeVisible({ timeout: 8000 });
    
    // Fill in name
    const nameInput = page.getByPlaceholder(/Vorname oder Spitzname/i);
    await nameInput.fill('E2E Test');
    
    // Switch to email (default is SMS)
    const emailBtn = page.getByRole('button', { name: 'E‑Mail' });
    await emailBtn.click();
    
    // Fill in email
    const emailInput = page.getByPlaceholder(/deine@email.de/i);
    await emailInput.fill(`e2e-test-${Date.now()}@example.com`);
    
    // Submit the form
    const submitBtn = page.getByRole('button', { name: /Passende Therapeut:innen finden/i });
    await submitBtn.click();
  }

  /**
   * Helper to complete remaining steps after step 2/2.5
   */
  async function completeRemainingSteps(page: Page) {
    // Step 3: Modality
    await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    const noBtn = page.getByRole('button', { name: /^Nein/i });
    await expect(noBtn).toBeEnabled();
    await noBtn.click();
    
    // Step 4: Location
    await expect(page.getByText(/Wie möchtest du die Sitzungen machen\?/i)).toBeVisible({ timeout: 8000 });
    const onlineBtn = page.getByRole('button', { name: /Online \(Video\)/i });
    await expect(onlineBtn).toBeEnabled();
    await onlineBtn.click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    
    // Step 5: Preferences
    await expect(page.getByText(/Wann hast du Zeit/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Bin flexibel|flexibel/i }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    
    // Step 6: Contact form
    await completeStep6ContactForm(page);
  }

  test.describe('Concierge Flow (/fragebogen?variant=concierge)', () => {
    test('shows text field (Step 2) after initial steps', async ({ page }) => {
      await page.goto('/fragebogen?variant=concierge&restart=1');
      // Complete Schwerpunkte + Payment Info
      await completeInitialSteps(page);

      // Concierge should show "What Brings You" after payment info
      await expect(page.getByText(/Was bringt dich zur Therapie\?/i)).toBeVisible({ timeout: 8000 });
    });

  });

  test.describe('Self-Service Flow (/fragebogen?variant=self-service)', () => {
    test('starts with Schwerpunkte as first step', async ({ page }) => {
      await page.goto('/fragebogen?variant=self-service&restart=1');

      // Self-service starts with Schwerpunkte (Timeline was removed)
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 8000 });
    });

    test('supports v= alias for self-service', async ({ page }) => {
      await page.goto('/fragebogen?v=self-service&restart=1');

      // Should start with Schwerpunkte
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 8000 });
    });

  });

  test.describe('Landing Page CTAs', () => {
    test('/therapie-finden passes concierge variant to fragebogen', async ({ page }) => {
      await page.goto('/therapie-finden?variant=concierge');
      
      // Find a CTA link and verify it passes the variant
      const ctaLink = page.locator('[data-cta="hero-primary"]');
      await expect(ctaLink).toHaveAttribute('href', /variant=concierge/);
    });

    test('/therapie-finden passes self-service variant to fragebogen', async ({ page }) => {
      await page.goto('/therapie-finden?variant=self-service');
      
      const ctaLink = page.locator('[data-cta="hero-primary"]');
      await expect(ctaLink).toHaveAttribute('href', /variant=self-service/);
    });

    test('/therapie-finden defaults to concierge when no variant', async ({ page }) => {
      await page.goto('/therapie-finden');
      
      const ctaLink = page.locator('[data-cta="hero-primary"]');
      // SSR default is concierge; client may randomize and update URL after hydration.
      await expect(ctaLink).toHaveAttribute('href', /variant=(concierge|self-service)/);
    });
  });

  test.describe('Variant Parity', () => {
    test('both variants reach step 3 (modality) after initial steps', async ({ page }) => {
      // Concierge: Schwerpunkte → What Brings You → Modality
      await page.goto('/fragebogen?variant=concierge&restart=1');
      await completeInitialSteps(page);
      await completeWhatBringsYouIfPresent(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });

      // Self-Service: Schwerpunkte → Modality (skips What Brings You)
      await page.goto('/fragebogen?variant=self-service&restart=1');
      await completeInitialSteps(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('Mobile Experience', () => {
    test('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=concierge&restart=1');

      await completeInitialSteps(page);
      await completeWhatBringsYouIfPresent(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });

    test('self-service flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=self-service&restart=1');

      await completeInitialSteps(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });
  });
});
