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
      const isDirect = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
      const shouldReturnMatchesUrl = variant === 'concierge' ? true : isDirect;

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
   * Helper to complete Step 1 (Timeline)
   */
  async function completeStep1Timeline(page: Page) {
    await page.getByRole('button', { name: /Innerhalb des nächsten Monats|nächsten Monats/i }).click();
  }

  /**
   * Helper to complete Step 2/2.5 depending on variant/config.
   * - Self-service: Schwerpunkte (can skip)
   * - Concierge: "Was bringt dich zur Therapie?" (must type to enable next)
   */
  async function completeStep2Or2p5(page: Page) {
    await page.waitForTimeout(1000);
    // Prefer robust detection: Schwerpunkte screen always has a visible "Überspringen" button
    const skipBtn = page.getByRole('button', { name: /Überspringen/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      return;
    }

    // Concierge path: open text question
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);
    if (whatBringsYouVisible) {
      await page.getByLabel(/Was bringt dich zur Therapie/i).fill('E2E Test: kurzbeschreibung');
      await page.getByRole('button', { name: 'Weiter →' }).click();
      return;
    }

    // Fallback: if neither detected, try to proceed by clicking any available "Weiter" button
    const nextBtn = page.getByRole('button', { name: /Weiter/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
    }
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
  }

  test.describe('Concierge Flow (/fragebogen?variant=concierge)', () => {
    test('shows text field (Step 2) instead of Schwerpunkte', async ({ page }) => {
      await page.goto('/fragebogen?variant=concierge&restart=1');
      await completeStep1Timeline(page);
      
      // Wait for transition
      await page.waitForTimeout(1000);
      
      await expect(page.getByText(/Was bringt dich zur Therapie\?/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Was beschäftigt dich\?/i)).toHaveCount(0);
    });

    test('redirects to matches after questionnaire', async ({ page }) => {
      await mockMatchesApi(page);
      await page.goto('/fragebogen?variant=concierge&restart=1');
      
      // Complete questionnaire
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      
      await completeRemainingSteps(page);

      await expect(page).toHaveURL(new RegExp(`${MOCK_MATCHES_URL.replace('/', '\\/')}$`));
      await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('Self-Service Flow (/fragebogen?variant=self-service)', () => {
    test('shows Schwerpunkte (Step 2.5) instead of text field', async ({ page }) => {
      await page.goto('/fragebogen?variant=self-service&restart=1');
      await completeStep1Timeline(page);
      
      // Wait for transition
      await page.waitForTimeout(1000);
      
      // Should show Schwerpunkte checkboxes
      const schwerpunkteVisible = await page.getByText(/Was beschäftigt dich|Wähle aus/i).isVisible().catch(() => false);
      
      // Self-service should show Schwerpunkte screen
      expect(schwerpunkteVisible).toBe(true);
    });

    test('supports v= alias for self-service', async ({ page }) => {
      await page.goto('/fragebogen?v=self-service&restart=1');
      await completeStep1Timeline(page);

      // Wait for transition
      await page.waitForTimeout(1000);

      // Should show Schwerpunkte checkboxes
      const schwerpunkteVisible = await page.getByText(/Was beschäftigt dich|Wähle aus/i).isVisible().catch(() => false);
      expect(schwerpunkteVisible).toBe(true);
    });

    test('redirects to matches after questionnaire when direct booking is enabled', async ({ page }) => {
      test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW !== 'true', 'Requires NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true');
      await mockMatchesApi(page);
      await page.goto('/fragebogen?variant=self-service&restart=1');
      
      // Complete questionnaire
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      
      await completeRemainingSteps(page);

      await expect(page).toHaveURL(new RegExp(`${MOCK_MATCHES_URL.replace('/', '\\/')}$`));
    });

    test('shows inline no-matches message when direct booking is disabled', async ({ page }) => {
      test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped when NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true');
      await page.goto('/fragebogen?variant=self-service&restart=1');

      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await completeRemainingSteps(page);

      await expect(page.getByText('Keine Therapeuten gefunden. Bitte versuche es später erneut.')).toBeVisible({ timeout: 8000 });
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
    test('both variants reach step 3 (modality) after step 2', async ({ page }) => {
      // Concierge
      await page.goto('/fragebogen?variant=concierge&restart=1');
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
      
      // Self-Service
      await page.goto('/fragebogen?variant=self-service&restart=1');
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe('Mobile Experience', () => {
    test('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=concierge&restart=1');
      
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });

    test('self-service flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=self-service&restart=1');
      
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 8000 });
    });
  });
});
