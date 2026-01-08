# Architecture Overview

- __App Router__: Pages in `src/app/` (UI only: rendering, local state, event handlers). Business logic does not live in components.
- __Components__: Reusable UI in `src/components/` and shadcn-generated primitives in `src/components/ui/`.
- __API routes__: Server-only logic in `src/app/api/*` with `export const runtime = 'nodejs'` where secrets (service role) are required. Public site stays cookie-free; only server routes touch the database or secrets.
- __Lib__: Shared utilities in `src/lib/` including Supabase clients and Cal.com integration logic.
- __Cal.com (Gated Infrastructure)__: Approved therapists are provisioned into a managed Cal.com instance. The backend handles provisioning, slot fetching, and booking ingestion.

### Shared UI: TherapistPreview
- Variants: `web` (customer-facing), `admin` (richer triage info), `email` (inline-styled, client-safe). Location: `src/components/TherapistPreview.tsx` and email snippet in `src/lib/email/components/therapistPreview.ts`.
- Admin-only fields: status, availability, email, phone, and created_at render in the `admin` variant to support triage; these are hidden in the public/customer variant.
- Modality presentation (business rule):
  - Casing: NARM is `NARM`; others are Title Case (e.g., `Hakomi`, `Somatic Experiencing`, `Core Energetics`).
  - Style: Solid brand pills with overflow `+N` when many modalities are present. Email uses the same labels/colors but inline styles.
- Why: Single source of truth for therapist cards across web/admin/email to prevent divergence and keep UX consistent.

## Data Flow (Frontend → API → DB)
- Patient intake is email-first:
  - Step 1 posts to `POST /api/public/leads` with just name/email/session preference. Lead is stored with `status='pre_confirmation'`, token issued, and confirmation email sent.
  - Fragebogen completion calls `POST /api/public/leads/:id/form-completed`: stamps `form_completed_at`, persists a subset of answers into `people.metadata`, and fires server-side Enhanced Conversions. Client `gtag` conversion also fires with dedupe.
  - Confirmation (via `GET /api/public/leads/confirm`) stamps `email_confirmed_at` and redirects to `/fragebogen?confirm=1[&id=<id>&fs=<fs>]`. The Fragebogen (step 6) is the single surface that renders the confirmed variant. Status is set to `email_confirmed` by default (or `new` when `form_completed_at` already exists). Activation occurs per `VERIFICATION_MODE` when requirements are satisfied.
- Therapist intake uses the same `POST /api/public/leads` endpoint but accepts JSON or `multipart/form-data` for profile + compliance docs.
  - Documents land in private buckets; only server/admin can read (RLS enforced).
- Attribution events go to `POST /api/public/events` (server merges session/referrer/UTM; no client cookies).
- Magic link actions go to `POST /api/match/[uuid]/respond` (therapist accept/decline).
- Admin dashboard uses `/api/admin/*` routes for stats and match actions (protected; see Security).
- Route handlers use the server-side Supabase client (service role) to write to Postgres.
- API responses consistently return `{ data, error }` (see [API docs](./api.md)).

Why this design:
- Keeps secrets and DB writes on the server.
- Keeps components simple and testable.
- Aligns with RLS and security best practices.
- Enables server-side measurement (privacy-first, cookie-free public site).

## Supabase & Database
- Tables: `people`, `matches`, `therapist_contracts` (see [data-model](./data-model.md)).
- Defaults: `id gen_random_uuid()`, `created_at timestamptz now()`.
- RLS enabled on tables. Note: the service role client bypasses RLS by design—route handlers must validate inputs and enforce rules.
- Storage: private bucket `therapist-documents` for verification uploads. RLS: authenticated insert; `service_role` can read/manage. Reason: keep PHI-like docs out of public scope and downloadable only by backend.

## Key flows and decisions:
- Therapist verification: therapist leads default to `pending_verification`; admin can move to `verified/rejected`. Reason: quality control before introductions.
- Matches include `secure_uuid` used for magic links; timestamps like `therapist_contacted_at`, `therapist_responded_at`, `patient_confirmed_at` support auditability.

