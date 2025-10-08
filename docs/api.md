# API

> Looking for a concise overview? See `docs/api-quick-reference.md` for invariants, auth patterns, observability, and the key endpoints. This file is the deep reference with full behavior and edge cases.

## POST /api/public/leads
- __Purpose__: Create a `people` row for a new lead (patient email-first intake or therapist application).
- __Auth__: None (public funnel). Route uses the Supabase service role; keep upstream rate limiting/bot protection in place.
- __Request Body__ (JSON unless noted):
  - Common: `email` (required), optional `name`, `phone`, `notes`.
  - Lead type selector: `type` (`patient` | `therapist`, defaults to `patient`).
  - Patient flow (email-first, EARTH-146/167/190): accepts minimal metadata only — `session_preference`, `session_preferences`, `form_session_id?`, `confirm_redirect_path?`, plus consent stamps `consent_share_with_therapists` and `privacy_version` (both required). Additional contextual fields (`city`, `issue`, etc.) are collected later via preferences.
  - Therapist flow (JSON path): optional `city`, `session_preferences`, `specializations` (array of modality slugs). For multipart uploads (profile photo, documents) see therapist section below.
- __Validation__: emails validated server-side; all strings sanitized (control chars stripped, ~1 KB max). Missing patient consent or privacy version -> 400.
- __Behavior__:
  - Patients: insert minimal row with `status='pre_confirmation'`, attribution metadata (`campaign_source`, `campaign_variant`), confirmation token + timestamp, and consent footprint. Confirmation email is sent fire-and-forget.
  - Therapists (JSON): insert `people` row in `therapists` table with `status='pending_verification'`, optional metadata, and enqueue welcome email + internal notification.
  - Multipart therapist submissions are handled inside this route (documents & profile photo go to private storage; metadata merged as pending — see POST `/api/public/therapists/:id/documents`).
  - Google Ads Enhanced Conversions are fired at form completion for patient leads (see `POST /api/public/leads/:id/form-completed`) and at document upload for therapists (`POST /api/public/therapists/:id/documents`).
- __Rate limiting__: IP-based best effort (60 s window) using `x-forwarded-for`; both patient and therapist paths share helpers.
- __Notifications__: if `RESEND_API_KEY` & `LEADS_NOTIFY_EMAIL` set, therapist submissions trigger a fire-and-forget internal email (PII-free) via Resend. Sender defaults to `LEADS_FROM_EMAIL` (`kontakt@kaufmann-health.de`).
- __Response__:
  - Patients: `{ data: { id: uuid, requiresConfirmation: true }, error: null }`
  - Therapists: `{ data: { id: uuid }, error: null }`
  - Errors: standard `{ data: null, error: ... }` for 400/429/500.

## GET /api/public/leads/confirm

- __Purpose__: Confirm email addresses for email-only patient leads and mark them as `status='email_confirmed'` (not yet active). The lead becomes active after preferences submission.
- __Auth__: None (accessed via emailed link). Redirects to a friendly page regardless of outcome; does not expose internal states.
- __Query Params__:
  - `id` (uuid, required)
  - `token` (string, required) — one-time token from the confirmation email; valid for 24 hours
  - `fs?` (string, optional) — form session id used for resume; passed through on redirect when applicable
  - `redirect?` (string, optional) — safe path (must start with `/` and not `/api` or `//`) to redirect to on success
- __Behavior__:
  - Loads the `people` row by `id`, verifies `metadata.confirm_token` and TTL using `metadata.confirm_sent_at` (24h).
  - On success: clears `confirm_token` and `confirm_sent_at`, stamps `confirmed_at` and `email_confirmed_at`, sets `status='email_confirmed'` by default. If `metadata.form_completed_at` exists, sets `status='new'` instead. Emits analytics event `email_confirmed` with campaign properties (`campaign_source`, `campaign_variant`) and `elapsed_seconds`.
  - On invalid/expired tokens: no changes are made.
- __Redirects__:
  - 302 → on success: `/fragebogen?confirm=1&id=<leadId>` (or `redirect` path if provided; passes `fs` through when present)
  - 302 → if already confirmed: `/fragebogen?confirm=1&id=<leadId>` (passes `fs` when present)
  - 302 → on invalid/expired/error: `/fragebogen?confirm=invalid | expired | error`

### Public Confirmation Page (`/confirm`)

- Purpose: Routing shim (index‑excluded). Immediately maps `?state=success|invalid|expired|error` to `/fragebogen?confirm=1|invalid|expired|error` and redirects. Success maps to `confirm=1`.
- States (via `?state=`): `success | invalid | expired | error`.
- UX: The Fragebogen step 6 is the single surface that renders either the confirmed variant (when `confirm=1`) or the not‑confirmed variant with inline resend. `/confirm` itself renders no UI.
- SEO: `noindex, nofollow`.

## POST /api/public/leads/resend-confirmation

- __Purpose__: Re-send the email confirmation link for patient leads that are still in `status='pre_confirmation'`.
- __Auth__: None (public). Designed to avoid user enumeration.
- __Request Body__ (JSON):
  - `email` (string, required)
