# Transactional Emails (Resend)

This codebase uses Resend for transactional email. The goal: keep email rendering simple, avoid PII in internal notifications, and centralize shared layout/styles.

## Architecture (Why it’s built this way)

- **Shared layout/styles**: `src/lib/email/layout.ts` renders a branded HTML shell so templates don’t duplicate markup.
- **Thin sender**: `src/lib/email/client.ts` wraps the Resend HTTP API. It no-ops when `RESEND_API_KEY` is missing (tests/local).
- **Templates**: Each email is a small pure function that returns `{ subject, html?, text? }`.
- **Security/PII**: Internal notifications contain no personal data; we include only a `Lead ID` for lookup in Supabase.
- **Absolute links**: Use `BASE_URL` so links render correctly in all email clients.

## Adding a new transactional email (How)

1. **Create a template** in `src/lib/email/templates/`:

```ts
// src/lib/email/templates/exampleWelcome.ts
import { renderLayout, renderButton } from '@/lib/email/layout';
import type { EmailContent } from '@/lib/email/types';

export function renderExampleWelcome(params: { name?: string | null }): EmailContent {
  const name = (params.name || '').trim();
  const contentHtml = `
    <h1 style="color:#111827; font-size:22px; margin:0 0 12px;">Welcome!</h1>
    <p style="margin:0 0 12px;">Hello${name ? ` ${escapeHtml(name)}` : ''}, thanks for signing up.</p>
    <div style=\"text-align:center\">${renderButton('https://kaufmann-health.de', 'Open')}</div>
  `;
  return { subject: 'Welcome', html: renderLayout({ title: 'Welcome', contentHtml }) };
}

function escapeHtml(s: string) {
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
```

2. **Send it** from your route or hook:

```ts
import { sendEmail } from '@/lib/email/client';
import { renderExampleWelcome } from '@/lib/email/templates/exampleWelcome';

const { subject, html } = renderExampleWelcome({ name: user.name });
await sendEmail({ to: user.email, subject, html });
```

- To avoid spam filters, patient-facing emails must not include external links. Multiple external domains in a single email are a known spam signal and reduce inbox placement.
- Flagged domains we explicitly avoid in emails: `narmtraining.com`, `traumahealing.org`, `hakomi.de`, `coreenergetics.nl`.
- Use only internal links derived from `BASE_URL` (e.g., booking pages, match selection URLs). If education is needed, link on the website, not in the email.
- Enforcement: a unit test (`tests/email.patientSelection.links.test.ts`) asserts these domains are not present in the patient selection email.
- Images in patient-facing emails are served from our own domain via the proxy endpoint `/api/images/therapist-profiles/...` to avoid external image-domain warnings in providers like Resend and Gmail. See `src/app/api/images/therapist-profiles/[...path]/route.ts`.

### Success pattern (guidelines)

- **Text/plain fallback**: Always include a text version. Our sender (`src/lib/email/client.ts`) auto-generates a plain‑text fallback from HTML if `text` is omitted, but if you customize templates it’s fine to pass an explicit `text` too.
- **List-Unsubscribe for recurring therapist emails**: Add headers on reminder/onboarding emails (not on one-off transactional messages). This surfaces Gmail’s native unsubscribe and lowers complaints.
- **Keep link density low**: Prefer a single primary CTA. Patient selection is moving to the web (fewer individual card links inside the email).
- **No external domains in patient emails**: Keep all links first‑party (already enforced above).
- **Clean subjects**: Short, descriptive, no gimmicks. Avoid emojis for therapist notifications.
- **First‑party images only**: Already proxied to our domain; do not inline third‑party images.
- **Sender is human‑friendly**: Use `kontakt@kaufmann-health.de`, never `no-reply`. Encourage direct replies.
- **Authentication & alignment**: SPF includes Resend, DKIM is signed on our domain, DMARC aligned; keep `From` domain consistent.
- **Gentle send patterns**: Avoid bursty, look‑alike sends. Space tests, randomize delays, and avoid subject codes or visible test markers.

### Gmail JSON-LD Schema (inbox actions)

