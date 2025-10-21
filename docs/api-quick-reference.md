# API Quick Reference (Invariants & Key Endpoints)

This is a concise, high-signal overview. It complements the detailed `docs/api.md`.

## Invariants
- Responses always use `{ data, error }`.
- Server-only writes via Supabase `service_role` in API routes (Node runtime).
- No PII in analytics events. IPs hashed with `IP_HASH_SALT`.
- Public site is cookie-free by default; cookies only under `/admin`.
- Server analytics and errors are written to `public.events` (see `src/lib/logger.ts`).

## Auth Patterns
- Admin: `POST /api/admin/login` sets `kh_admin` (HTTP-only, Path=/admin, 24h). Edge middleware protects `/admin/*`.
- Cron (server-to-server):
  - `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`
  - `?token=<CRON_SECRET>` (manual runs)
  - Note: `x-vercel-cron` is not trusted for auth in production (telemetry only)

## Observability
- Admin Errors UI: `/admin/errors` (filter by `source`, `type`, `level`).
- Digest email: every 15m if errors/cron failures exist → `src/app/api/admin/alerts/system/route.ts` (scheduled in `vercel.json`).
- Deep dive: Vercel → Functions → Logs.

## Public (client-facing)
- `POST /api/public/leads`
  - Patients: email-first insert with `status='pre_confirmation'`, confirmation email fire-and-forget.
  - Therapists: `pending_verification`, welcome email, optional multipart (profile+docs) handling.
- `GET /api/public/leads/confirm`
  - Verifies token; sets `email_confirmed`; redirects to `/fragebogen?confirm=...` (passes `fs` when present).
- `POST /api/public/leads/:id/form-completed`
  - Marks Fragebogen completion, copies key fields from `form_sessions`, emits `form_completed`, fires server Enhanced Conversions.
- Form sessions (`EARTH-190`)
  - `POST /api/public/form-sessions` → create
  - `GET /api/public/form-sessions/:id` → read
  - `PATCH /api/public/form-sessions/:id` → merge small updates
- Analytics ingest
  - `POST /api/public/events` → merges session/referrer/UTMs server-side, logs to `public.events`.
- Images proxy (email-safe)
  - `GET /api/images/therapist-profiles/[...path]` → proxies public bucket via our domain.

## Admin (protected)
- Leads & Therapists
  - `GET /api/admin/leads` → list patients (filters: city, session preference, status)
  - `PATCH /api/admin/leads/:id` → update lead status (`new`/`rejected`)
  - `GET /api/admin/therapists` → list therapists (filters)
  - `GET /api/admin/therapists/:id` → details incl. profile preview
  - `PATCH /api/admin/therapists/:id` → verify/reject, approve profile photo/text
  - `POST /api/admin/therapists/:id/reminder` → targeted reminder (profile/documents)
- Matching
  - `POST /api/admin/matches` → create 1–3 proposed matches; emails enqueued; logs business opportunities on mismatch
  - `POST /api/admin/matches/email` → patient-facing emails (match found/custom)
  - Selection reminders (cron): `GET /api/admin/matches/selection-reminders?stage=day5|day14`
  - Therapist action reminders (cron): `GET /api/admin/matches/therapist-action-reminders?stage=20h`
- Stats & Errors
  - `GET /api/admin/stats` → totals + 7-day trends + campaign stats
  - `GET /api/admin/errors` → error/event listing backend for `/admin/errors`
- Session blockers
  - `GET /api/feedback` → records blocker and sends urgent alert when `reason=no_contact`
  - Blocker survey (cron): `GET /api/admin/matches/blocker-survey`

## Therapist flows (public)
- `POST /api/public/therapists/:id/profile` → basic profile + pending photo
- `POST /api/public/therapists/:id/documents` → license/certificates + Enhanced Conversions

## Conversions (Google Ads)
- Server Enhanced Conversions (`src/lib/google-ads.ts`) for `client_registration` and `therapist_registration`.
- Minimal client-side `gtag` conversion only after Fragebogen completion; deduped by lead id.
- Consent Mode v2: default denied; linker enabled post-consent when `NEXT_PUBLIC_COOKIES=true`.

## Response Shape Examples
```json
// Success
{ "data": { "id": "..." }, "error": null }

// Failure
{ "data": null, "error": "Invalid data" }
```

## Code Pointers
- Logger & server analytics: `src/lib/logger.ts`, `src/lib/server-analytics.ts`
- Admin auth: `src/lib/auth/adminSession.ts`, middleware in `middleware.ts`
- Public leads: `src/app/api/public/leads/route.ts`
- Confirm: `src/app/api/public/leads/confirm/route.ts`
- Fragebogen completion: `src/app/api/public/leads/[id]/form-completed/route.ts`
- Events ingest: `src/app/api/public/events/route.ts`
- Alerts digest: `src/app/api/admin/alerts/system/route.ts` and `vercel.json`
