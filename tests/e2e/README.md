# E2E (Playwright) Tests

## Source of Truth

These tests must reflect the **current production user flows**, not legacy flows.

In particular:

- `/fragebogen` submits via `POST /api/public/questionnaire-submit`
- Redirect to `/matches/:uuid` happens **only when** `questionnaire-submit` returns `data.matchesUrl`
- If `matchesUrl` is `null`, the wizard stays on `/fragebogen` and shows:
  - `Keine Therapeuten gefunden. Bitte versuche es später erneut.`

## Running

- Run all E2E:
  - `npm run test:e2e`
- Run a subset:
  - `npm run test:e2e -- tests/e2e/test4-concierge-self-service.spec.ts`

Useful env vars:

- `NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true`
  - Enables self-service instant matches (otherwise `matchesUrl` is typically `null`)
- `E2E_WEB_COMMAND='npm run dev:safe'`
  - Prevents `npm run dev` from killing port 3000

Example:

```bash
NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true \
E2E_WEB_COMMAND='npm run dev:safe' \
npm run test:e2e -- tests/e2e/test3-concierge-marketplace.spec.ts
```

## Determinism (Required)

When tests depend on `/fragebogen`, always clear wizard state via `page.addInitScript`:

- `kh_wizard_data`
- `kh_wizard_step`
- `kh_form_session_id`
- `anonymousPatientId`
- (optional) `kh_flow_variant` (LP randomization)

## Test Data Marking (Recommended)

If your E2E run hits a real backend (staging/prod) and you want records to be filterable as test data:

- Set cookie `kh_test=1`
  - Easiest: add `?tt=1` once in the browser (see `src/components/TestMode.tsx`)
  - Or set the cookie in Playwright context

Server behavior:

- `POST /api/public/questionnaire-submit` persists `people.metadata.is_test=true` when test mode is detected
- Test mode is detected via `kh_test=1` and/or test-host detection (localhost/staging)
- IP rate limiting is bypassed for test requests

## Mocking Rules

- **Mock the authoritative endpoint** for the flow you are testing.
  - Questionnaire flow: mock `**/api/public/questionnaire-submit` (not the legacy leads endpoints).
  - Matches page: mock `**/api/public/matches/*`.

- **Match production gating**:
  - Concierge always returns `matchesUrl`.
  - Non-concierge only returns `matchesUrl` when `NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true`.

## Stable Selectors (Prefer These)

- Contact modal root:
  - `data-testid="contact-modal"`

- Primary booking CTA on therapist cards:
  - Role/button name: `Direkt buchen`

- Booking flow inside ContactModal:
  - Proceed CTA: `Weiter zur Eingabe`
  - Slot chips: `button[title="Online"]` / `button[title="Vor Ort"]`
  - Name input label: `Name *`

Avoid asserting brittle marketing copy unless the test is explicitly about copy.

## Cal.com Booking Flow Tests

New in EARTH-256/265: `cal-booking-flow.spec.ts` tests the Cal.com integration:

- **Intro session booking** (15 min free consultation)
- **Full session booking** (60 min standard rate)
- **Upsell flow** from intro to full session
- **Verification before booking** (required per EARTH-256)
- **Booking notification emails** (therapist + client confirmations)

Key mocks:
- `**/api/public/cal/slots*` - Cal.com slot availability
- `**/api/public/therapists*` - Therapist with `cal_username` set

## Step 6 Contact Form

All questionnaire flows must complete Step 6 (contact info collection) before redirecting to matches. Use the shared helper `completeStep6ContactForm(page)` which:

1. Waits for "Fast geschafft" heading
2. Fills name input
3. Switches to email mode
4. Fills email input
5. Clicks submit button

This is required because the wizard is a 9-step flow:
- Steps 1-5: Questionnaire
- Step 6: Contact Info (name + email/phone)
- Step 6.5: SMS verification (if phone)
- Steps 7-9: Confirmation screens
