# Technical Decisions (Non-obvious)

- __Next.js 15 + App Router__: modern file-based routing, server components; dev with Turbopack.
- __Tailwind v4 + shadcn/ui__: fast UI iteration with accessible primitives. Theme: "new-york", base color: slate. Installed deps: `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`.
- __Path aliases__: `@/*` to `src/*` for clean imports (`tsconfig.json`).
- __Supabase client choices__:
  - Browser client placeholder in `src/lib/supabase.ts` (not used for writes).
  - Server client in `src/lib/supabase-server.ts` with service role for secure writes from API routes.
- __Indexes__: Deferred per expected low volume (~10 leads). Revisit with real usage. For rate-limit lookups on `metadata`, consider: `CREATE INDEX people_metadata_gin_idx ON public.people USING GIN (metadata);`.
- __Lead intake security__: Basic IP-based rate limiting (60s) in `POST /api/public/leads` using `x-forwarded-for`; stores `ip` and `user_agent` in `metadata` to aid debugging/abuse triage. Tradeoff: best-effort; can be bypassed (NAT/VPN). Future: Upstash rate limit and/or hCaptcha if abuse observed.
- __Notifications (optional)__: Fire-and-forget email via Resend when `RESEND_API_KEY` and `LEADS_NOTIFY_EMAIL` are set to avoid adding latency to the request path. Safe to disable in non-prod.
  - Verified sending domain: `kaufmann-health.de` (Resend Dashboard)
  - From address: `LEADS_FROM_EMAIL` (default: `no-reply@kaufmann-health.de`)
  - DNS: follow Resend’s exact DNS instructions for SPF/DKIM (and optional custom Return-Path). If also sending via Google Workspace, keep a single SPF record that includes both Google and Resend includes.
- __CORS__: Not added; funnel submits same-origin. If cross-origin is needed, add `OPTIONS` handler and CORS headers on `/api/public/leads`.
- __Service role writes__: Writes handled only on the server via `supabaseServer` (service role). Never expose service role keys to the browser.

## Images & Performance
- __Why__: 70% mobile traffic; large PNGs were inflating LCP and bounce. We favor perceived performance and low transfer over raw pixels.
- __How__: Use Next.js `Image` with AVIF/WebP and responsive `sizes`; below-the-fold images use `loading="lazy"` and a tiny base64 `blurDataURL` to avoid jank while saving bytes. No manual WebP pipeline needed—Vercel handles modern formats + edge caching.

## Privacy & Cookies
- __Cookie policy__: No tracking/marketing cookies on the public site. Reason: privacy-first UX and legal clarity. Functional cookies allowed only under `/admin`.
- __Admin protection__: Edge Middleware guards `/admin/*`. Login sets HTTP-only `kh_admin` cookie scoped to `/admin` with 24h expiry (HMAC via Web Crypto). Reason: confines cookies to the restricted area while keeping public site cookie-free. See also: [security](./security.md), [architecture](./architecture.md).

- __Google Ads Enhanced Conversions__:
  - Why: Accurate attribution without cookies; complies with our cookie policy (no tracking cookies on public site).
  - How: Server-side only (`src/lib/google-ads.ts`) uploads hashed email (SHA-256) + conversion attributes. API routes run on Node runtime.
  - Safety: No-op unless env is configured; errors go through unified logger. Secrets live in server env only.
  - Mapping: Conversion action aliases (e.g., `client_registration`) map to resource names via env `GOOGLE_ADS_CA_*` (see `.env.example`). This lets us add/rename actions without code changes.
  - Trigger points:
    - `therapist_registration` (25 EUR): fired by `POST /api/public/therapists/:id/documents` after successful document submission (qualified lead moment).
    - `client_registration` (10 EUR): fired by `POST /api/public/leads/:id/preferences` when status becomes `new` (post-confirmation activation). Patient intake is always email-first; the legacy immediate-activation path was removed.
    - Future events (match, payment, etc.) can call the tracker via their alias.
  - Observability: staged logs for OAuth (`get_access_token`) and upload, logs missing config keys, parses `receivedOperationsCount` and partial failures for actionable diagnostics. See also: [architecture](./architecture.md).

## Verification Workflow
- __Why__: Maintain therapist quality and legal compliance before introductions.
- __How__: Therapist leads default to `pending_verification` (in `public.people.status`); admins review docs stored in private bucket `therapist-documents` and update to `verified` or `rejected`. Audit timestamps on `public.matches` (`therapist_contacted_at`, `therapist_responded_at`, `patient_confirmed_at`) support traceability.
- __Security__: Storage is private; authenticated insert allowed, reads/manage restricted to `service_role`. See also: [data model](./data-model.md), [security](./security.md).
 - __Transport__: Therapist uploads use `multipart/form-data` to support multiple certification files per specialization. Server validates type/size and writes only storage paths (no public URLs) into `therapists.metadata.documents`. License proof can be Approbation, Heilpraktiker für Psychotherapie, or Großer Heilpraktiker.