- __Behavior__:
  - Always returns 200 with `{ data: { ok: true }, error: null }` regardless of whether the email exists.
  - When a `people(type='patient')` row exists with `status='pre_confirmation'`, the server generates a new token, updates `metadata.confirm_sent_at`, and re-sends the email (best-effort).
  - Throttled: ignores requests if `confirm_sent_at` is newer than 10 minutes.
  - Logs `email_attempted` and errors via the unified logger.
- __Rate limiting__: IP-based best-effort (reuses standard helpers). Recommended to keep platform protections in front.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`


## POST /api/public/leads/:id/preferences (Deprecated)

- __Purpose__: Deprecated in EARTH-190. Returns HTTP 410. Use Fragebogen completion (`POST /api/public/leads/:id/form-completed`) plus confirmation instead.

## POST /api/public/leads/:id/form-completed

- __Purpose__: Mark Fragebogen completion and trigger conversions.
- __Auth__: None (public flow). Called internally by the Fragebogen at the end of Screen 5.
- __Path Param__:
  - `:id` — the patient lead UUID (from `POST /api/public/leads`).
- __Behavior__:
  - Stamps `people.metadata.form_completed_at`.
  - Copies a subset of Fragebogen fields from `form_sessions` into `people.metadata` for matching (e.g., `city`, `session_preference`, `gender_preference`, `language`, `methods`, etc.).
  - Emits Supabase event `form_completed`.
  - Fires server-side Google Ads Enhanced Conversions for `client_registration` with `orderId=<id>`.
  - Does not change status. Activation happens on confirmation depending on `VERIFICATION_MODE`.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400/404/500 on failure.

## POST /api/public/contact (EARTH-203)

- __Purpose__: Patient-initiated contact flow from therapist directory. Creates a match between patient and therapist, sends notification email with magic link.
- __Auth__: None (public). Uses functional cookie `kh_client` (HTTP-only, 30 days) to track verified sessions and avoid re-verification.
- __Request Body__ (JSON):
  - `therapist_id` (uuid, required) — target therapist
  - `contact_type` ('booking' | 'consultation', required) — type of contact request
  - `patient_name` (string, required)
  - `patient_email` (string, required if `contact_method='email'`)
  - `patient_phone` (string, required if `contact_method='phone'`)
  - `contact_method` ('email' | 'phone', required)
  - `patient_reason` (string, required) — brief description of what they need help with
  - `patient_message` (string, optional) — full message to therapist
- __Behavior__:
  - Checks for existing `kh_client` session cookie. If valid, reuses patient record.
  - If no session: creates or finds patient by contact method, creates session token, sets cookie.
  - Rate limit: max 3 contacts per patient per 24 hours (tracked via `matches` table).
  - Creates `match` record with `status='proposed'` and metadata: `{ patient_initiated: true, contact_type, patient_reason, patient_message, contact_method }`.
  - Sends therapist notification email with magic link to `/match/[secure_uuid]` (privacy-first: no PII in email).
  - Emits analytics: `patient_created` (if new), `contact_match_created`, `contact_email_sent`, `contact_rate_limit_hit` (if blocked).
- __Rate Limiting__:
  - Returns 429 with `{ error: "Du hast bereits 3 Therapeuten kontaktiert...", code: "RATE_LIMIT_EXCEEDED" }` when limit exceeded.
- __Response__:
  - 200: `{ data: { match_id: uuid, therapist_name: string, success: true }, error: null }` + `Set-Cookie: kh_client=...` (for new patients)
  - 400: validation errors
  - 404: therapist not found or not verified
  - 429: rate limit exceeded
  - 500: server error
- __Cookie__: `kh_client` is a functional cookie (not tracking) containing signed JWT with `{ patient_id, contact_method, contact_value, name }`. Valid for 30 days, scoped to `/`, HTTP-only, SameSite=Lax.

## Returning Contact Flow (EARTH-204)

### GET /api/public/matches/:uuid

- __Purpose__: Load patient context and recommended therapists from a pre‑authenticated match link (no re‑verification).
- __Auth__: None (magic link via `matches.secure_uuid`).
- __Link TTL__: 30 days from the reference match creation (returns 410 after).
- __Path Param__:
  - `:uuid` — secure match UUID from email.
- __Behavior__:
  - Resolves `:uuid` to `patient_id` via `matches.secure_uuid`.
  - Returns patient context (name, issue, session_preference) and up to 3 recommended therapists derived from recent matches.
  - Marks therapists already contacted by the patient via `matches.metadata.patient_initiated` (exposes `contacted_at`).
  - Orders therapists using the same mismatch logic as Admin matching (perfect matches first).
  - Emits `match_link_view` via `ServerAnalytics`.
- __Response__:
  - 200: `{ data: { patient: { name?, issue?, session_preference? }, therapists: Array<{ id, first_name, last_name, photo_url?, city?, accepting_new?, contacted_at? }> }, error: null }`
  - 400: `{ data: null, error: 'Missing uuid' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 410: `{ data: null, error: 'Link expired' }`
  - 500: `{ data: null, error: 'Unexpected error' }`

### POST /api/public/matches/:uuid/contact

- __Purpose__: Contact a recommended therapist directly from the pre‑authenticated match page (skip verification).
- __Auth__: None (pre‑authenticated by `:uuid`).
- __Link TTL__: 30 days from the reference match creation (returns 410 after).
- __Rate limiting__: 3 contacts per patient per 24h, counted via `matches` with `metadata.patient_initiated=true` in last 24h.
- __Path Param__:
  - `:uuid` — secure match UUID.
- __Request Body__ (JSON):
  - `therapist_id` (uuid, required)
  - `contact_type` (`'booking' | 'consultation'`, required)
  - `patient_reason` (string, required)
  - `patient_message` (string, optional)
- __Behavior__:
  - Resolves `patient_id` from `:uuid`.
  - Validates therapist (`status='verified'`).
  - Reuses existing match for `(patient_id, therapist_id)` when present; otherwise creates a new one with `status='proposed'` and metadata `{ patient_initiated: true, contact_type, patient_reason, patient_message }`.
  - Sends a privacy‑first therapist notification email with magic link to `/match/:secure_uuid` (PII‑free).
  - Emits `contact_message_sent` on success; `contact_rate_limit_hit` when blocked.
- __Responses__:
  - 200: `{ data: { ok: true, match_id }, error: null }`
  - 400: `{ data: null, error: 'Fehlende Pflichtfelder' | 'Ungültiger Kontakttyp' | 'Invalid JSON' }`
  - 404: `{ data: null, error: 'Therapeut nicht gefunden' }`
  - 410: `{ data: null, error: 'Link expired' }`
  - 429: `{ error: 'Du hast bereits 3 Therapeuten kontaktiert...', code: 'RATE_LIMIT_EXCEEDED' }`
  - 500: `{ data: null, error: 'Unerwarteter Fehler' }`

### GET /api/public/session

- __Purpose__: Reflect whether a verified client session exists (functional cookie `kh_client`).
- __Auth__: None (public).
- __Response__:
  - 200: `{ data: { verified: boolean, name?: string|null, contact_method?: 'email'|'phone', contact_value?: string }, error: null }`

### Public Page `/matches/[uuid]`

- __Purpose__: Show “Ihre persönlichen Empfehlungen” with up to 3 therapist cards and allow contacting any without re‑verification.
- __Notes__:
  - Highlights first card as “Top‑Empfehlung”.
  - Shows “Bereits kontaktiert am …” when applicable; primary button becomes “Erneut senden”.
  - Provides CTA to the full directory when no matches are available.
  - Uses `ContactModal` in pre‑auth mode (skips verification, pre‑fills issue).

## Form Sessions (EARTH-190)

### POST /api/public/form-sessions

- __Purpose__: Create a lightweight server record for autosaving the email-first wizard state and enabling resume across devices.
- __Auth__: None (public). Payload is sanitized and stored as opaque JSON.
- __Request Body__ (JSON):
  - `data` (object, optional) — partial form state; kept small and PII-minimal
  - `email?` (string, optional) — used to associate session to lead later; optional
- __Behavior__:
  - Creates a new form session row and returns its id.
  - Emits `form_session_created` event (optional; for ops visibility only).
- __Response__:
  - 200: `{ data: { id: string }, error: null }`
  - 400/500 on failure.

### GET /api/public/form-sessions/:id

- __Purpose__: Retrieve the latest saved wizard state for the given session id.
- __Response__: `{ data: { id, data, updated_at }, error: null }`

### PATCH /api/public/form-sessions/:id

- __Purpose__: Merge and persist the next partial state; used by the autosave loop (~30s cadence) and on relevant field changes.
- __Request Body__ (JSON): `{ data: object, email?: string }`
- __Behavior__: Shallow merges `data`; small payloads only. Emits low-volume events for debugging in development.
- __Response__: `{ data: { ok: true }, error: null }` or appropriate error.


## POST /api/therapists/:id/documents

- __Purpose__: Step 2 of the two-step flow (EARTH-129). Upload required verification documents after signup (email link). The flow is split to respect serverless body limits and ensure at least one specialization certificate is provided.
- __Auth__: None (access via emailed link). The endpoint validates that the therapist exists and is in `pending_verification`; otherwise returns 404 to avoid information leaks.
- __Content-Type__: `multipart/form-data`
- __Path Param__:
  - `:id` — therapist UUID returned from `/api/public/leads` (therapist JSON or multipart path)
- __Two-step requirement__:
  - Step 2a (license): `psychotherapy_license` is required first (PDF/JPG/PNG, max 4MB).
  - Step 2b (certificates): At least one `specialization_cert` is required next (PDF/JPG/PNG, each max 4MB). Upload one file at a time if needed.
  - API behavior: If a license is already on file, the endpoint accepts certificate-only uploads. If no license exists and only certificates are provided, the endpoint returns 400 (`License must be uploaded first`).
- __Optional fields__:
  - `profile_photo`: JPEG or PNG, max 4MB. Stored pending review.
  - `approach_text`: string, max 500 chars.
- __Storage__:
  - Documents are stored in private bucket `therapist-documents` under `therapists/<id>/...` and merged into `therapists.metadata.documents` as:
    ```json
    {
      "documents": {
        "license": "therapists/<id>/license-<ts>.<ext>",
        "specialization": { "uncategorized": ["therapists/<id>/specialization-<ts>.<ext>"] }
      }
    }
    ```
  - Profile data is stored under `therapists.metadata.profile`:
    ```json
    {
      "profile": {
        "photo_pending_path": "applications/<id>/profile-photo-<ts>.<ext>",
        "approach_text": "<therapeutic approach>"
      }
    }
    ```
  - Buckets per EARTH-116: private `therapist-applications` (pending photos) and public `therapist-profiles` (approved photos via admin flow).
- __Enhanced Conversions__:
  - After successful submission (license and/or certificates persisted), the server uploads a hashed email conversion to Google Ads for `therapist_registration` (value €25). This marks a therapist as a qualified lead for acquisition reporting and optimization.
- __Responses__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing psychotherapy_license' | 'license: <reason>' | 'profile_photo: <reason>' | 'approach_text too long (max 500 chars)' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Failed to upload document' | 'Failed to update' | 'Unexpected error' }`

### Two-Step Flow (EARTH-129)
- Step 1: `/api/therapists/:id/profile` (new, see below)
- Step 2: `/api/therapists/:id/documents` (this endpoint)
- The public page `/therapists/upload-documents/:id` enforces the order:
  - If no license on file → shows license upload.
  - If license exists but no certificate → shows certificates upload (at least one required).
  - If both present → shows completion message and next step.

## POST /api/therapists/:id/profile

- __Purpose__: Step 1 (fast profile completion): capture or update basic profile fields and optional pending photo.
- __Auth__: None (access via emailed link). Validates therapist exists and is in `pending_verification`; otherwise returns 404.
- __Content-Type__: `multipart/form-data` or `application/json`
- __Path Param__:
  - `:id` — therapist UUID
- __Accepted fields__:
  - `gender?`: `male | female | diverse`
  - `city?`: string
  - `accepting_new?`: boolean (JSON) or `'true'|'false'` (form)
  - `approach_text?`: string (max 500)
  - `profile_photo?`: JPEG/PNG (max 4MB). Stored pending approval.
- __Storage__:
  - `profile_photo` is stored in private bucket `therapist-applications` under `applications/<id>/profile-photo-<ts>.(jpg|png)`
  - `approach_text` and `photo_pending_path` are merged into `therapists.metadata.profile`
- __Response__:
  - 200: `{ data: { ok: true, nextStep: '/therapists/upload-documents/<id>' }, error: null }`
  - 400: `{ data: null, error: 'invalid gender' | 'approach_text too long (max 500 chars)' | 'profile_photo: <reason>' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Failed to update' | 'Failed to upload profile photo' | 'Unexpected error' }`

### Therapist uploads (multipart)
- __Content-Type__: `multipart/form-data`
- __Required files (flow-enforced)__:
  - License first: one document proving qualification. Accepted: Psychologischer Psychotherapeut (approbiert), Heilpraktiker für Psychotherapie, Großer Heilpraktiker. Formats: PDF, JPG, PNG. Max 4MB.
  - Then at least one specialization certificate (per selected specialization as available). UI sends `specialization_cert` fields; server stores under `documents.specialization`.
    - Supported slugs: `narm`, `core-energetics`, `hakomi`, `somatic-experiencing`
    - Multiple files allowed per slug (send multiple fields of the same name)
- __Optional profile fields__ (EARTH-116):
  - `profile_photo`: JPEG or PNG, max 4MB. Stored in private `therapist-applications` bucket under `applications/<therapist-id>/profile-photo-<ts>.(jpg|png)` pending admin review.
  - `approach_text`: string, max 500 chars. Stored in `therapists.metadata.profile.approach_text`.
- __Behavior__: Files are stored in the private Supabase Storage bucket `therapist-documents`. The API stores storage paths under `therapists.metadata.documents`:
  ```json
  {
    "license": "therapists/<id>/license-<ts>.pdf",
    "specialization": {
      "narm": ["therapists/<id>/specialization-narm-<ts>.pdf"],
      "hakomi": ["..."]
    }
  }
  ```
  Profile fields are stored under `therapists.metadata.profile`:
  ```json
  {
    "profile": {
      "photo_pending_path": "applications/<id>/profile-photo-<ts>.jpg",
      "approach_text": "<therapeutic approach>"
    }
  }
  ```
  Access is restricted; only server (service role) and admin endpoints can fetch files.

> Examples omitted for brevity. See `docs/api-quick-reference.md` for sample payloads and usage tips, or use the Admin UI to exercise endpoints.

## GET /api/admin/leads
- __Purpose__: List patient leads for manual matching.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin). Returns 401 without it.
- __Query Params__:
  - `city` (optional)
  - `session_preference` (optional: `online` | `in_person`)
  - `status` (optional, default `new`)
  - `limit` (optional, default 50, max 200)
