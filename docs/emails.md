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

Templates: `rich_therapist`, `selection_nudge`, `feedback_request`, `email_confirmation`, `all`

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

### Email Cadence (Post-Verification Nurture)

Three-stage follow-up sequence for verified patients who haven't booked:

| Day | Template | Purpose |
|-----|----------|---------|
| 1 | `richTherapistEmail` | Personalized spotlight: top match with photo, modalities, approach text |
| 5 | `selectionNudge` | Reassurance: free intro call, chemistry shows in person, can switch |
| 10 | `feedbackRequest` | One-click feedback options + interview incentive (€25 voucher) |

Templates: `src/lib/email/templates/richTherapistEmail.ts`, `selectionNudge.ts`, `feedbackRequest.ts`

Crons: `GET /api/admin/leads/rich-therapist-email`, `/selection-nudge`, `/feedback-request`

Feedback landing page: `/feedback/quick?patient=...&reason=...` captures responses and offers interview scheduling.

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
