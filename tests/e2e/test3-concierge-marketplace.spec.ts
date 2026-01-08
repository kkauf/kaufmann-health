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
      const isDirect = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
      const shouldReturnMatchesUrl = variant === 'concierge' ? true : isDirect;

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
   * Handles both SHOW_SCHWERPUNKTE=true (Schwerpunkte step) and false (What Brings You step).
   * NOTE: Staging has SHOW_SCHWERPUNKTE=true, so flow is:
   * Timeline → Schwerpunkte → Modality → Location → Preferences → Contact
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
    
    // Step 6: Contact form
    await completeStep6ContactForm(page);
  }

  test.describe('Concierge Flow (/fragebogen?v=concierge)', () => {
    // Skip: needsVerificationFlow is now always true, so wizard goes through
    // full 9-step flow with email/SMS verification before showing matches.
    // This test was for the deprecated anonymous 5-step flow.
    test.skip('redirects to matches after questionnaire', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=concierge');
      await completeQuestionnaire(page);
      await expect(page).toHaveURL(MOCK_MATCHES_URL);

      const loading = page.getByText('Lade Empfehlungen…');
      await loading.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await expect(loading).toHaveCount(0, { timeout: 15000 });
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Marketplace Flow (/start?v=marketplace)', () => {
    test('landing page CTA links to fragebogen with variant', async ({ page }) => {
      await page.goto('/start?v=marketplace');
      
      const ctaLink = page.getByRole('link', { name: 'Jetzt Therapeut:in finden' });
      await expect(ctaLink).toHaveAttribute('href', '/fragebogen?v=marketplace');
    });

    // Skip: needsVerificationFlow is now always true
    test.skip('shows contact collection after questionnaire', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=marketplace');
      await completeQuestionnaire(page);

      const isDirect = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
      if (isDirect) {
        await expect(page).toHaveURL(MOCK_MATCHES_URL);
      } else {
        await expect(page.getByText('Keine Therapeuten gefunden. Bitte versuche es später erneut.')).toBeVisible();
      }
    });
  });

  test.describe('Variant Parity', () => {
    // Skip: needsVerificationFlow is now always true
    test.skip('concierge requires verification before matches', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=concierge');
      await completeQuestionnaire(page);
      await expect(page).toHaveURL(MOCK_MATCHES_URL);
    });

    // Skip: needsVerificationFlow is now always true
    test.skip('marketplace requires verification before matches', async ({ page }) => {
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=marketplace');
      await completeQuestionnaire(page);

      const isDirect = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
      if (isDirect) {
        await expect(page).toHaveURL(MOCK_MATCHES_URL);
      } else {
        await expect(page.getByText('Keine Therapeuten gefunden. Bitte versuche es später erneut.')).toBeVisible();
      }
    });
  });

  test.describe('Mobile Experience', () => {
    // Skip: needsVerificationFlow is now always true
    test.skip('concierge flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=concierge');
      
      // Use the shared helper for consistent flow handling
      await completeQuestionnaire(page);
      
      await expect(page).toHaveURL(MOCK_MATCHES_URL);
    });

    // Skip: needsVerificationFlow is now always true
    test.skip('marketplace flow works on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await mockMatchesApi(page, true);
      await page.goto('/fragebogen?v=marketplace');
      
      // Use the shared helper for consistent flow handling
      await completeQuestionnaire(page);
      
      const isDirect = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
      if (isDirect) {
        await expect(page).toHaveURL(MOCK_MATCHES_URL);
      } else {
        await expect(page.getByText('Keine Therapeuten gefunden. Bitte versuche es später erneut.')).toBeVisible();
      }
    });
  });
});