### Two-Step Therapist Onboarding (EARTH-129)
- Why: Conversion dropped when profile text/photo and compliance docs were coupled. Many therapists abandon if they can't scan the license immediately. Splitting flows reduces time-to-first-success.
- Design: Step 1 (fun & fast) collects only profile basics and pending photo; Step 2 (compliance) uploads the license (certificates optional). Public pages mirror this logic so users always see the next actionable step.
- Emails/Reminders: Subjects and CTAs adapt to what's actually missing (license vs profile). This keeps nudges relevant without extra client logic.

### Patient-Initiated Contact Flow (EARTH-203/205/206)
- **Why**: Enable direct patient→therapist contact from directory; reduce admin matching bottleneck; preserve privacy until acceptance.
- **Patient journey**:
  1. Click "Therapeut:in buchen" or "Kostenloses Erstgespräch" from therapist directory → opens ContactModal
  2. Enter name + email/phone → verify 6-digit code (reuses `/api/public/verification/*`)
  3. Compose message (pre-filled, editable) with reason field → send
  4. Match created with `metadata.patient_initiated=true`, therapist receives magic link notification
- **Therapist response** (EARTH-205):
  1. Email notification shows request type (booking/consultation), patient reason, message preview
  2. Click magic link → `/match/[uuid]` page shows full context (72h expiry)
  3. Accept → contact info revealed + mailto button with pre-filled template (includes therapist name in signature)
  4. Decline → patient receives personalized rejection email with directory link
- **Match page** (EARTH-206):
  - For admin-created matches: displays up to 3 therapist recommendations with quality indicators
  - Auto-computed "⭐ Perfekte Übereinstimmung" badge for perfect matches; "Top-Empfehlung" for best
  - Rich cards reuse directory components (TherapistCard, TherapistDetailModal)
  - Pre-authenticated contact via ContactModal (skips verification, prefills patient context)
  - Gentle urgency messaging: "💡 Tipp: Wir empfehlen, sich zeitnah zu melden" (no hard deadline)
- **Session management**: Functional cookie `kh_client` (JWT, 30 days, HTTP-only) persists verified patient sessions; rate-limited to 3 contacts/day.
- **Therapist session**: Functional cookie `kh_therapist` (JWT, 30 days, HTTP-only) enables therapist self-service portal access. Created after magic-link verification at `/portal/auth`.
- **Privacy**: No PII in therapist notification email; contact info revealed only after acceptance; magic links use `secure_uuid`.

### In-Modal Booking Experience (EARTH-256)
- **Why**: Standalone booking pages added latency and drop-off. In-modal booking keeps the user in context and allows for pre-verification.
- **Flow**:
  1. User selects a slot from `TherapistCard` or `ModalityPage`.
  2. `ContactModal` opens in "booking" mode.
  3. Patient verification (Phone/Email) is completed *before* booking.
  4. Once verified, the Cal.com booking modal (if enabled) or native KH booking is triggered.
  5. Cal.com bookings are ingested via webhooks and stored in `public.cal_bookings`.
- **Pre-fetching**: Slots are prefetched on modal open to ensure immediate interactivity.

### Cal.com Integration (EARTH-265)
- **Provisioning Trigger**: When an admin approves a therapist (sets `status='verified'` via `PATCH /api/admin/therapists/:id`), the system automatically calls `provisionCalUser()` to create their Cal.com account.
- **Provisioning**: Managed via `src/lib/cal/provision.ts`. Approved therapists get a Cal.com account cloned from a "golden template" (including schedules and availability).
- **Event Types**: Cloned via Playwright-driven UI automation (SQL inserts for event types are unstable in Cal.com).
- **Slot Fetching**: `src/lib/cal/slots-db.ts` queries the Cal.com database directly for performance and real-time accuracy.
- **Webhooks**: Each provisioned user has an individual webhook pointing to `POST /api/public/cal/webhook` for booking ingestion (created, rescheduled, cancelled).
- **Address Sync**: `src/lib/cal/syncAddress.ts` syncs therapist practice addresses to Cal.com event type locations.

### Booking Notifications (EARTH-220/221)
- On successful booking creation, two transactional emails are sent via `sendEmail()`:
  - Therapist notification: `bookingTherapistNotification` (date/time, format, address for Vor Ort, limited patient context)
  - Client confirmation: `bookingClientConfirmation` (therapist name, date/time, format; Online indicates link will be sent)
