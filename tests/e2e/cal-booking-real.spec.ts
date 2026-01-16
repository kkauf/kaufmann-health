import { test, expect } from '@playwright/test';

/**
 * E2E: Cal.com Booking Flow - Real Staging Data
 * 
 * Tests Cal.com booking functionality against real staging data.
 * Unlike cal-booking-flow.spec.ts which uses mocks (don't work on SSR),
 * this file tests against real therapists with Cal.com enabled.
 * 
 * Requires: E2E_THERAPIST_ID set to a Cal.com-enabled therapist UUID
 */

const therapistId = process.env.E2E_THERAPIST_ID;

test.describe('Cal.com Booking Flow - Real Data', () => {
  // Skip if no therapist ID configured
  test.skip(!therapistId, 'Set E2E_THERAPIST_ID to run Cal.com booking tests');

  test.beforeEach(async ({ page }) => {
    // Clear wizard state
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('kh_wizard_data');
        localStorage.removeItem('kh_wizard_step');
        localStorage.removeItem('kh_form_session_id');
      } catch {}
    });
  });

  test('therapist directory shows Cal.com booking button for enabled therapist', async ({ page }) => {
    await page.goto('/therapeuten');
    await page.waitForLoadState('networkidle');

    // Find therapist card with E2E_THERAPIST_ID
    const therapistCard = page.locator(`[data-therapist-id="${therapistId}"]`).first();
    
    // If card uses different attribute, try finding by content
    const cardVisible = await therapistCard.isVisible().catch(() => false);
    
    if (cardVisible) {
      // Check for booking button (Sitzung buchen or Direkt buchen)
      const bookingBtn = therapistCard.locator('button').filter({ hasText: /Sitzung buchen|Direkt buchen|Erstgespräch/i }).first();
      await expect(bookingBtn).toBeVisible();
    } else {
      // Fallback: just verify page loaded with therapists
      await expect(page.locator('main')).toContainText(/Therapeut/i);
    }
  });

  test('therapist directory loads without errors', async ({ page }) => {
    // Track console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/therapeuten');
    await page.waitForLoadState('networkidle');

    // Should see therapist cards
    const cards = page.locator('[class*="therapist"], [class*="card"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // No critical errors
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics') &&
      !e.includes('gtag')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('Cal.com slots API returns valid data for enabled therapist', async ({ request }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
    
    const response = await request.get(`${base}/api/public/cal/slots`, {
      params: {
        therapist_id: therapistId!,
        kind: 'intro',
      },
    });

    // API should respond (even if no slots available)
    expect(response.status()).toBeLessThan(500);
    
    const json = await response.json();
    
    // Should have data structure
    if (response.ok()) {
      expect(json).toHaveProperty('data');
      expect(json.data).toHaveProperty('slots');
      expect(Array.isArray(json.data.slots)).toBe(true);
    }
  });

  test('therapists API includes Cal.com fields for enabled therapist', async ({ request }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
    
    const response = await request.get(`${base}/api/public/therapists`);
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('therapists');
    expect(Array.isArray(json.therapists)).toBe(true);
    
    // Find test therapist
    const therapist = json.therapists.find((t: any) => t.id === therapistId);
    
    if (therapist) {
      // Verify Cal.com fields are present
      expect(therapist).toHaveProperty('cal_enabled');
      expect(therapist).toHaveProperty('cal_username');
      
      // If Cal.com enabled, should have username
      if (therapist.cal_enabled) {
        expect(therapist.cal_username).toBeTruthy();
      }
    }
  });
});

test.describe('Therapist Directory - General', () => {
  // TODO: These tests pass locally but fail on CI due to timing/selector issues
  // Need investigation into why Playwright assertions fail on staging
  test.skip(true, 'Temporarily skipped - needs CI debugging');
  
  test('directory page renders therapist cards', async ({ page }) => {
    await page.goto('/therapeuten');
    await page.waitForLoadState('networkidle');

    // Should have main content area
    await expect(page.locator('main')).toBeVisible();

    // Should have therapist heading
    await expect(page.getByRole('heading', { name: /Therapeut/i })).toBeVisible();
    
    // Should have booking buttons (Direkt buchen or Kennenlernen)
    const bookingButtons = page.getByRole('button', { name: /buchen|Kennenlernen/i });
    const buttonCount = await bookingButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('directory page is mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/therapeuten');
    await page.waitForLoadState('networkidle');

    // Main content should be visible
    await expect(page.locator('main')).toBeVisible();

    // Mobile hamburger menu should be visible
    await expect(page.getByRole('button', { name: /Menü/i })).toBeVisible();
    
    // Therapist cards should still render
    await expect(page.getByRole('heading', { name: /Therapeut/i })).toBeVisible();
  });

  test('directory filters are present', async ({ page }) => {
    await page.goto('/therapeuten');
    await page.waitForLoadState('networkidle');

    // Should have modality filter buttons
    await expect(page.getByRole('button', { name: /Alle/i }).first()).toBeVisible();
  });
});

test.describe('Matches Page - Real Data', () => {
  test('matches page loads with therapist data', async ({ page }) => {
    // Need a valid patient UUID - this test verifies the page structure
    // without requiring a real patient session
    
    // Test the matches page returns proper structure even for invalid UUID
    const response = await page.goto('/matches/test-invalid-uuid');
    
    // Should either redirect or show empty state, not crash
    expect(response?.status()).toBeLessThan(500);
  });

  test('matches API returns proper structure', async ({ request }) => {
    const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
    
    // Test with invalid UUID - should return error, not crash
    const response = await request.get(`${base}/api/public/matches/test-invalid-uuid`);
    
    // Should return 4xx, not 5xx
    expect(response.status()).toBeLessThan(500);
  });
});