- __Response__:
  - 200: `{ data: Array<Pick<people, 'id'|'name'|'email'|'phone'|'type'|'status'|'metadata'|'created_at'>>, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to fetch leads' }`

## GET /api/admin/therapists
- __Purpose__: List therapist profiles filtered by city/modality/specialization.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Query Params__:
  - `city` (optional)
  - `session_preference` (optional: `online` | `in_person`)
  - `specialization` (optional: slug, e.g. `narm`). Can be repeated; ANY of the provided values will match.
  - `status` (optional: `pending_verification` | `verified` | `rejected`, default `verified`)
  - `limit` (optional, default 50, max 200)
- __Response__:
  - 200: `{ data: Array<{ id, name, email, phone, status, accepting_new?, metadata, created_at }>, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to fetch therapists' }`

__Notes__:
- When `status` is `verified` (or omitted), only therapists with `accepting_new=true` are returned by default. This keeps admin matching focused on currently available therapists.

## POST/GET /api/admin/leads/confirmation-reminders (EARTH-190)

- __Purpose__: Send a single 24‑hour follow‑up email to patient leads still in `status='pre_confirmation'`.
- __Auth__: One of:
  - Admin session cookie (`kh_admin`), or
  - Cron secret header `x-cron-secret` (or `Authorization: Bearer <CRON_SECRET>`), or
  - Vercel platform header `x-vercel-cron` (when invoked by Vercel Cron)