- We inject optional Gmail schema (JSON-LD) into the `<head>` of emails to improve deliverability signals and enable inbox actions in Gmail.
- Implementation: `renderLayout({ title, contentHtml, preheader?, schema? })` accepts an optional `schema` object, serialized into a `<script type="application/ld+json">` block.
- Templates that currently include schema:
  - `emailConfirmation` (ConfirmAction → confirm email)
  - `patientSelection` (ViewAction → open therapist recommendations)
  - `therapistWelcome` (ViewAction → complete profile)
- Best practices:
  - One primary action per email; keep `name` short.
  - Only use HTTPS URLs from our domain (`BASE_URL`).
  - Test with Gmail Email Markup Tester.

### Preheader text

- `renderLayout` supports an optional `preheader` string rendered as a hidden preheader snippet to improve open rates.

## Internal notifications (PII-free)

Use `buildInternalLeadNotification()` to construct subject/text with type and city, excluding PII:
- Subject: `Lead: therapist · Berlin` (fallback `unknown` city)
- Body: first line repeats type+city, includes `Lead ID: <uuid>`.
- Therapist includes `Contract signed automatically`.

## Environment

- `RESEND_API_KEY` — required to actually send emails (in CI/tests we keep it empty to disable sending).
- `LEADS_FROM_EMAIL` — sender address used by `sendEmail()`.
- `NEXT_PUBLIC_BASE_URL` — base domain for absolute links in templates.
- `LEADS_NOTIFY_EMAIL` — optional sink address for manual testing. When `kh_test=1` cookie is present, booking emails are rerouted here (see Testing below).

## Testing

- Unit test templates directly (string assertions). See:
  - `tests/email.therapist-welcome.test.ts`
  - `tests/email.notification.test.ts`
  - `tests/email.layout.test.ts`
  - `tests/email.emailConfirmation.test.ts`
  - `tests/email.patientSelection.schema.test.ts`
  - `tests/email.new-cadence.test.ts` (Day 1/5/10 templates)
- In tests, `sendEmail()` is a no-op when `RESEND_API_KEY` is empty, so accidental sends are avoided.

### QA Preview Endpoint

Send email templates to `LEADS_NOTIFY_EMAIL` for visual QA:

```bash
# Send all templates
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=all&send=true&token=YOUR_CRON_SECRET"

# Preview HTML in browser (no send)
open "https://www.kaufmann-health.de/api/admin/emails/preview?template=rich_therapist&token=YOUR_CRON_SECRET"
```

Templates: `rich_therapist`, `selection_nudge`, `feedback_request`, `feedback_behavioral`, `email_confirmation`, `all`

Note: `feedback_behavioral` renders all 10 variants (4 segments + 7 rejection sub-variants) in one batch.

### Booking templates

- `bookingTherapistNotification` → `src/lib/email/templates/bookingTherapistNotification.ts`
  - Sent to therapist on successful booking.
  - Includes: date, time, format, address (Vor Ort), patient name/email preview.
- `bookingClientConfirmation` → `src/lib/email/templates/bookingClientConfirmation.ts`
  - Sent to client on successful booking.
  - Includes: therapist name, date, time, format. For Online: “Zoom‑Link wird zugesendet”. For Vor Ort: address.

Trigger points:
- `POST /api/public/bookings` (direct create)
- `POST /api/public/verification/verify-code` (when processing `draft_booking`)
- `GET /api/public/leads/confirm` (when processing `draft_booking`)

### Native Booking Flow (Cal.com Integration)

Cal.com-enabled therapists use a different email flow triggered by the Cal.com webhook.

**Templates:**

- `calBookingClientConfirmation` → `src/lib/email/templates/calBookingClientConfirmation.ts`
  - Sent to patient after Cal.com booking is confirmed.
  - Includes: therapist name, date, time, duration, video link (for online), address (for in-person).
  - Differentiates between **intro** (free 15-min) and **full session** (paid).
  - Shows pricing context for intro sessions ("Dieses Gespräch ist kostenlos").

- `calBookingTherapistNotification` → `src/lib/email/templates/calBookingTherapistNotification.ts`
  - Sent to therapist when a patient books via Cal.com.
  - Includes: patient name/email, session type, date, time, location type.

