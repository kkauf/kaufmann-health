# QA Testing Guide (External Testers)

This guide is for freelancers and external QA testers working on Kaufmann Health.

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Feature Preview** | Shared per feature (Vercel preview URL) | QA testing for specific features |
| **Staging** | `staging.kaufmann-health.de` | General testing, always-on |
| **Production** | `www.kaufmann-health.de` | Live site (do not test here) |

### Which environment to use

**For specific feature testing:** The project owner will share a **Vercel preview URL** for the feature branch. This URL looks like `kaufmann-health-git-feature-xyz-*.vercel.app`. Use this URL for all testing of that feature.

**For general testing:** Use `staging.kaufmann-health.de`.

**Never test on production** (`www.kaufmann-health.de`).

## Test Mode Setup

Before testing, enable test mode by adding `?tt=1` to the URL once:

```
# On staging:
https://staging.kaufmann-health.de/start?tt=1

# On a feature preview (replace with the URL shared by the project owner):
https://kaufmann-health-git-feature-xyz-team.vercel.app/start?tt=1
```

This sets a `kh_test=1` cookie that:
- Marks all your data as test data (filtered from analytics)
- Routes booking emails to a sink address (not real therapists)
- Enables dry-run mode for bookings

## Test Accounts

On staging, any therapist you register is **automatically flagged as a test account** (`is_test: true`). This means:
- Test therapists do NOT appear in the public directory on production
- Test therapists are excluded from the matching algorithm on production
- Test therapists are excluded from public therapist counts
- In the admin panel, test accounts show an orange **TEST** badge
- On staging, you can toggle "Nur Test-Accounts" in admin to filter

You can also use `+test` in email addresses (e.g., `marta+test1@gmail.com`) for extra clarity.

## User Signup Flow

### Entry Points

Test both landing pages (replace `{base}` with your test environment URL):
- `{base}/therapie-finden` — Concierge flow
- `{base}/start` — Self-service flow

### Verification Options

The platform uses **phone-first verification** across all flows (questionnaire, directory booking, contact modal). Phone is the default; email is available via a "Lieber per E-Mail?" toggle.

#### Option A: SMS Verification (Recommended for QA)