- __Methods__:
  - `POST` with JSON body (manual/scripted runs)
  - `GET` with query params (Vercel Cron)
- __Body__ (JSON) or Query Params (GET):
  - `limit?`: number (default 100, max 1000)
- __Behavior__:
  - Selects `people(type='patient', status='pre_confirmation')` whose `metadata.confirm_sent_at` is ≥ 24h old.
  - De‑duplicates: checks `public.events` for `email_sent` with `stage='patient_confirmation_reminder_24h'` and matching `lead_id` to prevent multiple sends.
  - Re‑issues a fresh `confirm_token`, updates `metadata.confirm_sent_at`, and sends a single reminder email (best‑effort).
  - Includes `&fs=<form_session_id>` in the magic link when available to support session resume.
  - Emits `cron_executed` / `cron_completed` / `cron_failed` and the usual email events for observability.
- __Response__:
  - 200: `{ data: { processed, sent, skipped_too_recent, skipped_no_email, skipped_already }, error: null }`
  - 401/500 on failure.

### Cron Configuration

Added in `vercel.json`:

```
{ "path": "/api/admin/leads/confirmation-reminders?limit=200", "schedule": "0 * * * *" }
```

__Deliverability Note__: We intentionally send only one reminder at 24h to protect sender reputation.

## GET /api/admin/therapists/:id
- __Purpose__: Retrieve single therapist details including profile data for review.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Response__:
  - 200: `{ data: { id, name, email, phone, city, status, profile: { photo_pending_url?: string, approach_text?: string, photo_url?: string } }, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Unexpected error' }`

