# Technical Decisions (Non-obvious)

- __Next.js 15 + App Router__: modern file-based routing, server components; dev with Turbopack.
- __Tailwind v4 + shadcn/ui__: fast UI iteration with accessible primitives. Theme: "new-york", base color: slate. Installed deps: `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`.
- __Path aliases__: `@/*` to `src/*` for clean imports (`tsconfig.json`).
- __Supabase client choices__:
  - Browser client placeholder in `src/lib/supabase.ts` (not used for writes).
  - Server client in `src/lib/supabase-server.ts` with service role for secure writes from API routes.
- __Indexes__: Deferred per expected low volume (~10 leads). Revisit with real usage. For rate-limit lookups on `metadata`, consider: `CREATE INDEX people_metadata_gin_idx ON public.people USING GIN (metadata);`.
- __Lead intake security__: Basic IP-based rate limiting (60s) in `POST /api/leads` using `x-forwarded-for`; stores `ip` and `user_agent` in `metadata` to aid debugging/abuse triage. Tradeoff: best-effort; can be bypassed (NAT/VPN). Future: Upstash rate limit and/or hCaptcha if abuse observed.
- __Notifications (optional)__: Fire-and-forget email via Resend when `RESEND_API_KEY` and `LEADS_NOTIFY_EMAIL` are set to avoid adding latency to the request path. Safe to disable in non-prod.
  - Verified sending domain: `kaufmann-health.de` (Resend Dashboard)
  - From address: `LEADS_FROM_EMAIL` (default: `no-reply@kaufmann-health.de`)
  - DNS: follow Resend’s exact DNS instructions for SPF/DKIM (and optional custom Return-Path). If also sending via Google Workspace, keep a single SPF record that includes both Google and Resend includes.
- __CORS__: Not added; funnel submits same-origin. If cross-origin is needed, add `OPTIONS` handler and CORS headers on `/api/leads`.
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
  - Mapping: Conversion action aliases (e.g., `patient_registration`) map to resource names via env `GOOGLE_ADS_CA_*` (see `.env.example`). This lets us add/rename actions without code changes.
  - Trigger points: `POST /api/leads` fires `patient_registration` (10 EUR) and `therapist_registration` (25 EUR) after successful insert. Future events (match, payment, etc.) can call the tracker with their alias.
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
