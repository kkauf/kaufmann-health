import { test, expect, Page } from '@playwright/test';

/**
 * E2E: Test 3 - Concierge vs Marketplace Flow
 * 
 * Both flows use 5-question questionnaire + contact collection + verification.
 * Conversion fires at verification point for both variants.
 * After verification, user sees matches and can book without re-verification.
 */

test.describe('Test 3: Concierge vs Marketplace Flow', () => {
  const MOCK_PATIENT_ID = 'p-test3';
  const MOCK_MATCHES_URL = '/matches/test3-uuid';
  const MOCK_EMAIL = 'test3@example.com';

  // Helper to mock the leads API response
  const mockLeadsApi = async (page: Page, matchesUrl = MOCK_MATCHES_URL) => {
    await page.route('**/api/public/leads', async (route) => {
      const body = {
        data: { id: MOCK_PATIENT_ID, requiresConfirmation: true, matchesUrl },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.route('**/api/public/leads/**/form-completed', async (route) => {
      const body = { data: { ok: true }, error: null };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
  };

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
   * Helper to complete the questionnaire flow.
   * Handles both SHOW_SCHWERPUNKTE=true (Schwerpunkte step) and false (What Brings You step).
   * NOTE: Staging has SHOW_SCHWERPUNKTE=true, so flow is:
   * Timeline → Schwerpunkte → Modality → Location → Preferences
   */
  async function completeQuestionnaire(page: Page) {
    // Step 1: Timeline - select timing
    await page.getByRole('button', { name: /Innerhalb des nächsten Monats|nächsten Monats/i }).click();
    
    // After Timeline, either Schwerpunkte or "What Brings You" appears
    // Wait a moment for the transition, then check which screen we're on
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
  }

  test.describe('Concierge Flow (/fragebogen?v=concierge)', () => {
    test('shows contact collection after questionnaire', async ({ page }) => {
      await page.goto('/fragebogen?v=concierge&restart=1');
      await completeQuestionnaire(page);

      // Should show contact collection (step 6)
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
      await expect(page.getByPlaceholder('Vorname oder Spitzname')).toBeVisible();
    });

    test('submits to leads API and stays on fragebogen for verification', async ({ page }) => {
      await mockLeadsApi(page);
      await page.goto('/fragebogen?v=concierge&restart=1');
      await completeQuestionnaire(page);

      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Concierge');
      // Ensure email mode (some flows may default to SMS)
      const emailToggle = page.getByRole('button', { name: /E.?Mail/i });
      if (await emailToggle.isVisible().catch(() => false)) {
        await emailToggle.click();
      }
      await page.getByPlaceholder('deine@email.de').fill(MOCK_EMAIL);
      await page.getByTestId('wizard-next').click();

      // Should NOT redirect to matches immediately
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/fragebogen\?v=concierge/);
    });

    test('shows matches after email verification redirect', async ({ page }) => {
      await mockMatchesApi(page, true);
      
      // Simulate post-verification redirect
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1&id=${MOCK_PATIENT_ID}`);
      
      // Should show matches with booking buttons
      await expect(page.locator('h1')).toContainText('passenden Ergebnisse');
      await expect(page.getByRole('button', { name: /Direkt buchen/i })).toBeVisible();
    });

    test('verified user can book without re-verification', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1`);
      
      // Click book button
      await page.getByRole('button', { name: /Direkt buchen/i }).first().click();
      
      // Modal should open with slot selection (not verification)
      await expect(page.getByTestId('contact-modal')).toBeVisible();
      await expect(page.getByText('Format')).toBeVisible();
    });
  });

  test.describe('Marketplace Flow (/start?v=marketplace)', () => {
    test('landing page CTA links to fragebogen with variant', async ({ page }) => {
      await page.goto('/start?v=marketplace');
      
      const ctaLink = page.getByRole('link', { name: 'Jetzt Therapeut:in finden' });
      await expect(ctaLink).toHaveAttribute('href', '/fragebogen?v=marketplace');
    });

    test('shows contact collection after questionnaire', async ({ page }) => {
      await page.goto('/fragebogen?v=marketplace&restart=1');
      await completeQuestionnaire(page);

      // Should show contact collection (step 6) - same as concierge
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
      await expect(page.getByPlaceholder('Vorname oder Spitzname')).toBeVisible();
    });

    test('submits to leads API and stays on fragebogen for verification', async ({ page }) => {
      await mockLeadsApi(page);
      await page.goto('/fragebogen?v=marketplace&restart=1');
      await completeQuestionnaire(page);

      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Marketplace');
      // Ensure email mode (some flows may default to SMS)
      const emailToggle = page.getByRole('button', { name: /E.?Mail/i });
      if (await emailToggle.isVisible().catch(() => false)) {
        await emailToggle.click();
      }
      await page.getByPlaceholder('deine@email.de').fill(MOCK_EMAIL);
      await page.getByTestId('wizard-next').click();

      // Should NOT redirect to matches immediately
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/fragebogen\?v=marketplace/);
    });

    test('shows matches after email verification redirect', async ({ page }) => {
      await mockMatchesApi(page, true);
      
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1&id=${MOCK_PATIENT_ID}`);
      
      await expect(page.locator('h1')).toContainText('passenden Ergebnisse');
      await expect(page.getByRole('button', { name: /Direkt buchen/i })).toBeVisible();
    });

    test('verified user can book without re-verification', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1`);
      
      await page.getByRole('button', { name: /Direkt buchen/i }).first().click();
      
      await expect(page.getByTestId('contact-modal')).toBeVisible();
      await expect(page.getByText('Format')).toBeVisible();
    });
  });

  test.describe('Variant Parity', () => {
    test('concierge requires verification before matches', async ({ page }) => {
      await page.goto('/fragebogen?v=concierge&restart=1');
      await completeQuestionnaire(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });

    test('marketplace requires verification before matches', async ({ page }) => {
      await page.goto('/fragebogen?v=marketplace&restart=1');
      await completeQuestionnaire(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });

  test.describe('Mobile Experience', () => {
    test('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?v=concierge&restart=1');
      
      // Use the shared helper for consistent flow handling
      await completeQuestionnaire(page);
      
      // Should reach contact collection
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });

    test('marketplace flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?v=marketplace&restart=1');
      
      // Use the shared helper for consistent flow handling
      await completeQuestionnaire(page);
      
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });
});