- Triggers:
  - `POST /api/public/bookings`
  - `POST /api/public/verification/verify-code` (when processing `draft_booking`)
  - `GET /api/public/leads/confirm` (when processing `draft_booking`)
- Manual testing sink: when browser cookie `kh_test=1` is present and `LEADS_NOTIFY_EMAIL` is set, booking emails are rerouted to that address. E2E tests avoid real sends by leaving `RESEND_API_KEY` unset.
  - With `kh_test=1`, flows run in dry‑run mode: no DB inserts and no `draft_booking` clearing. Analytics `booking_dry_run` is emitted.

## Runtime & Hosting
- Next.js (App Router), Tailwind v4, shadcn/ui (style: new-york, baseColor: slate).
- Node.js runtime for API routes with secrets (e.g., Supabase `service_role`, Google Ads).
- Vercel target. Reason: edge-friendly static hosting with serverless Node for secure endpoints.

## Security & Auth
- Edge Middleware protects `/admin/*`. Login at `POST /api/admin/login` sets an HTTP-only cookie `kh_admin` scoped to `/admin`, 24h expiry. Reason: keep public site cookie-free while securing admin tools (see [security](./security.md)).
- Tokens use HMAC signatures in `src/lib/auth/adminSession.ts` (Web Crypto). Reason: minimal dependency surface, verifiable on server.
- No tracking/marketing cookies anywhere. Functional cookies only in `/admin` per business rule.

## Analytics & Observability
- Server-side analytics via `POST /api/events` writes to `public.events` with merged attribution (session, referrer, UTM). Reason: cookie-free, consistent server logs.
- Unified logger (`src/lib/logger.ts`) accepts optional `ip/ua` and records hashed IP for error/event context. Reason: privacy-preserving diagnostics.

## Google Ads Enhanced Conversions
- Implemented server-side in `src/lib/google-ads.ts`.
  - Patient conversions fire after preferences submission (`POST /api/public/leads/[id]/preferences`).
  - Therapist conversions fire after document uploads (`POST /api/public/therapists/[id]/documents`).
- Hashes normalized emails (incl. Gmail dot removal) and uses `userIdentifierSource: 'FIRST_PARTY'`. Uses ConversionUploadService v21.
- Observability: logs stages (e.g., `get_access_token`, upload), missing config keys, and parses responses (`receivedOperationsCount`, partial failures).
- Why server-side: honors “no cookies” policy while retaining conversion measurement; resilient to client blockers.
## Testing & CI
- Vitest for API and utility tests under `tests/`. Focus on high-ROI paths (lead intake, matching actions, analytics, Google Ads upload).
- GitHub Actions workflow `.github/workflows/ci.yml` runs lint, build, and tests on Node 20 with minimal env.

## See also
- [API](./api.md)
- [Data model](./data-model.md)
- [Technical decisions](./technical-decisions.md)
- [Project structure](./project-structure.md)
- [Security](./security.md)

## Boundaries & Responsibilities

- Components: UI only (render + local state). No business logic.
- Hooks: data fetching + business logic close to usage; extract when repeated.
- API routes: server-only logic and DB writes via service role. Always return `{ data, error }`.
- State placement: as close to usage as possible; context only when prop drilling >3 levels.
- Abstractions: start simple; extract when repeated 3× or file >200 lines.

## Observability & Alerts

- Unified events: server routes call `track` / `logError` to write to `public.events`. No PII in `properties`; IPs hashed.
- Birdseye:
  - Admin Errors UI: `/admin/errors` (filter by `source`, `type`, `level`).
  - Digest email every 15m when errors/cron failures occur: `src/app/api/admin/alerts/system/route.ts` (scheduled in `vercel.json`).
  - Deep dive: Vercel → Functions → Logs.
- Separation of concerns: Vercel Analytics stays high-level (funnels); detailed events/errors live in Supabase.

## Performance Choices

- Static/ISR for key public pages; CDN headers in `vercel.json`.
- Avoid middleware on public routes to keep TTFB low.
- Images via Next.js `Image` with AVIF/WebP and responsive sizes; lazy-load below the fold.
