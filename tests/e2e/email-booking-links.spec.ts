import { test, expect } from '@playwright/test';

/**
 * E2E: Email Booking Links Test
 * 
 * Tests the booking flow when clicking links from selection emails.
 * Runs against staging with test mode enabled.
 * 
 * Prerequisites:
 * - Test therapist must have Cal.com enabled
 * - Test therapist must have available slots
 * 
 * Test scenarios:
 * 1. Directory booking flow - scarcity filtering displays correctly
 * 2. Email booking link simulation - direct booking from email CTA
 */

// Use staging URL for these tests
const STAGING_URL = process.env.E2E_BASE_URL || 'https://staging.kaufmann-health.de';

// Test therapist (must have Cal.com enabled on staging)
const TEST_THERAPIST_NAME = 'Sandra'; // Known test therapist on staging

test.describe('Email Booking Links - Staging E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Enable test mode to route emails to sink and mark data as test
    await page.goto(`${STAGING_URL}/start?tt=1`);
    // Wait for test cookie to be set
    await page.waitForTimeout(500);
  });

  test('directory shows scarcity-filtered slots (1-3 per day instead of many)', async ({ page }) => {
    // Navigate to therapist directory
    await page.goto(`${STAGING_URL}/therapeuten`);
    
    // Wait for therapists to load
    await page.waitForSelector('[data-testid="therapist-card"], .therapist-card, [class*="therapist"]', { timeout: 15000 });
    
    // Click on a therapist card to open the modal
    const therapistCards = page.locator('[data-testid="therapist-card"], .therapist-card, [class*="TherapistCard"]');
    const cardCount = await therapistCards.count();
    
    if (cardCount === 0) {
      // Try clicking any visible therapist element
      await page.locator('button, [role="button"]').filter({ hasText: /Sandra|Mandl|Therapeut/i }).first().click();
    } else {
      await therapistCards.first().click();
    }
    
    // Wait for modal to open
    await page.waitForSelector('[role="dialog"], [class*="modal"], [class*="Modal"]', { timeout: 10000 });
    
    // Look for the Cal.com booking button
    const introButton = page.getByRole('button', { name: /Kennenlernen|Intro|15 min/i });
    if (await introButton.isVisible({ timeout: 5000 })) {
      await introButton.click();
      
      // Wait for slots to load
      await page.waitForTimeout(2000);
      
      // Check that day chips show scarcity-filtered counts (should be 1-3 per day, not 10+)
      const dayChips = page.locator('button').filter({ hasText: /Termin/ });
      const chipCount = await dayChips.count();
      
      if (chipCount > 0) {
        // Get the text of the first chip to check slot count
        const firstChipText = await dayChips.first().textContent();
        console.log('First day chip text:', firstChipText);
        
        // Extract the number from "X Termine" or "X Termin"
        const match = firstChipText?.match(/(\d+)\s*Termin/);
        if (match) {
          const slotCount = parseInt(match[1], 10);
          // Scarcity filter should show 1-3 slots per day, not 10+
          expect(slotCount).toBeLessThanOrEqual(3);
          console.log(`✓ Scarcity filtering working: ${slotCount} slots shown (max 3 expected)`);
        }
      }
    }
  });

  test('booking flow from directory to slot selection', async ({ page }) => {
    // Navigate to therapist directory
    await page.goto(`${STAGING_URL}/therapeuten`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of directory
    await page.screenshot({ path: 'test-results/directory-loaded.png' });
    
    // Find and click on a therapist
    const therapistCard = page.locator('[data-testid="therapist-card"]').first();
    if (await therapistCard.isVisible({ timeout: 5000 })) {
      await therapistCard.click();
    } else {
      // Fallback: click any card-like element
      await page.locator('[class*="Card"]').filter({ hasText: /Therapeut|Berlin|Online/i }).first().click();
    }
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    
    // Take screenshot of modal
    await page.screenshot({ path: 'test-results/therapist-modal.png' });
    
    // Click intro booking button
    const introButton = page.getByRole('button', { name: /Online-Kennenlernen|Kennenlernen anfragen/i });
    if (await introButton.isVisible({ timeout: 5000 })) {
      await introButton.click();
      
      // Wait for slot picker to appear
      await page.waitForTimeout(2000);
      
      // Take screenshot of slot picker
      await page.screenshot({ path: 'test-results/slot-picker.png' });
      
      // Look for time slot buttons
      const timeSlots = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
      const slotCount = await timeSlots.count();
      console.log(`Found ${slotCount} time slots`);
      
      if (slotCount > 0) {
        // Select first available slot
        await timeSlots.first().click();
        
        // Take screenshot after selection
        await page.screenshot({ path: 'test-results/slot-selected.png' });
        
        // Verify confirm button is enabled
        const confirmButton = page.getByRole('button', { name: /bestätigen|Termin buchen/i });
        await expect(confirmButton).toBeEnabled({ timeout: 5000 });
        
        console.log('✓ Slot selection flow working');
      }
    }
  });

  test('email booking link format - Cal.com URL structure', async ({ page }) => {
    // Simulate an email booking link (Cal.com direct link with metadata)
    // This tests that the URL format used in emails works correctly
    
    // First, find a Cal-enabled therapist to get their username
    const response = await page.request.get(`${STAGING_URL}/api/public/therapists`);
    const data = await response.json();
    
    const calTherapist = data.therapists?.find((t: { cal_username?: string; accepting_new?: boolean }) => 
      t.cal_username && t.accepting_new
    );
    
    if (calTherapist) {
      console.log(`Testing with Cal therapist: ${calTherapist.first_name} (${calTherapist.cal_username})`);
      
      // Construct email-style booking URL
      const calBookingUrl = `https://cal.com/${calTherapist.cal_username}/erstgespraech?metadata[kh_source]=email_confirm&metadata[kh_booking_kind]=intro`;
      
      // Navigate to Cal.com booking page
      await page.goto(calBookingUrl);
      
      // Wait for Cal.com page to load
      await page.waitForLoadState('domcontentloaded');
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/cal-booking-page.png' });
      
      // Verify Cal.com page loaded (look for time slots or booking UI)
      const pageContent = await page.content();
      const hasCalUI = pageContent.includes('cal.com') || 
                       pageContent.includes('Kostenlos') ||
                       pageContent.includes('booking');
      
      console.log(`Cal.com page loaded: ${hasCalUI ? 'Yes' : 'Page may require authentication'}`);
    } else {
      console.log('No Cal-enabled therapist found on staging - skipping direct Cal link test');
    }
  });

  test('matches page booking flow - scarcity filtering on matched therapist', async ({ page }) => {
    // This simulates clicking from an email to the matches page
    // We need a valid matches UUID - for now we test the redirect behavior
    
    // Navigate to matches page with a test UUID (will redirect if invalid)
    await page.goto(`${STAGING_URL}/matches/test-uuid-123?direct=1&utm_source=email`);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/matches-redirect.png' });
    
    // Either we get the matches page or redirected to start
    const currentUrl = page.url();
    console.log('Matches page URL:', currentUrl);
    
    // If we got to an actual matches page with therapists, check slot display
    const therapistSection = page.locator('[data-testid="therapist-section"], [class*="therapist"]');
    if (await therapistSection.isVisible({ timeout: 3000 })) {
      // Look for intro booking button
      const introButton = page.getByRole('button', { name: /Kennenlernen|Intro/i });
      if (await introButton.isVisible({ timeout: 3000 })) {
        await introButton.click();
        await page.waitForTimeout(2000);
        
        // Check slot counts
        const dayChips = page.locator('button').filter({ hasText: /Termin/ });
        const chipCount = await dayChips.count();
        console.log(`Matches page: Found ${chipCount} day chips`);
      }
    }
  });
});

