# QA Testing Guide (External Testers)

This guide is for freelancers and external QA testers working on Kaufmann Health.

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Staging** | `staging.kaufmann-health.de` | Safe testing environment |
| **Production** | `www.kaufmann-health.de` | Live site (do not test here) |

**Always use staging for testing.**

## Test Mode Setup

Before testing, enable test mode by adding `?tt=1` to any staging URL once:

```
https://staging.kaufmann-health.de/start?tt=1
```

This sets a `kh_test=1` cookie that:
- Marks all your data as test data (filtered from analytics)
- Routes booking emails to a sink address (not real therapists)
- Enables dry-run mode for bookings

## User Signup Flow

### Entry Points

Test both landing pages:
- `staging.kaufmann-health.de/therapie-finden` — Concierge flow
- `staging.kaufmann-health.de/start` — Self-service flow

### Verification Options

After completing the questionnaire (Steps 1-5), you'll need to verify via email or phone.

#### Option A: SMS Verification (Recommended for QA)

1. Choose "Per Telefon verifizieren"
2. Enter any phone number (it won't receive real SMS on staging)
3. **Use code `000000`** (six zeros) to bypass verification

This works because staging has `E2E_SMS_BYPASS` enabled.

#### Option B: Email Verification

**⚠️ Important**: On staging, confirmation emails are routed to an internal sink address, not your actual email.

To test email verification:
1. Use an email address you control
2. Ask the project owner to forward the confirmation email from the sink
3. OR use the admin email preview endpoint (see below)

### After Verification

- **Self-service flow**: You'll see a matches page with therapist cards
- **Concierge flow**: You'll see a confirmation that matches are being curated

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

**Test therapist portal**: `staging.kaufmann-health.de/therapeuten`

1. Navigate directly to the public therapist directory
2. Find the designated test therapist (ask project owner for name/ID)
3. Complete booking flow with this therapist only

**Why this matters**:
- Real therapists would receive Cal.com calendar invites (we can't suppress these)
- Test therapist has Cal.com notifications disabled
- All KH emails still route to sink with `kh_test=1` active

### What to Test in Each Phase

| Phase 1 (Matching) | Phase 2 (Booking) |
|--------------------|-------------------|
| Questionnaire steps 1-5 | Slot selection UI |
| SMS/email verification | Booking form submission |
| Matches display & sorting | Confirmation emails (via preview) |
| Therapist profile views | Calendar integration |
| Filter/preference matching | Booking notifications |

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
https://staging.kaufmann-health.de/api/admin/emails/preview?template=email_confirmation&token=CRON_SECRET

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

## Quick Reference

| Task | How |
|------|-----|
| Enable test mode | Add `?tt=1` to any URL once |
| Bypass SMS verification | Use code `000000` |
| Test matching | Safe with any preferences (Phase 1) |
| Test booking | Use designated test therapist only (Phase 2) |
| Preview emails | Use `/api/admin/emails/preview` endpoint |
| Accidental real booking | Cancel via Cal.com email, notify project owner |

## Reporting Issues

When reporting bugs, include:
1. The URL where the issue occurred
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser console errors (if any)
5. Your test email/phone if relevant

## Contact

For questions about testing setup or access to admin endpoints, contact the project owner.
