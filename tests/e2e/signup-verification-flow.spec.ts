/**
 * E2E tests for SignupWizard verification flow
 * 
 * Tests the critical business requirement: Users MUST verify their identity
 * (via SMS or email) BEFORE seeing their therapist matches.
 * 
 * Flow: Steps 1-5 (questionnaire) → Step 6 (contact info) → Step 6.5 (SMS code) → Step 7+ (confirmation)
 * 
 * REFACTORED: Now uses full wizard navigation instead of startStep param.
 * SMS bypass mode (E2E_SMS_BYPASS=true, E2E_SMS_CODE=000000) allows testing verification.
 */

import { test, expect, Page } from '@playwright/test';

const smsBypass = process.env.E2E_SMS_BYPASS === 'true';
const smsCode = process.env.E2E_SMS_CODE || '000000';

// Clear wizard state before each test for determinism
async function clearWizardState(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('kh_wizard_data');
    localStorage.removeItem('kh_wizard_step');
    localStorage.removeItem('kh_form_session_id');
    localStorage.removeItem('anonymousPatientId');
    localStorage.removeItem('kh_flow_variant');
    localStorage.removeItem('leadId');
    localStorage.removeItem('leadEmail');
  });
}

// Generate unique test identifiers
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Navigate through questionnaire to contact step using real UI interactions.
 * Works with both concierge and self-service variants.
 */
async function navigateToContactStep(page: Page) {
  // Step 1: Timeline - select an option
  await expect(page.getByText(/Wann möchtest du/i)).toBeVisible({ timeout: 10000 });
  
  // Click timeline option - triggers auto-advance
  const timelineOption = page.getByRole('button', { name: /Innerhalb des nächsten Monats|nächsten Monats/i });
  await timelineOption.click();
  
  // Click Weiter to proceed
  await page.getByRole('button', { name: 'Weiter →' }).click();
  
  // Step 2: What brings you (concierge) - fill minimal text to enable Weiter
  await page.waitForTimeout(500);
  const whatBringsYou = page.locator('textarea[placeholder*="Angst"], textarea[id="issue"]');
  if (await whatBringsYou.isVisible({ timeout: 3000 }).catch(() => false)) {
    await whatBringsYou.fill('E2E Test - Stress');
    await page.getByRole('button', { name: 'Weiter →' }).click();
  }
  
  // Step 2.5: Schwerpunkte (self-service) - skip if present
  await page.waitForTimeout(500);
  const skipSchwerpunkte = page.getByRole('button', { name: /Überspringen/i });
  if (await skipSchwerpunkte.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipSchwerpunkte.click();
  }
  
  // Step 3: Modality choice - "Möchtest du deine Therapiemethode selbst wählen?"
  await page.waitForTimeout(500);
  const modalityNo = page.getByRole('button', { name: /Nein, empfehlt mir eine/i });
  const skipModality = page.getByRole('button', { name: /Überspringen/i });
  if (await modalityNo.isVisible({ timeout: 3000 }).catch(() => false)) {
    await modalityNo.click();
  } else if (await skipModality.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipModality.click();
  }
  
  // Step 4: Location - select Online
  await expect(page.getByText(/Wie möchtest du die Sitzungen/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /^Online$/i }).click();
  
  // Step 5: Preferences - skip
  await page.waitForTimeout(500);
  const skipPrefs = page.getByRole('button', { name: /Überspringen/i });
  if (await skipPrefs.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipPrefs.click();
  }
  
  // Should now be on Step 6: Contact
  await expect(page.getByText(/Wie heißt du|Dein Name/i)).toBeVisible({ timeout: 10000 });
}