## Admin Stats & Error Monitoring
- __Why__: Provide operational visibility (therapists/clients/matches totals + short-term trend) and faster error triage without DB access.
- __Security__: Admin-only via `kh_admin` cookie scoped to `/admin` using HMAC-signed tokens (`src/lib/auth/adminSession.ts`). API responses consistently `{ data, error }`. No PII in metrics.
- __Performance__: Stats time-series default 7 days, capped at 30; grouped by UTC day. Avoids heavy queries and large payloads.
- __Data sources__: `people` and `matches` for stats; unified `events` table for error logs.
- __Error filters__: Multi-level filtering using `levels` query param (comma-separated: `error,warn,info`). Defaults to `error` to ensure useful results and prevent empty state.
  - __UI__: Minimal dashboard on `/admin` with 3 cards + 7-day bar chart; `/admin/errors` shows level badges and quick filters.
  - __Build note__: Rarely, a stale artifact causes build errors (e.g., "Cannot find module for page: /_not-found"). Workaround: clean `.next` and rebuild.


## System Alerts Digest (ADR-001)

- **Why**: We needed a birdseye alert for operational issues (500s, cron failures) without adding third-party tooling, and without mixing concerns with business analytics or client funnels.
- **Consequences**:
  - Low-noise: one email per window with top sources/types + 5 latest events.
  - De-dupe: mark `internal_alert_sent { kind: 'system_errors_digest', digest_key }` to avoid repeats.
  - Separation of concerns: business events stay as-is; operational signals use error level and `cron_*` types.
  - Zero new infra: relies on existing Supabase + email client.
  - **Links**:
  - Alerts route: `src/app/api/admin/alerts/system/route.ts`
  - Schedule: `vercel.json` (`*/15 * * * *`)
  - Admin errors UI: `src/app/admin/errors/page.tsx`

## Email-First Intake & Status Progression (ADR-002)

- **Why**: Reduce friction and improve deliverability by collecting only email first; defer rich data to Fragebogen; maintain clear state transitions.
- **Decision**:
  - `POST /api/public/leads` creates patients with `status='pre_confirmation'` and sends confirmation.
  - `GET /api/public/leads/confirm` stamps `email_confirmed_at`; if `form_completed_at` exists, status → `new`.
  - `POST /api/public/leads/:id/form-completed` stamps `form_completed_at`, merges key fields from `form_sessions`, emits `form_completed`, fires server EC.
  - If `form_session_id` is missing, server falls back to the most recent non-expired form_session by email and persists it (EARTH-190 hardening).
- **Consequences**:
  - Email-first preserves privacy and improves funnel completion.
  - Clear activation rule avoids inconsistent states; analytics remain server-side.
- **Known gaps (Sept 2025)**: post-confirmation resume by `fs` not wired; spinner for slow connections; double-click prevention not across all steps; offline banner/resync cues; some mobile polish.
- **Links**: `src/app/api/public/leads/route.ts`, `src/app/api/public/leads/confirm/route.ts`, `src/app/api/public/leads/[id]/form-completed/route.ts`.

## Analytics Separation (ADR-003)

- **Why**: Prevent duplication and privacy leakage; keep funnels high-level and detailed events server-side.
- **Decision**:
  - Supabase `public.events` stores business events and errors (unified logger accepts optional ip/ua; IP is hashed with `IP_HASH_SALT`).
  - Vercel Analytics is reserved for high-level conversions only; no debug/ops data.
  - Server merges session/referrer/UTM (no cookies) via `ServerAnalytics.trackEventFromRequest()`.
- **Consequences**: One source of truth for events; easier ops queries; privacy-first.
- **Links**: `src/lib/logger.ts`, `src/lib/server-analytics.ts`, `docs/analytics.md`.

## Consent Mode v2 & Minimal Ads Client Signal (ADR-004)

- **Why**: Optimize ads while honoring a cookie-free default and user consent.
- **Decision**:
  - Server Enhanced Conversions are the canonical signal (hashed email). A single client `gtag` conversion fires after Fragebogen completion for optimization.
  - Dedupe by lead id (`orderId` server == client `transaction_id`).
  - Consent Mode v2: default denied; enable linker only after explicit consent when `NEXT_PUBLIC_COOKIES=true`.
- **Consequences**: Accurate measurement without tracking cookies; minimal client surface.
- **Links**: `src/lib/google-ads.ts`, `docs/analytics.md`.

## Therapist Onboarding Two-Step & Storage Buckets (ADR-005)

- **Why**: Reduce drop-off and respect serverless limits; keep compliance docs private until approval.
- **Decision**:
  - Step 1 profile endpoint; Step 2 documents endpoint with required license first, then specialization certificates.
  - Storage: `therapist-applications` (private, pending photos), `therapist-documents` (private, compliance), `therapist-profiles` (public, approved photos).
  - Admin approval moves photos to public; reminders exist for missing items.
- **Consequences**: Clear review workflow; safe email flows; consistent public profile handling.
- **Links**: `src/app/api/public/therapists/[id]/profile/route.ts`, `src/app/api/public/therapists/[id]/documents/route.ts`, `docs/security.md`.

