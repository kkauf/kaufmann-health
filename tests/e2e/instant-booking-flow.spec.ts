import { test, expect } from '@playwright/test';

test.describe('Instant Booking Flow - E2E (EARTH-233)', () => {
  test.beforeEach(async ({ page }) => {
    // Set feature flag via environment or admin panel
    // In real test, ensure NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true
  });

  test.describe('Complete Instant Flow - Exact Match', () => {
    test('shows matches and opens booking modal (direct booking)', async ({ page }) => {
      // Mock matches API to return 1 perfect match
      await page.route('**/api/public/matches/*', (route) => {
        const body = {
          data: {
            patient: {
              name: 'E2E Test Patient',
              status: 'anonymous',
              session_preference: 'online',
              city: 'Berlin',
            },
            therapists: [
              {
                id: 't1',
                first_name: 'Silvia',
                last_name: 'Hoffmann',
                city: 'Freiburg',
                accepting_new: true,
                modalities: ['narm'],
                session_preferences: ['online', 'in_person'],
                approach_text: '',
                availability: [],
              },
            ],
            metadata: { match_type: 'exact' },
          },
          error: null,
        };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });

      await page.goto('/matches/test-uuid');
      await expect(page.locator('h1')).toBeVisible();
      // Email confirmation banner must not be present in direct booking
      await expect(page.locator('text=Bitte bestätige deine E‑Mail')).toHaveCount(0);

      // Click booking CTA (wait for it to be visible to avoid race)
      const bookBtn = page.getByText('Therapeut:in buchen').first();
      await bookBtn.scrollIntoViewIfNeeded();
      await expect(bookBtn).toBeVisible();
      await bookBtn.click();
      // Contact modal should open; assert using stable test id
      await expect(page.getByTestId('contact-modal')).toBeVisible();
    });
  });

  test.describe('Partial Match Flow', () => {
    test('shows partial banner when no exact match and no perfect card', async ({ page }) => {
      // Mock partial matches (no perfect)
      await page.route('**/api/public/matches/*', (route) => {
        const body = {
          data: {
            patient: {
              name: 'Evening Only Patient',
              status: 'anonymous',
              session_preference: 'in_person',
              city: 'Berlin',
            },
            therapists: [
              {
                id: 't2',
                first_name: 'Alex',
                last_name: 'Mustermann',
                city: 'Freiburg', // mismatch city
                accepting_new: true,
                modalities: ['narm'],
                session_preferences: ['online'], // mismatch format
                approach_text: '',
                availability: [],
              },
            ],
            metadata: { match_type: 'partial' },
          },
          error: null,
        };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });

      await page.goto('/matches/test-uuid');
      await expect(page.locator('h1')).toBeVisible();
      // No perfect match badge should be shown
      await expect(page.getByText('⭐ Perfekte Übereinstimmung')).toHaveCount(0);
    });
  });

  test.describe('Zero Therapists Flow', () => {
    test('shows empty state when no therapists match', async ({ page }) => {
      await page.route('**/api/public/matches/*', (route) => {
        const body = { data: { patient: { status: 'anonymous' }, therapists: [], metadata: { match_type: 'none' } }, error: null };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const waitMatches = page.waitForResponse((res) => res.url().includes('/api/public/matches/') && res.status() === 200);
      await Promise.all([
        page.goto('/matches/test-uuid'),
        waitMatches,
      ]);
      // Empty state: no booking CTA should be present
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Therapeut:in buchen')).toHaveCount(0);
    });
  });

  test.describe('Legacy Flow Compatibility', () => {
    test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped when direct-booking flow is enabled');
    test('shows step 9 when feature flag disabled', async ({ page }) => {
      await page.goto('/fragebogen');
      await expect(page).toHaveURL('/fragebogen');
    });
  });

  test.describe('Conversion Tracking', () => {
    test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped in direct-booking smoke run');
  });

  test.describe('Mobile Experience', () => {
    test('works on mobile viewport (matches)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.route('**/api/public/matches/*', (route) => {
        const body = { data: { patient: { status: 'anonymous' }, therapists: [], metadata: { match_type: 'none' } }, error: null };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto('/matches/test-uuid');
      // Assert main heading visible (unique H1)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  });

  test.describe('Error Recovery', () => {
    test('handles matches API 500 gracefully', async ({ page }) => {
      await page.route('**/api/public/matches/*', (route) => route.fulfill({ status: 500, body: JSON.stringify({ error: 'Unexpected error' }) }));
      await page.goto('/matches/test-uuid');
      await expect(page.locator('text=Nicht gefunden')).toBeVisible();
    });

    test.skip(process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW === 'true', 'Skipped network timeout flow in direct-booking smoke run');
  });
});
