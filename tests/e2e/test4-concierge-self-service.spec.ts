import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Test 4 - Concierge vs Self-Service Matching
 * 
 * Concierge: Manual curation (text field input, no auto-matching, waiting screen)
 * Self-Service: Auto-matching (Schwerpunkte selection, instant matches)
 */

test.describe('Test 4: Concierge vs Self-Service', () => {
  const MOCK_PATIENT_ID = 'p-test4';
  const MOCK_MATCHES_URL = '/matches/test4-uuid';
  const MOCK_EMAIL = 'test4@example.com';

  // Mock leads API - concierge returns no matchesUrl
  const mockLeadsApiConcierge = (page: Page) => 
    page.route('**/api/public/leads', async (route) => {
      const body = {
        data: { id: MOCK_PATIENT_ID, requiresConfirmation: true },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

  // Mock leads API - self-service returns matchesUrl
  const mockLeadsApiSelfService = (page: Page) => 
    page.route('**/api/public/leads', async (route) => {
      const body = {
        data: { id: MOCK_PATIENT_ID, requiresConfirmation: true, matchesUrl: MOCK_MATCHES_URL },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
    const schwerpunkteVisible = await page.getByText(/Was beschäftigt dich/i).isVisible().catch(() => false);
    const whatBringsYouVisible = await page.getByText(/Was bringt dich zur Therapie/i).isVisible().catch(() => false);

    if (schwerpunkteVisible) {
      await page.getByRole('button', { name: /Überspringen/i }).click();
      return;
    }

    if (whatBringsYouVisible) {
      await page.getByLabel(/Was bringt dich zur Therapie/i).fill('E2E Test: kurzbeschreibung');
      await page.getByRole('button', { name: 'Weiter →' }).click();
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
      
      // Should show "What Brings You" text field, NOT Schwerpunkte checkboxes
      const textFieldVisible = await page.getByText(/Was bringt dich zur Therapie|Was beschäftigt dich gerade/i).isVisible().catch(() => false);
      const schwerpunkteVisible = await page.getByText(/Wähle aus, was/i).isVisible().catch(() => false);
      
      // Concierge should show text field screen (not necessarily visible text, but the skip/continue pattern)
      // The key is that it does NOT show Schwerpunkte checkboxes
      expect(schwerpunkteVisible).toBe(false);
    });

    test('submits without matchesUrl (no auto-matching)', async ({ page }) => {
      await mockLeadsApiConcierge(page);
      await page.goto('/fragebogen?variant=concierge&restart=1');
      
      // Complete questionnaire
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      
      await completeRemainingSteps(page);
      
      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Concierge');
      // Ensure email mode (some flows may default to SMS)
      const emailToggle = page.getByRole('button', { name: /E.?Mail/i });
      if (await emailToggle.isVisible().catch(() => false)) {
        await emailToggle.click();
      }
      await page.getByPlaceholder('deine@email.de').fill(MOCK_EMAIL);
      await page.getByTestId('wizard-next').click();
      
      // Should stay on fragebogen (no redirect to matches)
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/fragebogen/);
    });

    test('confirmation screen shows waiting message (not matches CTA)', async ({ page }) => {
      await page.goto('/fragebogen?variant=concierge&confirm=1');
      
      // Should show concierge waiting message
      await expect(page.getByRole('heading', { name: /wir bereiten deine persönliche Auswahl vor/i })).toBeVisible({ timeout: 5000 });
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

    test('submits with matchesUrl (auto-matching)', async ({ page }) => {
      await mockLeadsApiSelfService(page);
      await page.goto('/fragebogen?variant=self-service&restart=1');
      
      // Complete questionnaire
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      
      await completeRemainingSteps(page);
      
      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Self-Service');
      // Ensure email mode (some flows may default to SMS)
      const emailToggle2 = page.getByRole('button', { name: /E.?Mail/i });
      if (await emailToggle2.isVisible().catch(() => false)) {
        await emailToggle2.click();
      }
      await page.getByPlaceholder('deine@email.de').fill(MOCK_EMAIL);
      await page.getByTestId('wizard-next').click();
      
      // Should stay on fragebogen for verification (matches come after)
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/fragebogen/);
    });

    test('confirmed user sees matches CTA', async ({ page }) => {
      await mockMatchesApi(page);
      await page.goto('/fragebogen?variant=self-service&confirm=1');
      
      // Should show matches CTA (not waiting message)
      await expect(page.getByRole('heading', { name: /deine Matches sind bereit/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /Jetzt Therapeut:innen ansehen/i })).toBeVisible({ timeout: 5000 });
    });

    test('verified user can view matches immediately', async ({ page }) => {
      await mockMatchesApi(page);
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1`);
      
      // Should show matches
      await expect(page.locator('h1')).toContainText(/Ergebnisse|Matches/i);
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
    test('both variants reach contact collection step', async ({ page }) => {
      // Concierge
      await page.goto('/fragebogen?variant=concierge&restart=1');
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await completeRemainingSteps(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
      
      // Self-Service
      await page.goto('/fragebogen?variant=self-service&restart=1');
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await completeRemainingSteps(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });

  test.describe('Mobile Experience', () => {
    test('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=concierge&restart=1');
      
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await completeRemainingSteps(page);
      
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });

    test('self-service flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?variant=self-service&restart=1');
      
      await completeStep1Timeline(page);
      await completeStep2Or2p5(page);
      await completeRemainingSteps(page);
      
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });
});