test.describe('SignupWizard Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearWizardState(page);
    // Set test mode cookie for dry-run booking
    await page.context().addCookies([{
      name: 'kh_test',
      value: '1',
      domain: new URL(page.context().browser()?.version() ? 'http://localhost' : process.env.E2E_BASE_URL || 'http://localhost').hostname,
      path: '/',
    }]);
  });

  test('reaches contact step after completing questionnaire', async ({ page }) => {
    await page.goto('/fragebogen?variant=concierge');
    
    // Navigate through all questionnaire steps
    await navigateToContactStep(page);
    
    // Should now be on step 6 - Contact Info
    await expect(page.getByText(/Wie heißt du|Dein Name/i)).toBeVisible();
    // Should see contact method options
    await expect(page.getByText(/E-Mail|Handynummer/i)).toBeVisible();
  });

  test('requires name before proceeding to verification', async ({ page }) => {
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Try to submit without filling name
    const phoneTab = page.getByRole('tab', { name: /Handynummer/i });
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
    }
    
    // Find phone input and fill it (but not name)
    const phoneInput = page.locator('input[type="tel"]');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('+49 151 12345678');
    }
    
    // The form should require name - submit button should be disabled or show error
    const submitBtn = page.getByRole('button', { name: /Weiter|Code senden/i });
    
    // Either button is disabled OR clicking shows validation
    const isDisabled = await submitBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      await submitBtn.click();
      // Should show name validation error
      await expect(page.getByText(/Name|Pflichtfeld|erforderlich/i)).toBeVisible({ timeout: 3000 });
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test('shows SMS verification step for phone users', async ({ page }) => {
    const testName = `E2E Test ${uid()}`;
    const testPhone = `+49 151 ${Math.floor(10000000 + Math.random() * 89999999)}`;
    
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Fill name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
    await nameInput.fill(testName);
    
    // Select phone tab
    const phoneTab = page.getByRole('tab', { name: /Handynummer/i });
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
    }
    
    // Fill phone number
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(testPhone);
    
    // Submit to trigger SMS
    const submitBtn = page.getByRole('button', { name: /Weiter|Code senden/i });
    await submitBtn.click();
    
    // Should transition to SMS verification step (6.5)
    await expect(page.getByText(/Code eingeben|Bestätigungscode|6-stellig/i)).toBeVisible({ timeout: 15000 });
  });

  test('completes SMS verification with bypass code', async ({ page }) => {
    // Skip if SMS bypass not configured
    test.skip(!smsBypass, 'Set E2E_SMS_BYPASS=true and E2E_SMS_CODE to run SMS verification tests');
    
    const testName = `E2E Verify ${uid()}`;
    const testPhone = `+49 151 ${Math.floor(10000000 + Math.random() * 89999999)}`;
    
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Fill name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
    await nameInput.fill(testName);
    
    // Select phone tab
    const phoneTab = page.getByRole('tab', { name: /Handynummer/i });
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
    }
    
    // Fill phone
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill(testPhone);
    
    // Submit
    await page.getByRole('button', { name: /Weiter|Code senden/i }).click();
    
    // Wait for code entry step
    await expect(page.getByText(/Code eingeben|Bestätigungscode/i)).toBeVisible({ timeout: 15000 });
    
    // Enter bypass code
    const codeInputs = page.locator('input[inputmode="numeric"], input[type="text"][maxlength="1"]');
    const inputCount = await codeInputs.count();
    
    if (inputCount >= 6) {
      // Individual digit inputs
      for (let i = 0; i < 6; i++) {
        await codeInputs.nth(i).fill(smsCode[i]);
      }
    } else {
      // Single code input
      const singleInput = page.locator('input[name*="code"], input[placeholder*="Code"]').first();
      await singleInput.fill(smsCode);
    }
    
    // Submit verification
    const verifyBtn = page.getByRole('button', { name: /Bestätigen|Verifizieren|Prüfen/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
    }
    
    // Should proceed to confirmation or matches
    await expect(
      page.getByText(/Geschafft|Erfolgreich|Empfehlungen|bester Match/i)
    ).toBeVisible({ timeout: 20000 });
  });

  test('does NOT show matches without completing verification', async ({ page }) => {
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // We're on step 6 (contact) - haven't verified yet
    // URL should NOT be /matches/*
    await expect(page).not.toHaveURL(/\/matches\//);
    
    // Should still be in wizard, not on matches page
    await expect(page.getByText(/Wie heißt du|Dein Name/i)).toBeVisible();
  });

  test('email flow shows confirmation instructions', async ({ page }) => {
    const testName = `E2E Email ${uid()}`;
    const testEmail = `e2e-${uid()}@test.kaufmann-health.de`;
    
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Fill name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
    await nameInput.fill(testName);
    
    // Email tab should be default or select it
    const emailTab = page.getByRole('tab', { name: /E-Mail/i });
    if (await emailTab.isVisible()) {
      await emailTab.click();
    }
    
    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill(testEmail);
    
    // Submit
    await page.getByRole('button', { name: /Weiter|Absenden/i }).click();
    
    // Should show email confirmation instructions (magic link or code)
    await expect(
      page.getByText(/E-Mail gesendet|Posteingang|Bestätigungslink|Code eingeben/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Verification Flow - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await clearWizardState(page);
  });

  test('validates phone number format', async ({ page }) => {
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Fill name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
    await nameInput.fill('Test User');
    
    // Select phone tab
    const phoneTab = page.getByRole('tab', { name: /Handynummer/i });
    if (await phoneTab.isVisible()) {
      await phoneTab.click();
    }
    
    // Enter invalid phone
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('123'); // Too short
    
    // Try to submit
    const submitBtn = page.getByRole('button', { name: /Weiter|Code senden/i });
    await submitBtn.click();
    
    // Should show validation error OR button stays disabled
    // Either way, we should NOT be on code entry step
    await page.waitForTimeout(1000);
    const onCodeStep = await page.getByText(/Code eingeben|Bestätigungscode/i).isVisible().catch(() => false);
    expect(onCodeStep).toBe(false);
  });

  test('handles wrong verification code gracefully', async ({ page }) => {
    test.skip(!smsBypass, 'Requires SMS bypass to test code entry');
    
    const testName = `E2E Wrong ${uid()}`;
    const testPhone = `+49 151 ${Math.floor(10000000 + Math.random() * 89999999)}`;
    
    await page.goto('/fragebogen?variant=concierge');
    await navigateToContactStep(page);
    
    // Fill contact info
    await page.locator('input[name="name"], input[placeholder*="Name"]').first().fill(testName);
    const phoneTab = page.getByRole('tab', { name: /Handynummer/i });
    if (await phoneTab.isVisible()) await phoneTab.click();
    await page.locator('input[type="tel"]').fill(testPhone);
    await page.getByRole('button', { name: /Weiter|Code senden/i }).click();
    
    // Wait for code entry
    await expect(page.getByText(/Code eingeben|Bestätigungscode/i)).toBeVisible({ timeout: 15000 });
    
    // Enter WRONG code
    const codeInputs = page.locator('input[inputmode="numeric"], input[type="text"][maxlength="1"]');
    const inputCount = await codeInputs.count();
    const wrongCode = '999999';
    
    if (inputCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await codeInputs.nth(i).fill(wrongCode[i]);
      }
    } else {
      await page.locator('input[name*="code"]').first().fill(wrongCode);
    }
    
    const verifyBtn = page.getByRole('button', { name: /Bestätigen|Verifizieren/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
    }
    
    // Should show error, remain on verification step
    await expect(
      page.getByText(/ungültig|falsch|erneut|incorrect/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