1. Enter any phone number in the phone input step (it won't receive real SMS on staging)
2. **Use code `000000`** (six zeros) to bypass verification
3. Then enter your name (and optionally email) in the following step

This works because staging has `E2E_SMS_BYPASS` enabled.

#### Option B: Email Verification

1. Click "Lieber per E-Mail?" toggle on the phone input step
2. Enter an email address

**Important**: On staging, confirmation emails are routed to an internal sink address, not your actual email.

To test email verification:
1. Use an email address you control
2. Ask the project owner to forward the confirmation email from the sink
3. OR use the admin email preview endpoint (see below)

### After Verification

- **Self-service flow**: You'll see a matches page with therapist cards
- **Concierge flow**: You'll see a confirmation that matches are being curated (admin curates manually within 24h)

## Two-Phase Testing Approach

Testing is split into two phases to protect real therapists from receiving test emails/bookings.

### Phase 1: Signup & Matching (Safe - Test Freely)

The entire signup and matching flow is **safe to test without restriction**:

1. Complete questionnaire with any preferences
2. Verify via SMS (use code `000000`)
3. View matches page with real therapists
4. Browse therapist profiles, view availability, explore UI

**Why it's safe**: Matching only queries and displays therapists. No emails are sent, no bookings are created. You can test different preference combinations to verify matching logic works correctly.

**DO NOT proceed to actual bookings with matched therapists** — go to Phase 2 instead.

### Phase 2: Booking Flow (Use Test Therapist Only)

To test booking functionality, use the **designated test therapist** only:

**Test therapist portal**: `{base}/therapeuten`

1. Navigate directly to the public therapist directory
2. Find the designated test therapist (ask project owner for name/ID)
3. Complete booking flow with this therapist only

**Why this matters**:
- Real therapists would receive Cal.com calendar invites (we can't suppress these)
- Test therapist has Cal.com notifications disabled
- All KH emails still route to sink with `kh_test=1` active

### What to Test in Each Phase

| Phase 1 (Matching) | Phase 2 (Booking & Contact) |
|--------------------|-------------------|
| Questionnaire all steps (incl. match preview) | Slot selection UI |
| Phone-first verification + email toggle | Booking phone verification flow |
| Match preview (Step 5.75) display | Contact modal compose → verify → send |
| Name + Email + Consent collection | Confirmation emails (via preview) |
| Matches display & sorting | Calendar integration |
| Therapist profile views | Booking notifications |
| Filter/preference matching | |

### If No Test Therapist is Available

If you cannot book with a test therapist:
- Test the booking UI up to the final submit button
- Take screenshots of booking modal, slot selection, form fields
- Document in your QA report that booking submission was not tested
- Notify project owner so they can set up a test therapist

## Viewing Email Templates

Use the admin preview endpoint to see email templates without triggering real sends:

```bash
# View in browser (no send)
{base}/api/admin/emails/preview?template=email_confirmation&token=CRON_SECRET

# Available templates:
# - email_confirmation
# - rich_therapist
# - selection_nudge
# - feedback_request
# - all (sends all templates)
```

Ask the project owner for the `CRON_SECRET` token.

## Test Data Cleanup

All test data is automatically filtered:
- `metadata.is_test = true` on people/bookings
- Events have `properties.is_test = true`
- Admin stats exclude test records

No manual cleanup is typically needed.

---

## Test Cases

Below are all test cases organized by flow and priority. Each test case has an ID for reference in bug reports.

### I. Patient Journey

#### I.1. Questionnaire — Self-Service Path

The questionnaire has multiple steps. Step 1 (Timeline) was removed — the wizard now starts at Step 2.5.

**TC-I.1.1: Complete Self-Service questionnaire — Phone path (happy path)**
```
Steps:
  1. Navigate to /start or click "Therapeut:in finden" CTA on homepage
  2. Step 2.5 (Schwerpunkte): Select 2+ focus areas
     → Verify live therapist count updates as selections change
  3. Step 2.6 (Payment): Select self-pay option
  4. Step 3 (Modality): Select one or more modalities (e.g., NARM)
     → Verify "Ist mir egal" checkbox works
  5. Step 4 (Location): Select session format (Online / Vor Ort / Beides)
     → If "Vor Ort" or "Beides": verify city field appears and is required
     → Select language preference
  6. Step 5 (Gender): Select preference (male / female / no preference)
  7. Step 5.5 (Credential opt-in): "Weitere Therapeut:innen verfügbar" screen shown
     → Verify checkbox "Auch zertifizierte Körpertherapeut:innen anzeigen" appears
     → Default: unchecked. Leave unchecked for this test.
  8. Step 5.75 (Match Preview): Verify anonymized therapist cards shown
     → Heading: "X passende Therapeut:innen warten auf dich"
     → CTA button: "Ergebnisse freischalten"
     → Click CTA to proceed
  9. Step 6 (Phone): Verify ONLY phone number input shown (no name/email fields)
     → Enter phone number
     → Verify "Lieber per E-Mail?" toggle is visible
  10. Step 6.5 (SMS Verification): Receive 6-digit SMS code (use 000000 on staging)
     → Enter code → verify confirmation
  11. Step 6.75 (Name + Email + Consent):
     → Enter name (required)
     → Enter email (optional — leave blank for this test)
     → Verify consent checkbox shown → check it
     → Submit
  12. Verify redirect to /matches/{uuid} with therapist recommendations
Expected: All steps complete, instant matches shown (licensed-tier only when opt-in unchecked)
```

**TC-I.1.2: Questionnaire — Email verification path**
```
Steps:
  1. Complete steps 2.5-5.75 as above (through match preview)
  2. Step 6 (Phone): Click "Lieber per E-Mail?" toggle
     → Verify phone field is replaced by email input
     → Enter email address
  3. Step 6.75 (Name + Consent):
     → Enter name (required)
     → Verify consent checkbox shown → check it
     → Submit
  4. Verify confirmation screen: "Bestätigung ausstehend"
  5. Receive confirmation email (<30 seconds)
  6. Click confirmation link
  7. Verify redirect to /matches/{uuid} with therapist recommendations
Expected: Email toggle works, confirmation email flow completes, matches shown
```

**TC-I.1.3: Questionnaire — Navigation**
```
Steps:
  1. Start questionnaire, advance to Step 4
  2. Click "Zurück" → verify Step 3 shown with data preserved
  3. Use browser back button → verify previous step shown, data preserved
  4. From Step 5.75 (Match Preview): click back → verify Step 5.5 shown with data preserved
  5. From Step 6 (Phone): click back → verify match preview shown
  6. From Step 6.75 (Name + Email): click back → verify Step 6 shown
  7. Close browser, reopen with same ?fs= URL parameter → verify form state restored
Expected: Navigation preserves data at every step, form sessions allow resume
```

**TC-I.1.4: Questionnaire — Field validation**
```
Steps:
  1. Step 6 (Phone): Enter invalid phone (e.g., "12345") → verify validation error
  2. Step 6 (Phone): Leave phone empty → verify cannot proceed
  3. Step 6 (Email toggle): Toggle to email → enter invalid email (e.g., "abc") → verify validation error
  4. Step 6.75 (Name + Email): Leave name empty → click submit → verify validation error
  5. Step 6.75 (Name + Email): Enter invalid email format → verify validation error
  6. Step 6.75 (Name + Email): Leave consent unchecked → verify cannot proceed
  7. Step 4: Select "Vor Ort" but leave city empty → verify validation
Expected: Required fields enforced at each step, clear error messages shown
```

**TC-I.1.5a: Questionnaire — Credential opt-in (TherapieFinden origin)**
```
Steps:
  1. Navigate to /start or /therapie-finden (TherapieFinden entry)
  2. Complete steps 2.5-5
  3. Step 5.5: Verify "Weitere Therapeut:innen verfügbar" screen appears
     → Verify explanatory text about certified practitioners shown
     → Verify checkbox "Auch zertifizierte Körpertherapeut:innen anzeigen" (default unchecked)
  4. Check the checkbox → proceed to Step 5.75 (Match Preview)
  5. Complete remaining steps (phone/email → verification → name + consent)
  6. Verify matches include both licensed AND certified therapists
Expected: Opt-in step appears for TherapieFinden leads, checking it widens match pool
```

**TC-I.1.5b: Questionnaire — Credential opt-in skipped (modality page origin)**
```
Steps:
  1. Navigate to a modality page (e.g., /therapie/narm or /lp/narm)
  2. Click CTA to start questionnaire
  3. Complete steps 2.5-5
  4. Verify Step 5.5 (credential opt-in) is SKIPPED entirely
  5. Verify you go directly from Step 5 to Step 5.75 (Match Preview)
  6. Complete remaining steps (phone/email → verification → name + consent)
  7. Verify matches include both licensed AND certified therapists
Expected: Modality page leads skip opt-in, automatically get both tiers
```

**TC-I.1.5: Questionnaire — Concierge path**
```
Steps:
  1. Navigate to /therapie-finden (Concierge entry)
  2. Step 2.5: Select Schwerpunkte
  3. Step 2.6: Select insurance/Krankenkasse option
  4. Verify Step 2 appears: open text field "Was führt dich her?"
  5. Complete remaining preference steps (modality, location, gender)
  6. Step 5.75 (Match Preview): Verify match preview still appears
  7. Complete verification via phone (SMS code 000000) or email toggle
  8. Step 6.75: Enter name, optional email, consent
  9. Verify confirmation screen says matches will be curated (NOT instant matches)
  10. Verify NO instant matches page shown
Expected: Concierge path correctly separates from Self-Service, progressive disclosure steps still apply
```

**TC-I.1.6: Verification — Negative cases**
```
Steps:
  1. Phone: Enter wrong SMS code → verify error message
  2. Phone: Wait >10 minutes, enter original code → verify "Code expired"
  3. Phone: Request resend 3+ times → verify rate limit message
  4. Email: Click confirmation link with invalid ID → verify error page
Expected: All error states handled gracefully
```

**TC-I.1.7: Match Preview step — Zero matches**
```
Steps:
  1. Start questionnaire with very unusual preferences (rare combination)
  2. Reach Step 5.75 (Match Preview)
  3. Verify an encouraging message is shown even when 0 exact matches found
     → Should NOT show "0 passende Therapeut:innen"
     → Should still show CTA to proceed ("Ergebnisse freischalten" or similar)
  4. Click CTA → verify flow continues to Step 6 (phone input)
  5. Complete remaining steps
  6. Verify matches page still shows therapists (fallback behavior)
Expected: Zero-match scenario does not block the flow or discourage the user
```

**TC-I.1.8: Match Preview step — Display quality**
```
Steps:
  1. Complete questionnaire preferences with common selections (e.g., Berlin, NARM)
  2. Reach Step 5.75 (Match Preview)
  3. Verify therapist cards are anonymized (no real names, no clickable profiles)
  4. Verify card content gives a sense of therapist fit (modalities, format, location hints)
  5. Verify count in heading matches the number of cards shown
  6. Verify progress bar reflects current position in the flow
Expected: Preview builds trust and motivation to complete signup
```

**TC-I.1.9: Questionnaire — Progress bar through new steps**
```
Steps:
  1. Start questionnaire, note progress bar at each step:
     → Steps 2.5-5.5: progress bar advances as before
     → Step 5.75 (Match Preview): bar advances
     → Step 6 (Phone/Email): bar advances
     → Step 6.5 (SMS Verification): bar advances (phone path only)
     → Step 6.75 (Name + Email + Consent): bar advances
  2. Verify progress bar never jumps backward or skips positions
  3. Verify progress bar reaches end just before redirect to matches
Expected: Smooth, continuous progress indication through all steps
```

#### I.2. Matches & Therapist Recommendations

**TC-I.2.1: Match results display**
```
Precondition: Completed and verified Self-Service questionnaire
Steps:
  1. View /matches/{uuid} page
  2. Verify at least 3 therapist recommendations shown (system always shows 3+)
  3. Verify each card shows: photo, name, modalities, location, availability
  4. Verify quality badges appear where applicable
  5. Verify no duplicate therapists in results
Expected: Meaningful recommendations with complete profile information
```

**TC-I.2.2: Match results — Edge case preferences**
```
Steps:
  1. Submit questionnaire with very specific preferences (rare modality + specific city + specific gender)
  2. Verify matches page still shows at least 3 therapists (fallback behavior)
  3. Note: Some may be "partial" matches — this is expected when exact matches are limited
Expected: Never an empty results page
```

#### I.3. Therapist Contact Flow

**TC-I.3.1: Contact therapist — Phone verification path (happy path)**
```
Precondition: No active session (clear cookies or use incognito with ?tt=1)
Steps:
  1. On matches page or directory, click contact button on a therapist
  2. ContactModal opens → Step 1 (Compose):
     → Verify pre-composed message with patient context shown
     → Optionally edit the message
     → Click send/continue
  3. Step 2 (Phone): Verify phone number input shown
     → Enter phone number
     → Verify "Lieber per E-Mail?" toggle is visible
  4. Step 3 (SMS Verification): Enter code 000000 (staging bypass)
  5. Step 4 (Name): Verify name input shown
     → Enter name → submit
  6. Verify confirmation: message sent to therapist
  7. Check email sink: therapist receives email with patient message
Expected: Compose → phone → SMS → name → sent. Full flow completes.
Note: There is no separate "reason field" — the reason is embedded in the pre-composed message template.
```

**TC-I.3.1b: Contact therapist — Email verification path**
```
Precondition: No active session (clear cookies or use incognito with ?tt=1)
Steps:
  1. Click contact button on a therapist
  2. ContactModal opens → compose message → continue
  3. Step 2 (Phone): Click "Lieber per E-Mail?" toggle
     → Verify phone field replaced by email input
     → Enter email address → submit
  4. Step 3 (Name): Enter name → submit
  5. Verify message sent (email verification may be required before delivery)
Expected: Email toggle works in contact modal flow
```

**TC-I.3.1c: Contact therapist — Already verified (pre-authenticated)**
```
Precondition: Patient already verified in current session (has kh_client cookie)
Steps:
  1. Click contact button on a therapist
  2. ContactModal opens → compose message
  3. Verify phone/SMS steps are SKIPPED (already verified)
  4. Click send → verify confirmation shown immediately
Expected: Pre-authenticated users skip verification, go straight to compose → send
```

**TC-I.3.2: Contact rate limiting** *(automated — skip for manual QA)*
```
Coverage: Unit test in tests/api.public.contact.test.ts
  - Verifies 429 response after 3 contacts per 24h
  - Verifies RATE_LIMIT_EXCEEDED error code
Manual verification not needed — requires 4+ test therapist accounts for marginal value.
```

**TC-I.3.3: Contact requires verification**
```
Steps:
  1. Clear cookies / use incognito browser (add ?tt=1 for test mode)
  2. Navigate to /therapeuten, click contact on a therapist
  3. Verify compose step shown, then phone verification required before message is sent
  4. Verify cannot skip verification step
Expected: Unverified users must verify before message is delivered
```

#### I.4. Booking via Cal.com

**TC-I.4.1: Book intro session — Phone verification (happy path)**
```
Precondition: Test therapist with Cal.com enabled and available slots. No active session.
Steps:
  1. Find test therapist in directory (/therapeuten)
  2. Click booking button → booking modal opens
  3. Select available intro slot (15-minute, free)
  4. Step: Phone input → enter phone number
     → Verify "Lieber per E-Mail?" toggle visible
  5. Step: SMS Verification → enter code 000000 (staging bypass)
  6. Step: Name + Email → enter name (required), email (optional)
  7. Verify Cal.com booking is created
  8. Verify booking confirmation shown
  9. Check email sink: patient confirmation email sent (date, time, format, link if online)
  10. Check email sink: therapist notification email sent
Expected: Slot selection → phone → SMS → name → booking confirmed. Both parties notified.
```

**TC-I.4.1b: Book intro session — Email verification path**
```
Precondition: Test therapist with Cal.com enabled and available slots. No active session.
Steps:
  1. Find test therapist in directory
  2. Click booking button → select available intro slot
  3. Step: Phone input → click "Lieber per E-Mail?" toggle
     → Verify phone field replaced by email input
     → Enter email address
  4. Step: Name → enter name
  5. Verify booking proceeds (email confirmation may be required)
Expected: Email toggle works in booking flow
```

**TC-I.4.1c: Book intro session — Already verified (pre-authenticated)**
```
Precondition: Patient already verified in current session (has kh_client cookie)
Steps:
  1. Find test therapist in directory
  2. Click booking button → select available intro slot
  3. Verify phone/SMS steps are SKIPPED (already verified)
  4. Verify booking is created immediately after slot selection
  5. Verify booking confirmation shown
Expected: Pre-authenticated users skip verification in booking flow
```

**TC-I.4.2: Booking — No available slots**
```
Steps:
  1. Find therapist with no Cal.com slots configured
  2. Click booking → verify appropriate message (no slots available)
Expected: Graceful handling when therapist has no availability
```

#### I.5. Therapist Directory

**TC-I.5.1: Directory display and pagination**
```
Steps:
  1. Navigate to /therapeuten
  2. Verify initial load shows therapists (up to 5 initially)
  3. Click "Mehr anzeigen" → verify additional therapists appear
  4. Verify each card shows: photo, name, modalities, city, availability indicator
  5. Click a therapist card → verify detail modal with full profile
Expected: Directory loads, pagination works, profiles display correctly
```

**TC-I.5.2: Directory filtering — Modality**
```
Steps:
  1. Navigate to /therapeuten
  2. Filter: NARM → verify only NARM therapists shown
  3. Filter: Hakomi → verify only Hakomi therapists shown
  4. Filter: Somatic Experiencing → verify only SE therapists shown
  5. Filter: Core Energetics → verify only CE therapists shown
  6. Filter: Alle → verify all therapists shown
Expected: Each filter correctly restricts results
```

**TC-I.5.3: Directory filtering — Format**
```
Steps:
  1. Filter: Online → verify only online-available therapists shown
  2. Filter: Vor Ort → verify only in-person therapists shown
  3. Filter: Alle → verify all therapists shown
Expected: Format filter works correctly
```

**TC-I.5.4: Directory — Credential tier filtering**
```
Steps:
  1. Navigate to /therapeuten (default directory)
  2. Verify only licensed therapists shown (badge shows qualification like "Heilpraktikerin für Psychotherapie")
  3. Verify licensed therapists have emerald/green ShieldCheck badge
  4. Verify NO certified-tier therapists shown in default view
  5. Navigate to /therapeuten?modality=narm&tier=all (modality page link)
  6. Verify BOTH licensed and certified therapists with NARM modality shown
  7. Verify certified therapists have distinct badge: "Zertifizierte/r NARM-Therapeut:in" with slate/gray Award icon
Expected: Default directory = licensed only; modality page links = both tiers
```

**TC-I.5.4b: Directory — Tier-specific badge display**
```
Steps:
  1. Find a licensed therapist in directory
  2. Click to open profile modal
     → Verify emerald ShieldCheck badge with qualification title
     → Verify modalities section shows qualification with ShieldCheck icon
  3. Find a certified therapist (via /therapeuten?tier=all or modality page)
  4. Click to open profile modal
     → Verify slate Award badge with "Zertifizierte/r {Modality}-Therapeut:in"
     → Verify modalities section shows professional title with Award icon
     → Verify legal disclaimer shown: "[Name] bietet körpertherapeutische Begleitung an. Dies ist keine Psychotherapie im Sinne des Heilpraktikergesetzes."
Expected: Distinct visual treatment per tier, legal disclaimer for certified only
```

**TC-I.5.5: Directory — Responsive design**
```
Steps:
  1. View /therapeuten on desktop (1440px width)
  2. View on tablet (768px)
  3. View on mobile (375px)
  4. Verify cards, filters, and detail modal adapt correctly
Expected: Responsive layout at all breakpoints
```

#### I.6. Static Pages & Navigation

**TC-I.6.1: Homepage**
```
Steps:
  1. Navigate to / → verify page loads
  2. Verify CTAs: "Therapeut:in finden", "Jetzt Therapeut:in finden", "Alle Therapeut:innen ansehen"
  3. Click each CTA → verify correct redirect
  4. Verify images load, navigation menu works, footer links functional
  5. Test responsive: mobile (375px) and desktop (1440px)
Expected: All elements load and function correctly
```

**TC-I.6.2: Therapy information pages**
```
Steps:
  1. Navigate to /therapie → verify page loads with overview content
  2. Navigate to /therapie/narm → verify NARM-specific content
  3. Navigate to /therapie/hakomi → verify Hakomi content
  4. Navigate to /therapie/somatic-experiencing → verify SE content
  5. Navigate to /therapie/core-energetics → verify CE content
  6. On each page: verify CTAs navigate correctly, images load
  7. On each modality page: verify "Alle Therapeut:innen ansehen" button links to
     /therapeuten?modality={slug}&tier=all (should include both licensed + certified)
Expected: All therapy pages accessible with correct content; modality CTAs show all tiers
```

**TC-I.6.3: Über uns page**
```
Steps:
  1. Navigate to /ueber-uns
  2. Verify content and images load
  3. Verify CTAs and links work
Expected: Page loads correctly
```

**TC-I.6.4: Beratung page**
```
Steps:
  1. Navigate to /beratung
  2. Verify content loads, CTAs navigate correctly
Expected: Page loads correctly
```

**TC-I.6.5: Legal pages**
```
Steps:
  1. Navigate to /agb → verify loads
  2. Navigate to /datenschutz → verify loads
  3. Navigate to /impressum → verify loads
  4. Verify footer links point to correct pages
Expected: All legal pages accessible
```

---

### II. Therapist Journey

#### II.1. Registration & Onboarding

The therapist onboarding is a 4-step flow. Profile completion and document upload are **separate steps** (by design, to reduce dropout).

**TC-II.1.1: Full registration flow — Licensed tier (happy path)**
```
Steps:
  1. Navigate to /fuer-therapeuten → click "Jetzt registrieren"
  2. Step 1 — Registration (/therapists/register):
     → Fill: first name, last name, email, city (all required)
     → Select Qualifikation: "Heilpraktiker für Psychotherapie" (or "Approbierte:r Psychotherapeut:in" or "Heilpraktiker:in")
     → Optionally: phone, gender, modalities, accepting_new, session preferences, languages
     → Submit
  3. Verify redirect to /therapists/complete-profile/{id}
  4. Step 2 — Profile:
     → Upload photo (required)
     → Write approach text / "Who comes to me?" (required)
     → Optionally: first session description, about me, session focus, typical rate
     → Submit
  5. Verify redirect to /therapists/upload-documents/{id}
  6. Step 3 — Documents:
     → Verify "Staatliche Zulassung erforderlich" heading shown
     → Upload license (required for licensed tier)
     → Optionally: additional specialization certificates
     → Submit
  7. Verify redirect to /therapists/onboarding-complete/{id}
  8. Verify confirmation page shown with next steps
  9. Verify welcome email received (check sink on staging)
Expected: 4-step flow completes without errors
```

**TC-II.1.1b: Full registration flow — Certified tier (coach/Berater)**
```
Steps:
  1. Navigate to /fuer-therapeuten → click "Jetzt registrieren"
  2. Step 1 — Registration:
     → Fill required fields
     → Select Qualifikation: "Psychologische:r Berater:in"
     → Select at least one modality
     → Submit
  3. Complete Step 2 (Profile) as above
  4. Verify redirect to /therapists/upload-documents/{id}
  5. Step 3 — Documents:
     → Verify "Spezialisierungs-Zertifikat" heading shown (NOT "Staatliche Zulassung")
     → Verify NO license upload field — only specialization certificate upload
     → Upload specialization certificate → Submit
  6. Verify redirect to /therapists/onboarding-complete/{id}
Expected: Certified tier skips license requirement, only needs specialization cert
```

**TC-II.1.2: Registration — Qualification dropdown**
```
Steps:
  1. Navigate to /therapists/register
  2. Click "Qualifikation" dropdown
  3. Verify 4 options shown:
     → "Heilpraktiker für Psychotherapie"
     → "Approbierte:r Psychotherapeut:in"
     → "Heilpraktiker:in"
     → "Psychologische:r Berater:in"
  4. Select each option → verify form accepts selection
Expected: All 4 qualification options available and selectable
```

**TC-II.1.3: Registration — Field validation**
```
Steps:
  1. Step 1: Leave first name empty → verify validation error
  2. Step 1: Leave email empty → verify validation error
  3. Step 1: Enter duplicate email (already registered) → verify error
  4. Step 1: Leave city empty → verify validation error
  5. Step 2: Skip photo upload → verify validation error
  6. Step 2: Skip approach text → verify validation error
  7. Step 3 (licensed tier): Skip license upload → verify validation error
  8. Step 3 (certified tier): Verify license upload NOT required
Expected: Required fields enforced at each step, conditional on credential tier
```

**TC-II.1.4: Registration — Progress indicator**
```
Steps:
  1. At each step, verify progress indicator shows correct state
  2. Steps: Registrierung → Profil → Dokumente → Fertig
  3. Verify current step is highlighted, completed steps are marked
Expected: Progress indicator accurately reflects current position
```

**TC-II.1.5: Registration — Navigation links**
```
Steps:
  1. On /therapists/register: verify "Zurück zur Übersicht" links to /fuer-therapeuten
  2. On /therapists/register: verify "Zum Mitglieder-Login" links to /portal/login
Expected: Navigation links work
```

#### II.2. Therapist Portal

**TC-II.2.1: Portal login (magic link)**
```
Steps:
  1. Navigate to /portal/login
  2. Enter registered therapist email
  3. Receive magic link email (check sink on staging)
  4. Click magic link → verify redirect to /portal with authenticated session
  5. Verify profile data loaded correctly
Note: There is NO password login — authentication is via magic link only
Expected: Passwordless login works
```

**TC-II.2.2: Portal — Profile editing**
```
Precondition: Logged into therapist portal
Steps:
  1. Change city → save → verify updated
  2. Change approach text → save → verify updated
  3. Update modalities → save → verify updated
  4. Toggle accepting_new → save → verify updated
Expected: All profile fields editable and persist
```

**TC-II.2.3: Portal — Zurück zur Therapeuten-Seite**
```
Steps:
  1. On /portal/login, click "Zurück zur Therapeuten-Seite"
  2. Verify redirect to /fuer-therapeuten
Expected: Link works
```

#### II.3. Für Therapeut:innen Page

**TC-II.3.1: Page content and CTAs**
```
Steps:
  1. Navigate to /fuer-therapeuten → verify page loads
  2. Verify "Jetzt registrieren" button → /therapists/register
  3. Verify "Mitglieder-Login" button → /portal/login
  4. Verify FAQ dropdowns expand/collapse correctly
  5. Verify additional CTAs navigate correctly (e.g., "Mehr zu Beratung & digitalen Lösungen")
  6. Verify images and content load
Expected: All elements functional
```

---

### III. Cross-Cutting Concerns

**TC-III.1: Responsive design (all major pages)**
```
Pages to test: /, /therapeuten, /fragebogen, /therapie, /fuer-therapeuten, /ueber-uns
Breakpoints: Mobile (375px), Tablet (768px), Desktop (1440px)
Check: Layout, readability, touch targets, image scaling, modal behavior
Expected: All pages usable at all breakpoints
```

**TC-III.2: Browser back button**
```
Steps:
  1. During questionnaire: press back → verify previous step with data preserved
  2. On matches page: press back → verify reasonable behavior (no form re-submit)
  3. In directory: apply filter, press back → verify filter state
Expected: Back button behavior is intuitive, no data loss
```

**TC-III.3: Test account isolation**
```
Precondition: Register a test therapist on staging
Steps:
  1. Verify test therapist has orange TEST badge in admin panel
  2. Navigate to /therapeuten → verify test therapist does NOT appear
  3. Submit a questionnaire → verify test therapist is NOT in matches
  4. In admin: toggle "Nur Test-Accounts" → verify filter shows only test accounts
Expected: Complete isolation of test data from public views
```

---

### Negative / Edge Case Tests

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| NEG-1 | Step 6.75: Leave name empty and submit | Validation error, form not submitted |
| NEG-2 | Step 6 (email toggle): Enter invalid email format | Validation error |
| NEG-3 | Step 6: Enter invalid phone number (not E.164 format) | Validation error |
| NEG-4 | Step 6.5: Enter wrong SMS code | Error message shown |
| NEG-5 | Step 6.5: SMS code expired (>10 minutes) | "Code expired" message, must resend |
| NEG-6 | Step 6.5: Resend SMS code >3 times in 24h | Rate limit error |
| NEG-7 | Access /matches/{uuid} with invalid UUID | 404 or error page |
| NEG-8 | Therapist registration with duplicate email | Error: email already exists |
| NEG-9 | Close questionnaire mid-flow, reopen with ?fs= param | Form state restored from session |
| NEG-10 | Access therapist portal without valid session | Redirect to login |
| NEG-11 | Step 6.75: Leave consent checkbox unchecked and submit | Cannot proceed, validation error |
| NEG-12 | Directory booking: Enter wrong SMS code in booking modal | Error message, cannot proceed to name step |
| NEG-13 | Contact modal: Skip compose step (empty message) | Validation error or send disabled |

---

## Quick Reference

| Task | How |
|------|-----|
| Enable test mode | Add `?tt=1` to any URL once |
| Bypass SMS verification | Use code `000000` (all flows: questionnaire, booking, contact) |
| Switch to email verification | Click "Lieber per E-Mail?" toggle on phone input step |
| Test matching | Safe with any preferences (Phase 1) |
| Test booking | Use designated test therapist only (Phase 2) |
| Preview emails | Use `/api/admin/emails/preview` endpoint |
| Accidental real booking | Cancel via Cal.com email, notify project owner |
| Register test therapist | Register on staging — auto-flagged as test |
| Find test accounts in admin | Use "Nur Test-Accounts" toggle |
| Test a feature branch | Use the Vercel preview URL shared by the project owner |

## Reporting Issues

When reporting bugs, include:
1. **Test case ID** (e.g., TC-I.1.1) if applicable
2. The URL where the issue occurred
3. Steps to reproduce
4. Expected vs actual behavior
5. Screenshot or browser console errors (if any)
6. Your test email/phone if relevant

## Contact

For questions about testing setup or access to admin endpoints, contact the project owner.