## PATCH /api/admin/leads/:id

- __Purpose__: Update a patient lead’s status during admin triage.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__ (JSON):
  - `status`: `new` | `rejected`
  - `lost_reason?`: string (optional). When provided with `status='rejected'`, the reason and timestamp are stored in `people.metadata`.
- __Behavior__:
  - Updates `people.status`. On `rejected`, also sets `metadata.lost_reason` and `metadata.lost_reason_at`.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400/401/404/500 on failure.

## PATCH /api/admin/therapists/:id
- __Purpose__: Update therapist verification status, notes, and profile approval.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__:
  - `status?`: `pending_verification` | `verified` | `rejected`
  - `verification_notes?`: string
  - `approve_profile?`: boolean — when true, moves pending photo from `therapist-applications` to public `therapist-profiles` and sets `photo_url`. Also clears `metadata.profile.photo_pending_path`.
  - `approach_text?`: string (max 500) — updates `metadata.profile.approach_text`.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing fields' | 'Invalid status' | 'approach_text too long (max 500 chars)' | 'No pending profile photo to approve' }`
  - 401/404/500 on failure.

## GET /api/admin/therapists/:id/documents/[...type]
- __Purpose__: Securely serve stored documents for admin review.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Path params__:
  - `license` → serves license document
  - `specialization/<slug>/<index>` → serves nth certificate for specialization
- __Response__: Binary file with appropriate `Content-Type` and `Cache-Control: no-store`.

## POST /api/admin/login
- __Purpose__: Authenticate admin and set a session cookie for `/admin`.
- __Auth__: None; protected by IP-based rate limiting.
- __Query Params__:
  - `next` (optional; default `/admin`) — path to redirect to after login.
- __Request Body__ (JSON):
  - `password` (string, required)
- __Behavior__:
  - Validates payload and checks `ADMIN_PASSWORD` on the server.
  - On success, returns `{ data: { ok: true, redirect: string }, error: null }` and sets `kh_admin` cookie (HTTP-only, HMAC-signed, `Path=/admin`, `SameSite=Lax`, `Secure` in production, `maxAge=86400`).
  - On failure, returns appropriate error and never sets a cookie.
