# Architecture Overview

- __App Router__: Pages in `src/app/` (UI only: rendering, local state, event handlers). Business logic does not live in components.
- __Components__: Reusable UI in `src/components/` and shadcn-generated primitives in `src/components/ui/`.
- __API routes__: Server-only logic in `src/app/api/*` with `export const runtime = 'nodejs'` where secrets (service role) are required. Public site stays cookie-free; only server routes touch the database or secrets.
- __Lib__: Shared utilities in `src/lib/` including Supabase clients.

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