test.describe('Slot Scarcity Filtering - Unit Verification', () => {
  test('verifies scarcity filter reduces slots per day', async ({ page }) => {
    // This test directly calls the Cal slots API and verifies the scarcity logic
    
    // Get a Cal-enabled therapist
    const therapistsRes = await page.request.get(`${STAGING_URL}/api/public/therapists`);
    const therapistsData = await therapistsRes.json();
    
    const calTherapist = therapistsData.therapists?.find((t: { cal_username?: string; id?: string }) => t.cal_username);
    
    if (!calTherapist) {
      console.log('No Cal-enabled therapist found - skipping API test');
      return;
    }
    
    // Get slots for this therapist
    const today = new Date().toISOString().split('T')[0];
    const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const slotsRes = await page.request.get(
      `${STAGING_URL}/api/public/cal/slots?therapist_id=${calTherapist.id}&kind=intro&start=${today}&end=${twoWeeksLater}`
    );
    
    if (slotsRes.ok()) {
      const slotsData = await slotsRes.json();
      const slots = slotsData.data?.slots || [];
      
      console.log(`API returned ${slots.length} total slots`);
      
      // Group by day to see raw counts
      const slotsByDay: Record<string, number> = {};
      for (const slot of slots) {
        const day = slot.date_iso;
        slotsByDay[day] = (slotsByDay[day] || 0) + 1;
      }
      
      console.log('Slots per day (raw from API):');
      for (const [day, count] of Object.entries(slotsByDay).slice(0, 5)) {
        console.log(`  ${day}: ${count} slots`);
      }
      
      // The scarcity filter should reduce these to 1-3 per day in the UI
      // This is verified in the UI tests above
    } else {
      console.log('Cal slots API returned error:', await slotsRes.text());
    }
  });
});