- __Rate limiting__: 10 requests per minute per IP. When exceeded, returns 429 with `Retry-After` header in seconds.
- __Response__:
  - 200: `{ data: { ok: true, redirect: string }, error: null }`
  - 400: `{ data: null, error: 'Missing password' }`
  - 401: `{ data: null, error: 'Invalid credentials' }`
  - 429: `{ data: null, error: 'Too many attempts, try again later' }` (includes `Retry-After` header)
  - 500: `{ data: null, error: 'Server misconfiguration' | 'Unexpected error' }`

## POST /api/admin/matches
- __Purpose__: Create one or more proposed matches between a patient and selected therapists.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Request Body__ (JSON):
  - `patient_id` (uuid, required)
  - One of:
    - `therapist_id` (uuid) — single selection
    - `therapist_ids` (uuid[]) — multiple selection (max 3)
  - `notes` (string, optional)
- __Validation__:
  - Verifies `patient_id` references `people(type='patient')`.
  - Verifies all `therapist_id(s)` reference existing therapists.
  - Enforces selection size: max 3.
- __Behavior__:
  - Inserts one `matches` row per therapist with `status='proposed'`.
  - Enqueues therapist outreach emails (best-effort) with magic link, identical to single-create behavior.
  - Side-effect: logs business opportunity records when a selection contains preference mismatches (see `business_opportunities` in Data Model).
- __Response__:
  - 200: when 1 match created → `{ data: { id: uuid }, error: null }`
  - 200: when 2–3 matches created → `{ data: { ids: uuid[] }, error: null }`
  - 400: `{ data: null, error: 'patient_id is required' | 'therapist_id or therapist_ids is required' | 'Invalid patient_id' | 'Invalid therapist_id: <id>' | 'Maximum of 3 therapists allowed' | 'Invalid JSON' }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to verify therapists' | 'No matches created' }`

### POST /api/admin/matches/email

- __Purpose__: Send a patient-facing email related to a specific match (either a templated “match found” message or a custom update). Intended as part of the admin outreach workflow.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Request Body__ (JSON):
  - `id` (uuid, required) — the `matches.id` to reference
  - `template?` (`'match_found' | 'custom'`, default `'custom'`)
  - `message?` (string) — only used when `template='custom'`; max 4000 chars
- __Behavior__:
  - Loads the match by id and the related patient; verifies patient email exists.
  - For `template='match_found'`, also loads therapist name and sends a templated confirmation.
  - Uses the server email client; failures are logged and a 500 is returned.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'id is required' | 'Invalid JSON' | 'Patient email missing' }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 404: `{ data: null, error: 'Match not found' }`
  - 500: `{ data: null, error: 'Failed to load entities' | 'Unexpected error' }`

## POST /api/admin/therapists/:id/reminder

- __Purpose__: Send a profile completion reminder email to a specific therapist, based on missing items derived from `therapists.metadata`.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__ (JSON):
  - `stage?`: Optional label for the email subject (e.g. "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung").
- __Behavior__:
  - Computes missing items: `documents` (license), `photo` (pending path), `approach` (text), and basic profile fields (`gender`, `city`, `accepting_new`).
  - Chooses CTA link dynamically (EARTH-129 two-step flow):
    - If only `documents` are missing → link to `/therapists/upload-documents/:id` and subject "Zulassungs‑Nachweis ausstehend".
    - If `photo` or `approach` or basic fields missing → link to `/therapists/complete-profile/:id` and subject "Profil vervollständigen" (or "Profilbild fehlt noch" when only photo is missing).
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing email' | 'Not applicable' }`
  - 401/404/500 on failure.

__Why__: Server-side reminders keep logic and security in the backend (no public cookies), and let us batch-trigger via Cron without exposing internal states to the client.

## POST/GET /api/admin/therapists/reminders

- __Purpose__: Batch-send profile completion reminders to therapists in `pending_verification`.
- __Auth__: One of:
  - Admin session cookie (`kh_admin`), or
  - Cron secret header `x-cron-secret` matching `CRON_SECRET`, or
  - Vercel platform header `x-vercel-cron` (only present when invoked by Vercel Cron)
- __Methods__:
  - `POST` with JSON body (recommended for manual/scripted runs)
  - `GET` with query params (used by Vercel Cron per `vercel.json`)
- __Body__ (JSON) or Query Params (GET):
  - `limit?`: number (default 100, max 1000)
  - `stage?`: Optional label (e.g. "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung")
- __Behavior__:
  - Fetches up to `limit` therapists with `status='pending_verification'`.
  - For each, computes missing items from metadata and sends a reminder if anything is missing.
  - Selects the CTA link and subject per therapist as in the single reminder endpoint (EARTH-129).
  - Returns simple stats and examples for observability.
- __Response__:
  - 200: `{ data: { processed, sent, skipped_no_missing, examples: Array<{ id, missing: string[] }> }, error: null }`
  - 401/500 on failure.

__Monitoring__:
- Emits events to `public.events` via unified logger:
  - `cron_executed` at start (props include `stage`, `limit`, `triggered_by: manual|secret|vercel_cron`, `method`)
  - `cron_completed` on success (props include `processed`, `sent`, `skipped_no_missing`, `duration_ms`, `stage`, `method`)
  - `cron_failed` on error (props include `duration_ms`, `method`)

