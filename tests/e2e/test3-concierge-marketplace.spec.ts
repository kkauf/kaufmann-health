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
  const mockLeadsApi = (page: Page, matchesUrl = MOCK_MATCHES_URL) => 
    page.route('**/api/public/leads', async (route) => {
      const body = {
        data: { id: MOCK_PATIENT_ID, requiresConfirmation: true, matchesUrl },
        error: null,
      };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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

  // Helper to complete the 5-question questionnaire
  async function completeQuestionnaire(page: Page) {
    // Step 1: Timeline
    await page.getByRole('button', { name: 'Innerhalb des nächsten Monats' }).click();
    await expect(page.getByText('Was bringt dich zur Therapie?')).toBeVisible();

    // Step 2: Topic (skip)
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await expect(page.getByText(/Therapiemethode/i)).toBeVisible();

    // Step 3: Modality
    await page.getByRole('button', { name: 'Nein' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    await expect(page.getByText('Wie möchtest du die Sitzungen machen?')).toBeVisible();

    // Step 4: Location
    await page.getByRole('button', { name: 'Online (Video)' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
    await expect(page.getByText('Wann hast du Zeit für Termine?')).toBeVisible();

    // Step 5: Preferences
    await page.getByRole('button', { name: 'Bin flexibel' }).click();
    await page.getByRole('button', { name: 'Weiter →' }).click();
  }

  test.describe('Concierge Flow (/fragebogen?v=concierge)', () => {
    test('shows contact collection after questionnaire', async ({ page }) => {
      await page.goto('/fragebogen?v=concierge');
      await completeQuestionnaire(page);

      // Should show contact collection (step 6)
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
      await expect(page.getByPlaceholder('Vorname oder Spitzname')).toBeVisible();
      await expect(page.getByPlaceholder('deine@email.de')).toBeVisible();
    });

    test('submits to leads API and stays on fragebogen for verification', async ({ page }) => {
      await mockLeadsApi(page);
      await page.goto('/fragebogen?v=concierge');
      await completeQuestionnaire(page);

      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Concierge');
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
      await expect(page.getByRole('button', { name: /Therapeut:in buchen/i })).toBeVisible();
    });

    test('verified user can book without re-verification', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1`);
      
      // Click book button
      await page.getByRole('button', { name: /Therapeut:in buchen/i }).first().click();
      
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
      await page.goto('/fragebogen?v=marketplace');
      await completeQuestionnaire(page);

      // Should show contact collection (step 6) - same as concierge
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
      await expect(page.getByPlaceholder('Vorname oder Spitzname')).toBeVisible();
    });

    test('submits to leads API and stays on fragebogen for verification', async ({ page }) => {
      await mockLeadsApi(page);
      await page.goto('/fragebogen?v=marketplace');
      await completeQuestionnaire(page);

      // Fill contact info
      await page.getByPlaceholder('Vorname oder Spitzname').fill('E2E Marketplace');
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
      await expect(page.getByRole('button', { name: /Therapeut:in buchen/i })).toBeVisible();
    });

    test('verified user can book without re-verification', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto(`${MOCK_MATCHES_URL}?confirm=1`);
      
      await page.getByRole('button', { name: /Therapeut:in buchen/i }).first().click();
      
      await expect(page.getByTestId('contact-modal')).toBeVisible();
      await expect(page.getByText('Format')).toBeVisible();
    });
  });

  test.describe('Variant Parity', () => {
    test('concierge requires verification before matches', async ({ page }) => {
      await page.goto('/fragebogen?v=concierge');
      await completeQuestionnaire(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });

    test('marketplace requires verification before matches', async ({ page }) => {
      await page.goto('/fragebogen?v=marketplace');
      await completeQuestionnaire(page);
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });

  test.describe('Mobile Experience', () => {
    test('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?v=concierge');
      
      // Step 1
      await page.getByRole('button', { name: /nächsten Monats/i }).click();
      // Step 2 skip
      await page.getByRole('button', { name: /Überspringen/i }).click();
      // Step 3
      await page.getByRole('button', { name: /Nein/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      // Step 4
      await page.getByRole('button', { name: /Online/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      // Step 5
      await page.getByRole('button', { name: /flexibel/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      
      // Should reach contact collection
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });

    test('marketplace flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/fragebogen?v=marketplace');
      
      await page.getByRole('button', { name: /nächsten Monats/i }).click();
      await page.getByRole('button', { name: /Überspringen/i }).click();
      await page.getByRole('button', { name: /Nein/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      await page.getByRole('button', { name: /Online/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      await page.getByRole('button', { name: /flexibel/i }).click();
      await page.getByRole('button', { name: /Weiter/i }).click();
      
      await expect(page.getByText('Fast geschafft!')).toBeVisible();
    });
  });
});