- `calBookingReminder` → `src/lib/email/templates/calBookingReminder.ts`
  - Sent 24h before a Cal.com booking (intro or full session).
  - Includes: therapist name, date/time, video link or address.
  - Cron: `GET /api/admin/cal/booking-reminders` (runs daily at 09:00)

- `calIntroFollowup` → `src/lib/email/templates/calIntroFollowup.ts`
  - Sent ~2 hours after an intro session ends.
  - Purpose: Encourage booking a full session if the intro went well.
  - Includes: next available slot suggestion, link to book full session, or browse other therapists.
  - Triggered via: `MEETING_ENDED` webhook in `/api/public/cal/webhook`

- `calSessionFollowup` → `src/lib/email/templates/calSessionFollowup.ts`
  - Sent the morning after a full session ends (10-30h window).
  - Purpose: Provide booking link for when patient is ready — not pushy, just informative.
  - **Only sent if therapist has available slots** (checked via `cal_slots_cache`).
  - Includes: next available slot suggestion, direct booking link, reassurance they can take their time.
  - Cron: `GET /api/admin/cal/booking-followups?stage=session_followup` (runs hourly)

**Trigger points:**

| Event | Trigger | Emails Sent |
|-------|---------|-------------|
| Patient books intro | `POST /api/public/cal/webhook` (BOOKING_CREATED) | Client confirmation, Therapist notification |
| Patient books session | `POST /api/public/cal/webhook` (BOOKING_CREATED) | Client confirmation, Therapist notification |
| 24h before booking | Cron `/api/admin/cal/booking-followups?stage=reminder_24h` | Client reminder |
| 1h before booking | Cron `/api/admin/cal/booking-followups?stage=reminder_1h` | Client reminder (SMS if phone) |
| Intro session ends | `POST /api/public/cal/webhook` (MEETING_ENDED) | Client followup (upsell) |
| Morning after full session | Cron `/api/admin/cal/booking-followups?stage=session_followup` | Client followup (if slots available) |

**Idempotency columns** (in `cal_bookings` table):
- `client_confirmation_sent_at` - Prevents duplicate client confirmations
- `therapist_notification_sent_at` - Prevents duplicate therapist notifications  
- `reminder_24h_sent_at` - Prevents duplicate 24h reminders
- `reminder_1h_sent_at` - Prevents duplicate 1h reminders
- `followup_sent_at` - Prevents duplicate intro followups
- `session_followup_sent_at` - Prevents duplicate session followups

**Test mode:** When `kh_test=true` is passed in Cal.com booking metadata (via URL param), emails route to `LEADS_NOTIFY_EMAIL` sink instead of real recipients.

### Cancellation Recovery Flow

When a booking is cancelled, we have a recovery flow to help the patient find another therapist:

**Templates:**

- `cancellationRecovery` → `src/lib/email/templates/cancellationRecovery.ts`
  - Sent ~2h after a booking is cancelled.
  - Shows empathy ("Das ist völlig in Ordnung"), highlights other matches, and offers free intro call tip.
  - Subject: "War [Therapeut] nicht der/die Richtige? Hier sind deine anderen Empfehlungen"
  - Cron: `GET /api/admin/cal/cancellation-recovery` (runs hourly)

**Trigger points:**

| Event | Trigger | Emails Sent |
|-------|---------|-------------|
| Booking cancelled | Cron `/api/admin/cal/cancellation-recovery` (2-4h window) | Recovery email with other matches |
| 10 days post-verification (with cancelled booking) | Cron `/api/admin/leads/feedback-request` | Feedback request |

**Match page behavior:**
- Therapists with cancelled bookings are automatically hidden from the patient's `/matches/[uuid]` page.
- This ensures the patient sees their other options without the cancelled therapist.

**Idempotency & Skip Logic (patient-level):**
- If patient has ANY successful (non-cancelled) booking → skip (they recovered on their own)
- Recovery email tracked via `events` table with `kind: 'cancellation_recovery'` and `patient_id`
- Checked at patient level, not booking level, to prevent duplicates
- Dedupes by patient_id within each cron run

### Email & SMS Cadence