__Why__: Enables Vercel Cron scheduling for reminder cadence (24h/72h/7d) with a single secured server endpoint; no duplication in clients. Monitoring ensures failures are visible in ops analytics.

## Email side-effects (EARTH-73)

Some endpoints send non-blocking emails (best-effort):
- `/api/public/leads` (therapist path): Welcome email prompts profile completion.
- `/api/public/therapists/:id/documents` (POST): Upload confirmation after successful submission.
- `/api/admin/therapists/:id` (PATCH): Sends approval/rejection emails when status changes.

__Why__: Keeping email rendering/sending on the server preserves the cookie-free public site and centralizes logging/observability.

__UI Consistency__: Email templates reuse a small, inline-styled therapist preview snippet to ensure consistent presentation with the public directory cards while remaining email-client safe.

## GET /api/images/therapist-profiles/[...path]

- __Purpose__: Serve therapist profile images via our own domain to improve email deliverability and avoid external-image warnings (EARTH-138).
- __Auth__: None. Images are public profile photos that are already stored in a public Supabase bucket.
- __Path Params__: `[...]` — the storage path inside the `therapist-profiles` bucket (e.g. `abc123.jpg`).
- __Behavior__:
  - Proxies the request to `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/therapist-profiles/[...path]`.
  - Sets `Content-Type` from upstream and strong cache headers: `Cache-Control: public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800`.
  - Intended for use in email HTML so all images load from `BASE_URL`.
- __Response__: Binary image content.


## EARTH-125: Patient Selection Flow

### POST/GET /api/match/:uuid/select

- Purpose: Record a patient’s active selection of a specific therapist from a set of proposals.
- Auth: None (access via magic link UUID sent by email).
- Query Params or Body:
  - `therapist` (uuid) in query string, or `therapist_id` in JSON body.
- Behavior:
  - Resolves `:uuid` to the patient via `matches.secure_uuid`.
  - Updates the specific match row for `(patient_id, therapist_id)` to `status='patient_selected'`.
  - Sends fire-and-forget emails:
    - To therapist: privacy-first selection notification with a magic link to `/match/:uuid` (no PII in email). The acceptance page shows preview data only; contact details are revealed after acceptance.
    - To patient: confirmation that the selected therapist will reach out (German copy).
  - Emits event `patient_selected` via `ServerAnalytics`.
- Responses:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing uuid' | 'therapist is required' | 'Invalid JSON' }`
  - 404: `{ data: null, error: 'Not found' | 'Match not available' }`
  - 500: `{ data: null, error: 'Failed to update' }`

### POST /api/admin/matches/email (extended)

- New template `selection` for patient-facing "active selection" email with urgency and up to 3 proposals.
- Request Body (JSON):
  - `template: 'selection'`
  - `patient_id` (uuid, required when `template='selection'`)
  - `therapist_ids?` (uuid[], optional; falls back to latest `status='proposed'` for the patient; max 3)
- Behavior:
  - Builds an email with one "Best match" + up to two alternatives
  - Buttons link to `/api/match/:uuid/select?therapist=<id>` (uses existing `matches.secure_uuid`).
  - Sorts proposals using existing mismatch logic (perfect matches first).
- Responses:
  - 200: `{ data: { ok: true }, error: null }`
  - 400/401/404/500 on failure with descriptive messages.

### GET /api/admin/matches/selection-reminders

- Purpose: Vercel Cron-driven follow-up sequence if no selection was made yet.
- Auth: Admin cookie or Cron secret (`x-cron-secret` / `Authorization: Bearer`), or Vercel platform header `x-vercel-cron`, or `?token=<CRON_SECRET>`.
- Query Params:
  - `stage`: `24h` | `48h` | `72h`
- Behavior:
  - Aggregates recent `status='proposed'` matches by patient.
  - Skips patients who already have any `status='patient_selected'` match.
  - For `24h` and `48h`, sends the selection email again (48h version uses a stronger urgency banner).
  - For `72h`, marks analytics event `patient_unresponsive` (no status change) and skips emailing.
  - De-duplicates per stage: before sending, checks `public.events` for an `email_sent` with `kind='patient_selection_reminder'` and matching `stage` and `patient_id` within the stage window. Prevents accidental double-sends on manual/cron re-runs.
- Responses:
  - 200: `{ data: { processed, sent, marked, skipped_already_selected, skipped_missing_email, skipped_no_secure_uuid, skipped_duplicate_stage }, error: null }`
  - 401/500 on failure.

### Cron Configuration

See `vercel.json` for these cron schedules.

Notes:
- Email HTML uses inline styles and the existing `renderTherapistPreviewEmail()` to ensure client compatibility.
- All email sending is best-effort and logged via the unified logger (`email_sent`, `email_retry`, `email_timeout_retry`).

## Therapist Action Reminders (Privacy‑First)

### GET /api/admin/matches/therapist-action-reminders

- Purpose: Send a 20-hour reminder to therapists who were selected by a patient but haven’t responded yet.
- Auth: Admin cookie or Cron secret (`x-cron-secret` / `Authorization: Bearer`), or Vercel platform header `x-vercel-cron`.
- Query Params:
  - `stage`: currently `20h` (window is between 20 and 21 hours after the initial selection event).
