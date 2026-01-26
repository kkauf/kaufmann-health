import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Test 3 - Concierge vs Marketplace Flow
 * 
 * Both flows use 5-question questionnaire + contact collection + verification.
 * Conversion fires at verification point for both variants.
 * After verification, user sees matches and can book without re-verification.
 */

test.describe('Test 3: Concierge vs Marketplace Flow', () => {
  const MOCK_MATCHES_URL = '/matches/test3-uuid';

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
          patientId: 'p-test3',
          matchesUrl: shouldReturnMatchesUrl ? MOCK_MATCHES_URL : null,
          matchQuality: shouldReturnMatchesUrl ? 'exact' : 'none',
        },
        error: null,
      };

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
  });

  // Helper to mock matches API
  const mockMatchesApi = (page: Page, verified = false) =>
    page.route('**/api/public/matches/*', async (route) => {
      const body = {
        data: {
          patient: {
            name: 'E2E Test',
            status: verified ? 'email_confirmed' : 'pre_confirmation',
            session_preference: 'online',
            city: 'Berlin',
          },
          therapists: verified ? [
            {
              id: 't1',
              first_name: 'Sandra',
              last_name: 'Mandl',
              city: 'Gelnhausen',
              accepting_new: true,
              modalities: ['narm', 'somatic-experiencing'],
              session_preferences: ['online', 'in_person'],
              approach_text: 'Körperpsychotherapie',
              availability: [{ date_iso: '2099-12-30', time_label: '09:00', format: 'online' }],
            },
          ] : [],
          metadata: { match_type: verified ? 'exact' : 'none' },
        },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

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
   * Helper to complete the questionnaire flow.
   * Flow: Schwerpunkte (2.5) → Payment Info (2.6) → [What Brings You (2) for Concierge] → Modality (3) → Location (4) → Preferences (5) → Contact (6)
   */
  async function completeQuestionnaire(page: Page) {
    // Step 2.5: Schwerpunkte (first step for all variants)
    await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /Überspringen/i }).click();

    // Step 2.6: Payment info - select "Das passt für mich" then click Weiter
    await expect(page.getByText(/Finanzierung/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: /passt für mich/i }).click();
    await page.getByRole('button', { name: /Weiter/i }).click();

    // Check for "What Brings You" (Concierge only) or proceed to Modality
    await page.waitForTimeout(1000);
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);

    if (whatBringsYouVisible) {
      await page.getByLabel(/Was bringt dich zur Therapie/i).fill('E2E Test: kurzbeschreibung');
      await page.getByRole('button', { name: 'Weiter →' }).click();
    }

    // Step 3: Modality
    await expect(page.getByText(/Möchtest du deine Therapiemethode selbst wählen/i)).toBeVisible({ timeout: 5000 });
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
    await page.getByRole('button', { name: /Bin flexibel|flexibel/i }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();

    // Step 6: Contact form
    await completeStep6ContactForm(page);
  }

  test.describe('Concierge Flow (/fragebogen?v=concierge)', () => {
    test('starts questionnaire with concierge variant', async ({ page }) => {
      await page.goto('/fragebogen?v=concierge');
      // Should show Schwerpunkte step first (Timeline step was removed)
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Marketplace Flow (/start?v=marketplace)', () => {
    test('landing page CTA links to fragebogen with variant', async ({ page }) => {
      await page.goto('/start?v=marketplace');
      
      const ctaLink = page.getByRole('link', { name: 'Jetzt Therapeut:in finden' });
      await expect(ctaLink).toHaveAttribute('href', '/fragebogen?v=marketplace');
    });

  });

  test.describe('Variant Parity', () => {
    test('both variants show Schwerpunkte step first', async ({ page }) => {
      // Concierge - starts with Schwerpunkte (Timeline step was removed)
      await page.goto('/fragebogen?v=concierge');
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 10000 });

      // Marketplace - also starts with Schwerpunkte
      await page.goto('/fragebogen?v=marketplace');
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Mobile Experience', () => {
    test('questionnaire works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?v=concierge');

      // Schwerpunkte step should be visible on mobile (first step now)
      await expect(page.getByText(/Was beschäftigt dich/i)).toBeVisible({ timeout: 10000 });

      // Skip button should be accessible (may need scroll on small screens)
      const skipButton = page.getByRole('button', { name: /Überspringen/i });
      await skipButton.scrollIntoViewIfNeeded();
      await expect(skipButton).toBeVisible();
    });
  });
});