Post-verification nurture sequences are documented separately. See internal documentation for timing details.

**For the complete post-booking patient journey (reminders, followups, recovery flows), see [`docs/patient-journey-post-booking.md`](./patient-journey-post-booking.md).**

Key templates:
- `richTherapistEmail` — Personalized therapist spotlight
- `selectionNudge` — Reassurance about process
- `feedbackRequest` — Generic feedback collection (fallback)
- `feedbackBehavioral` — Behavior-aware Day 10 email with 4 variants:
  - **D (almost_booked)**: Patient opened contact modal but didn't book. Shows therapist + direct booking CTA.
  - **A (never_visited)**: Never visited match page. Mini therapist card + slot scarcity.
  - **B (visited_no_action)**: Visited but took no action. Social proof + reassurance.
  - **C (rejected)**: Actively rejected a therapist. 7 sub-variants addressing specific objections (not_right_fit, method_wrong, too_expensive, wants_insurance, no_availability, location_wrong, other).
  - Classification: `src/lib/email/patientBehavior.ts` batch-classifies via events table.
  - Falls back to generic `feedbackRequest` if no matches or classification fails.

### Therapist Cal.com Onboarding
- `therapistCalOnboarding` → `src/lib/email/templates/therapistCalOnboarding.ts`
  - Sent once a therapist's Cal.com account is provisioned
  - Includes: Login credentials, booking profile link, setup guide

### Deliverability test (manual)

- Use `scripts/send-spam-test.ts` for small, staggered sends:

  ```bash
  RESEND_API_KEY=... tsx scripts/send-spam-test.ts --max=5
  # Optional marker appended subtly (not in subject):
  RESEND_API_KEY=... tsx scripts/send-spam-test.ts --to="a@example.com,b@example.com" --marker="trace-123" --max=10
  ```

- The script avoids subject markers, caps recipients by default, and randomizes per‑send delays to prevent burst patterns that look like outreach.

### Manual booking email tests (kh_test sink)

- Set the browser cookie `kh_test=1` and ensure `LEADS_NOTIFY_EMAIL` is configured.
- When `kh_test=1` is present, booking emails are rerouted to `LEADS_NOTIFY_EMAIL` (therapist and client messages) and the flow runs in **dry‑run** mode: no DB inserts, no `draft_booking` clearing.
- Analytics event `booking_dry_run` is tracked with the same props as `booking_created`.
- Scope: booking emails only, at the three trigger points listed above. E2E tests do not rely on this; they run with `RESEND_API_KEY` unset to avoid real sends.

---

## Complete Template Catalog

All templates are located in `src/lib/email/templates/`. This is the authoritative list of all 27 email templates.

### Patient Templates

| Template | File | Trigger | Purpose |
|----------|------|---------|---------|
| `emailConfirmation` | `emailConfirmation.ts` | `POST /api/public/leads` | Confirm email address (magic link) |
| `patientSelection` | `patientSelection.ts` | `POST /api/admin/matches/email?template=selection` | Send therapist recommendations with quality box |
| `patientApology` | `patientApology.ts` | `POST /api/admin/matches/rebuild?send_notification=true` | Apology + re-sent matches after matching bugs |
| `patientUpdates` | `patientUpdates.ts` | Manual admin trigger | General patient communication |
| `matchLinkRefresh` | `matchLinkRefresh.ts` | When patient requests new link | Resend match page access link |
| `richTherapistEmail` | `richTherapistEmail.ts` | Cron (Day 1) | Personalized spotlight of top match |
| `selectionNudge` | `selectionNudge.ts` | Cron (Day 5) | Reassurance about free intro call |
| `feedbackRequest` | `feedbackRequest.ts` | Cron (Day 10) | Generic feedback + interview offer (fallback) |
| `feedbackBehavioral` | `feedbackBehavioral.ts` | Cron (Day 10) | Behavior-aware feedback (4 variants) |

### Booking Templates (Native)

| Template | File | Trigger | Purpose |
|----------|------|---------|---------|
| `bookingClientConfirmation` | `bookingClientConfirmation.ts` | `POST /api/public/bookings` | Confirm native KH booking to patient |
| `bookingTherapistNotification` | `bookingTherapistNotification.ts` | `POST /api/public/bookings` | Notify therapist of new native booking |