## Magic Links & secure_uuid (ADR-006)
- **Why**: Privacy-first links without exposing PII; predictable acceptance flow.
- **Decision**:
  - `matches.secure_uuid` uniquely identifies magic links (one-time semantics enforced in code/UI).
  - Acceptance page shows preview data only; contact details revealed after acceptance.
  - Patient selection uses `POST/GET /api/match/:uuid/select` and logs `patient_selected`.
  - **Consequences**: Better deliverability and security; auditable timestamps (`therapist_contacted_at`, `therapist_responded_at`, `patient_confirmed_at`).
  - **Links**: `src/app/api/match/[uuid]/select/route.ts`, `docs/api.md#earth-125-patient-selection-flow`.

## Session Blockers & Urgent Alert (ADR-007)

- **Why**: Understand why sessions don’t happen and take action when therapists don’t reach out.
- **Decision**:
  - Data: `public.session_blockers` captures `{ match_id, reason }` with enums `scheduling|cost|changed_mind|no_contact|other`.
  - Ingest: `GET /api/feedback` stores a blocker entry and emits `session_blocker_received`.
  - Urgent alert: when `reason='no_contact'`, send an internal email to `LEADS_NOTIFY_EMAIL` (fire-and-forget).
  - Survey cron: `GET /api/admin/matches/blocker-survey` scans `patient_selected` ~7 days after selection, de-dupes by checking `email_sent(kind='patient_blocker_survey')`.
- **Consequences**: Actionable insights, privacy-first links, and timely alerts to reduce drop-off.
- **Links**: `src/app/api/public/feedback/route.ts`, `src/app/api/admin/matches/blocker-survey/route.ts`, `docs/data-model.md#publicsession_blockers`.

## New Patient Lead Digest (ADR-009)

- **Why**: Keep admins aware of fresh demand without checking dashboards; avoid PII in email.
- **Decision**:
  - Route: `GET /api/admin/alerts/new-leads?hours=3` filters `people(type='patient', status='new')` updated in the lookback window, excludes test leads, and emails a PII‑free summary to `LEADS_NOTIFY_EMAIL`.
  - Schedule: Vercel Cron at 13:00, 16:00, and 19:00 UTC.
  - De‑dupe: logs `internal_alert_sent { kind: 'new_leads_digest', digest_key }` to avoid repeats.
  - Auth: same as system alerts (Vercel cron header, `CRON_SECRET` header/bearer, or `?token=`).
- **Consequences**: Low‑noise operational awareness that supports manual matching triage.
- **Links**: `src/app/api/admin/alerts/new-leads/route.ts`, `vercel.json`.

## Universal Conversion Tracking (ADR-010)

- **Why**: Fire conversions consistently when contact is verified (email OR SMS) across all patient signup flows, not just at form completion.
- **Decision** (EARTH-204):
  - Single helper `maybeFirePatientConversion()` in `src/lib/conversion.ts` fires Enhanced Conversions once per patient.
  - Idempotent via `metadata.google_ads_conversion_fired_at`; test leads (`is_test: true`) excluded.
  - Fires at: (1) email verification (`GET /api/public/leads/confirm`), (2) SMS verification (`POST /api/public/verification/verify-code`), (3) direct therapist contact (`POST /api/public/matches/[uuid]/contact`).
  - Legacy `POST /api/public/leads/[id]/form-completed` uses same helper for deduplication.
  - Gracefully skips phone-only patients (Enhanced Conversions require email for hashing).
- **Consequences**: Accurate conversion attribution at verification point (earlier than form completion); consistent across email/SMS flows; strict deduplication prevents double-fire.
- **Links**: `src/lib/conversion.ts`, `tests/conversion.test.ts`, `tests/api.conversion.integration.test.ts`.

## Patient-Initiated Contact & Verification (ADR-011)

- **Why**: Enable direct patient→therapist contact from directory; keep modal UX consistent between SMS and email verification.
- **Decision** (EARTH-203):
  - Patient clicks "Therapeut:in buchen" or "Kostenloses Erstgespräch" → opens modal for name + email/phone.
  - Both SMS and email use **verification codes** (6-digit, via existing `/api/public/verification/*` endpoints). Rationale: modal continuity, mobile auto-fill, simpler than context-aware magic links.
  - Session cookie `kh_client` (HTTP-only, 30 days, functional) stores JWT for verified patients to skip re-verification.
  - `POST /api/public/contact` creates match with `metadata.patient_initiated=true`, rate-limited to 3 contacts/day.
  - Therapist receives notification email with magic link to `/match/[uuid]` (EARTH-205).
- **Consequences**: Fast contact flow; no navigation away from modal; reuses existing verification infrastructure; privacy-first (no PII in therapist email until acceptance).
- **Links**: `src/features/therapists/components/ContactModal.tsx`, `src/app/api/public/contact/route.ts`, `src/lib/auth/clientSession.ts`.