- Behavior:
  - Scans `public.events` for `patient_selected` in the [T-21h, T-20h) window and extracts `match_id`.
  - Skips matches not in `status='patient_selected'` or already having `therapist_contacted_at`.
  - Sends an email to the therapist with a magic link to `/match/:uuid` (no PII in email). The acceptance page shows preview only; contact details are revealed after acceptance.
  - Emits `cron_executed` / `cron_completed` / `cron_failed` for observability.
- Responses:
  - 200: `{ data: { processed, sent }, error: null }`
  - 401/500 on failure.


## EARTH-127: Session Blocker Tracking – Warum werden keine Termine gebucht?

### GET /api/feedback

- Purpose: One‑click client feedback links embedded in the 7‑Tage Follow‑up E‑Mail. Records why a Termin nicht zustande kam.
- Auth: None (links from email). Redirects to a friendly thank‑you page regardless of payload to avoid exposing internals.
- Query Params:
  - `match` (uuid, required): `matches.id`
  - `reason` (required): one of `scheduling | cost | changed_mind | no_contact | other`
- Behavior:
  - Inserts a row into `public.session_blockers` with `{ match_id, reason }`.
  - Emits `session_blocker_received` event via unified logger.
  - When `reason='no_contact'`, sends a high‑priority internal alert email to `LEADS_NOTIFY_EMAIL`.
  - Redirects to `/feedback-received`.
- Responses:
  - 302: Redirect to `/feedback-received` (on success and also on invalid/missing params)

### GET /api/admin/matches/blocker-survey

- Purpose: Daily cron that sends a short "Kurze Frage" email 7 Tage nach Auswahl, wenn noch keine Sitzung bestätigt ist.
- Auth: Admin cookie or Cron secret (`x-cron-secret` / `Authorization: Bearer`), or Vercel platform header `x-vercel-cron`.
- Behavior:
  - Scans `public.events` for `patient_selected` events in the [T‑8d, T‑7d) window.
  - For each `match_id`, loads the match and skips unless `status='patient_selected'` and `patient_confirmed_at` is null.
  - De‑duplicates per match by checking recent `email_sent` with `kind='patient_blocker_survey'`.
  - Sends the survey email with 1‑Klick Optionen (Terminfindung, Kosten, anders entschieden, Therapeut:in hat sich nicht gemeldet, anderer Grund).
  - Emits `cron_executed` / `cron_completed` / `cron_failed` for observability.
- Responses:
  - 200: `{ data: { processed, sent, skipped_status, skipped_missing_email, skipped_duplicate }, error: null }`
  - 401/500 on failure.

### Cron Configuration

See `vercel.json` for this cron schedule.

### Admin Stats

Response shape (high-level): totals, trends, blockers breakdown. Exact fields may evolve—see endpoint code.

Pre-/Post‑Signup metrics (existing signals only):

- preSignup
  - wizardFunnel
    - page_views: unique sessions with page_view events in window
    - step1..step5: unique sessions that viewed each Fragebogen step (screen_viewed with step)
    - form_completed: count of patients with people.metadata.form_completed_at in window
    - start_rate: page_views → step1 conversion (percent, one decimal)
  - faqClicks: Array<{ title, count }> top opened FAQ items
- postSignup
  - last7
    - clients_new: patients that became active (status=new) within window (based on metadata.email_confirmed_at)
    - therapists_new: therapists created within window (excludes tests)
  - clientFunnel
    - pre_confirmation: new patient leads created within window (status=pre_confirmation)
    - new: confirmed/activated patients within window (status=new)
    - selected: unique patients from patient_selected events within window
    - session_booked: matches with status in (session_booked, completed) in window (prefers patient_confirmed_at, falls back to created_at)

### Campaign Reporting (EARTH-153)

The endpoint also returns campaign performance based on first‑party attribution stored on `public.people` (client leads only). The window is controlled by `?days=N` (default `7`, max `30`).

```
campaignStats: Array<{
  campaign_source: string;      // e.g. '/wieder-lebendig' | '/ankommen-in-dir' | '/therapie-finden'
  campaign_variant: string;     // 'A' | 'B'
  leads: number;                // total patient leads with this source/variant in window
  confirmed: number;            // leads with status != 'pre_confirmation' (email confirmed)
  confirmation_rate: number;    // confirmed/leads * 100, rounded to 1 decimal
}>

campaignByDay: Array<{
  day: string;                  // 'YYYY-MM-DD' (UTC buckets)
  campaign_source: string;
  campaign_variant: string;     // 'A' | 'B'
  leads: number;
  confirmed: number;
  confirmation_rate: number;
}>
```

Notes:
- The mid‑funnel signal for “confirmed” aligns with email double opt-in (EARTH‑146): a lead is counted as confirmed when `people.status != 'pre_confirmation'`.
- Self‑pay intent is tracked separately via events (`self_pay_confirmed` / `self_pay_declined`) and is surfaced in the existing “Lead‑Qualität” card; it is not mixed into the campaign aggregates above.