### Booking Templates (Cal.com)

| Template | File | Trigger | Purpose |
|----------|------|---------|---------|
| `calBookingClientConfirmation` | `calBookingClientConfirmation.ts` | Cal.com webhook | Confirm Cal.com booking to patient |
| `calBookingTherapistNotification` | `calBookingTherapistNotification.ts` | Cal.com webhook | Notify therapist of Cal.com booking |
| `calBookingReminder` | `calBookingReminder.ts` | Cron (24h/1h before) | Remind patient of upcoming booking |
| `calIntroFollowup` | `calIntroFollowup.ts` | Cal.com webhook (MEETING_ENDED) | Upsell full session after intro |
| `calSessionFollowup` | `calSessionFollowup.ts` | Cron (next morning) | Provide booking link for next session |
| `cancellationRecovery` | `cancellationRecovery.ts` | Cron (2-4h after cancel) | Show other matches after cancellation |

### Therapist Onboarding Templates

| Template | File | Trigger | Purpose |
|----------|------|---------|---------|
| `therapistWelcome` | `therapistWelcome.ts` | `POST /api/public/leads` (type=therapist) | Welcome + profile completion CTA |
| `therapistUploadConfirmation` | `therapistUploadConfirmation.ts` | `POST /api/public/therapists/[id]/documents` | Confirm document upload received |
| `therapistDocumentReminder` | `therapistDocumentReminder.ts` | Cron (Day 1, 3, 7) | Remind to upload license |
| `therapistReminder` | `therapistReminder.ts` | Cron (daily) | Remind about incomplete profile |
| `therapistApproval` | `therapistApproval.ts` | `PATCH /api/admin/therapists/[id]` (verified) | Welcome to platform after verification |
| `therapistRejection` | `therapistRejection.ts` | `PATCH /api/admin/therapists/[id]` (rejected) | Rejection notification |
| `therapistCalOnboarding` | `therapistCalOnboarding.ts` | Cal.com provisioning | Cal.com login credentials + setup guide |
| `therapistAvailabilityReminder` | `therapistAvailabilityReminder.ts` | Cron (Fridays) | Weekly reminder to update availability |

### Therapist Match Flow Templates

| Template | File | Trigger | Purpose |
|----------|------|---------|---------|
| `therapistNotification` | `therapistNotification.ts` | Patient selects/admin creates match | New patient request with magic link |
| `therapistMagicLink` | `therapistMagicLink.ts` | Therapist requests portal access | Portal login magic link |
| `therapistDecline` | `therapistDecline.ts` | Therapist declines match | Notify patient with alternatives |

---

## Template Development Checklist

When creating a new template:

1. **Create the template function** in `src/lib/email/templates/`:
   ```typescript
   import { renderLayout, renderButton } from '@/lib/email/layout';
   import type { EmailContent } from '@/lib/email/types';
   
   export function renderTemplateName(params: { ... }): EmailContent {
     const contentHtml = `...`;
     return {
       subject: 'German subject line',
       html: renderLayout({ title: 'Title', contentHtml, preheader: 'Preview text' }),
     };
   }
   ```

2. **Export from index** (if using barrel exports)

3. **Add trigger point** in the appropriate route handler

4. **Add test** in `tests/email.*.test.ts`

5. **Document here** with trigger and purpose

6. **Use fire-and-forget pattern** to avoid blocking user flows:
   ```typescript
   void sendEmail(params).catch(e => {
     void logError('email.template_name', e, { context });
   });
   ```

---

## Email Design Rules

1. **All German** — All patient-facing emails are in German
2. **No external links** — Only use `BASE_URL` links (spam prevention)
3. **Proxied images** — Therapist photos via `/api/images/therapist-profiles/`
4. **Single primary CTA** — One clear action per email
5. **Human sender** — Always `kontakt@kaufmann-health.de`
6. **List-Unsubscribe** — Add for recurring therapist emails only
7. **Plain text fallback** — Auto-generated if not provided
8. **Preheader text** — Use for better open rates
