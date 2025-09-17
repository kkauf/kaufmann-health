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

Notes:
- Always use absolute links (derive from `BASE_URL`) when linking to your site.
- Keep business logic in the route/hook, not inside templates.

## Deliverability (why)

- To avoid spam filters, patient-facing emails must not include external links. Multiple external domains in a single email are a known spam signal and reduce inbox placement.
- Flagged domains we explicitly avoid in emails: `narmtraining.com`, `traumahealing.org`, `hakomi.de`, `coreenergetics.nl`.
- Use only internal links derived from `BASE_URL` (e.g., booking pages, match selection URLs). If education is needed, link on the website, not in the email.
- Enforcement: a unit test (`tests/email.patientSelection.links.test.ts`) asserts these domains are not present in the patient selection email.
 - Images in patient-facing emails are served from our own domain via the proxy endpoint `/api/images/therapist-profiles/...` to avoid external image-domain warnings in providers like Resend and Gmail. See `src/app/api/images/therapist-profiles/[...path]/route.ts`.

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

## Testing

- Unit test templates directly (string assertions). See:
  - `tests/email.therapist-welcome.test.ts`
  - `tests/email.notification.test.ts`
  - `tests/email.layout.test.ts`
  - `tests/email.emailConfirmation.test.ts`
  - `tests/email.patientSelection.schema.test.ts`
- In tests, `sendEmail()` is a no-op when `RESEND_API_KEY` is empty, so accidental sends are avoided.
