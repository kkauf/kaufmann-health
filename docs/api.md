## POST /api/public/bookings

- __Purpose__: Create a booking for a specific therapist slot occurrence (requires verified client session).
- __Auth__: Functional cookie `kh_client` (verified session). Returns 401 otherwise.
- __Request Body__ (JSON): `{ therapist_id: uuid, date_iso: 'YYYY-MM-DD', time_label: 'HH:MM', format: 'online'|'in_person' }`
- __Validation__:
  - Therapist must exist and be `status='verified'`.
  - Occurrence must correspond to an active recurring slot (matching Berlin weekday and time/format).
  - Prevents double‑booking via unique `(therapist_id, date_iso, time_label)`.
- __Responses__:
  - 200: `{ data: { booking_id }, error: null }`
  - 400: `{ error: 'Invalid date' | 'Invalid time' | 'Invalid format' | 'Slot not available' }`
  - 401: `{ error: 'NOT_VERIFIED' }`
  - 404: `{ error: 'Therapist not found' }`
  - 409: `{ error: 'SLOT_TAKEN' }`
  - 500: `{ error: 'Failed to book' }`

## GET /api/public/therapists

- __Purpose__: List publicly visible therapists and computed availability.
- **Availability**: Generated from recurring slots for the next ~3 weeks (Berlin TZ), capped at 9 and excluding already booked occurrences (via `bookings`).
- **Response**: each therapist includes `availability: Array<{ date_iso, time_label, format, address? }>`.
# API
## POST /api/public/verification/send-code

- __Purpose__: Send an email or SMS verification code and persist a server-side draft of a directory contact (optional).
- __Auth__: None (public). Rate-limited.
- __Request Body__ (JSON):
  - `contact` (string, required) — email or phone
  - `contact_type` (`'email' | 'phone'`, required)
  - `name?` (string) — optional patient name used on session creation
  - `redirect?` (string) — safe path for email magic link return
  - `draft_contact?` (object) — optional draft from ContactModal
    - `{ therapist_id, contact_type: 'booking'|'consultation', patient_reason, patient_message, session_format? }`
  - `draft_booking?` (object) — optional selected slot for auto‑booking after verification
    - `{ therapist_id, date_iso: 'YYYY-MM-DD', time_label: 'HH:MM', format: 'online'|'in_person' }`
- __Behavior__:
  - Stores/merges `draft_contact` into `people.metadata.draft_contact` so the server can auto-create the match after verification (email confirm or SMS verify). Emits `draft_contact_stored` (via: 'email'|'phone').
  - Stores/merges `draft_booking` into `people.metadata.draft_booking` to auto-create a booking after verification when a slot was selected. Emits `draft_booking_stored` (via: 'email'|'phone').
  - Sends email magic link or SMS OTP based on mode.

## POST /api/public/verification/verify-code

- __Purpose__: Verify an SMS code. On success, marks phone verified and processes `metadata.draft_contact` like email confirm.
- __Behavior__:
  - Updates `people.metadata.phone_verified=true`, sets `status='new'`.
  - If `metadata.draft_contact` exists, calls `POST /api/public/contact` with `idempotency_key` and clears draft only after success. Emits `draft_contact_processed` or `draft_contact_failed`.
  - If `metadata.draft_booking` exists, creates a `bookings` row for the selected occurrence if not already taken, then clears `draft_booking`. Emits `booking_created`.


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
  - Consent: stores `consent_share_with_therapists=true`, `consent_share_with_therapists_at`, `consent_privacy_version`, and `consent_terms_version` under `people.metadata`. Emits `consent_captured` with `{ method: 'email'|'phone', privacy_version }`.
  - **Test 4 Variant Gating**: Auto-matching behavior depends on `campaign_variant`:
    - `concierge`: Skips `createInstantMatchesForPatient()` — leads require manual admin matching. Emits `concierge_lead_created` event.
    - `self-service` / `marketplace` / default: Calls `createInstantMatchesForPatient()` — returns `matchesUrl` in response. Emits `instant_match_created` event.
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
  - If `people.metadata.draft_contact` exists (therapist directory compose flow), the server creates a contact match automatically via `POST /api/public/contact` using an `idempotency_key = <person_id>:<therapist_id>:<contact_type>`. The draft is cleared only after a successful contact. Emits analytics `draft_contact_processed` or `draft_contact_failed`.
  - If `people.metadata.draft_booking` exists and points to a valid occurrence, the server creates a `bookings` row (idempotent on `(therapist_id, date_iso, time_label)`) and clears `draft_booking`. Emits `booking_created`.
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
  - `patient_reason` (string, optional) — short issue description
  - `patient_message` (string, optional) — full message to therapist
  - `session_format?` ('online' | 'in_person') — required when `contact_type='booking'`
  - `idempotency_key?` (string) — prevents duplicate sends on retries/refresh
- __Behavior__:
  - Validates: either `patient_reason` OR `patient_message` must be present. For `contact_type='booking'`, `session_format` is required.
  - Checks for existing `kh_client` session cookie. If valid, reuses patient record.
  - If no session: creates or finds patient by contact method, creates session token, sets cookie.
  - Rate limit: max 3 contacts per patient per 24 hours (tracked via `matches` table).
  - Consent: stores `consent_share_with_therapists=true`, `consent_share_with_therapists_at`, `consent_privacy_version`, and `consent_terms_version` in `people.metadata` for both new and existing patients; emits `consent_captured` with `{ method, privacy_version }`.
  - Idempotency: when `idempotency_key` is provided, returns the existing match and skips resending if a previous request with the same key created it.
  - Creates `match` record with `status='proposed'` and metadata: `{ patient_initiated: true, contact_type, patient_reason, patient_message, contact_method, session_format?, idempotency_key? }`.
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

### GET /api/public/matches/:uuid (EARTH-206 Enhanced)

- __Purpose__: Load patient context and recommended therapists from a pre‑authenticated match link for rich match page display.
- __Auth__: None (magic link via `matches.secure_uuid`).
- __Link TTL__: 30 days from the reference match creation (returns 410 after).
- __Path Param__:
  - `:uuid` — secure match UUID from email.
- __Behavior__:
  - Resolves `:uuid` to `patient_id` via `matches.secure_uuid`.
  - Returns enriched patient context (name, issue, session_preference, city, specializations, gender_preference) for match quality computation.
  - Returns up to 3 recommended therapists with rich data: modalities, session_preferences, approach_text, gender.
  - Marks therapists already contacted by the patient via `matches.metadata.patient_initiated` (exposes `contacted_at`).
  - Orders therapists using the same mismatch logic as Admin matching (perfect matches first).
  - Emits `match_link_view` via `ServerAnalytics`.
- __Response__:
  - 200: `{ data: { patient: { name?, issue?, session_preference?, city?, session_preferences?, specializations?, gender_preference? }, therapists: Array<{ id, first_name, last_name, photo_url?, city?, accepting_new?, contacted_at?, modalities?, session_preferences?, approach_text?, gender? }> }, error: null }`
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
-## Cron Authentication

- **Accepted mechanisms** for admin cron endpoints (any one):
  - `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`
  - `?token=<CRON_SECRET>` (manual runs)
- Note: `x-vercel-cron` is not trusted for auth in production (telemetry only).
- **Example**: see `src/app/api/admin/matches/selection-reminders/route.ts` and `src/app/api/admin/alerts/system/route.ts`.
- __Methods__:
  - `POST` with JSON body (manual/scripted runs)
  - `GET` with query params (when scheduled via Vercel Cron, include `x-cron-secret`)
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

## POST /api/admin/therapists/:id/slots

- __Purpose__: Create or update recurring availability slots for a therapist (admin-managed).
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__ (JSON):
  - `slots`: Array of objects (at least one required)
    - `day_of_week` (number, 0–6; Sunday=0)
    - `time_local` (string, `HH:MM`)
    - `format` (`'online' | 'in_person'`)
    - `address?` (string; required when `format='in_person'`)
    - `duration_minutes?` (number; default 60; 30–240)
    - `active?` (boolean; default true)
- __Validation__:
  - Max 5 active slots per therapist. Exceeding returns 400.
- __Behavior__:
  - Upserts on `(therapist_id, day_of_week, time_local, format, address)` and returns the full list after save.
- __Response__:
  - 200: `{ data: Array<slot>, error: null }`
  - 400/401/500 on failure.

## DELETE /api/admin/therapists/:id/slots/:slot_id

- __Purpose__: Delete a specific recurring slot.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400/401/500 on failure.

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
- __Response__:
  - 200: when 1 match created → `{ data: { id: uuid }, error: null }`
  - 200: when 2–3 matches created → `{ data: { ids: uuid[] }, error: null }`
  - 400: `{ data: null, error: 'patient_id is required' | 'therapist_id or therapist_ids is required' | 'Invalid patient_id' | 'Invalid therapist_id: <id>' | 'Maximum of 3 therapists allowed' | 'Invalid JSON' }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to verify therapists' | 'No matches created' }`

### POST /api/admin/matches/email

- __Purpose__: Send a patient-facing message related to matching. Templates: “match found”, “custom update”, and “selection”.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Request Body__ (JSON):
  - `id` (uuid, required for `match_found` | `custom`) — references `matches.id`
  - `template?` (`'match_found' | 'custom' | 'selection'`, default `'custom'`)
  - `message?` (string) — only for `template='custom'`; max 4000 chars
  - For `selection`:
    - `patient_id` (uuid, required)
    - `therapist_ids?` (uuid[]) — optional explicit selection (max 3). If omitted, infers up to 3 current `proposed` matches.
- __Behavior__:
  - `match_found`: loads match + therapist name; emails templated confirmation.
  - `custom`: emails arbitrary update.
  - `selection`: builds up to 3 recommendations (ranked by mismatch logic) and constructs a magic link `/matches/:uuid`.
    - Channel selection:
      - If patient has an email → sends email.
      - If no email but `phone_number` exists → sends SMS via Twilio Messaging Service (Alpha Sender), text: “Deine handverlesene Therapeuten-Auswahl ist bereit: <link>”.
      - Emits `email_attempted`/`email_sent` or `sms_attempted`/`sms_sent` accordingly.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }` (email path)
  - 200: `{ data: { ok: true, via: 'sms' }, error: null }` (SMS fallback path)
  - 400: `{ data: null, error: 'id is required' | 'Invalid JSON' | 'No contact method available' | 'No therapists provided or found for selection' }`
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
- **Auth**: One of:
  - Admin session cookie (`kh_admin`), or
  - Cron secret header `x-cron-secret` matching `CRON_SECRET` (or `Authorization: Bearer <CRON_SECRET>`) 
- **Methods**:
  - `POST` with JSON body (recommended for manual/scripted runs)
  - `GET` with query params (used by Vercel Cron per `vercel.json`)
- **Body** (JSON) or Query Params (GET):
  - `limit?`: number (default 100, max 1000)
- **Behavior**:
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

## POST /api/internal/sms/status

- __Purpose__: Twilio Programmable SMS delivery status callback (EARTH-206).
- __Auth__: Validates Twilio request signature when `TWILIO_AUTH_TOKEN` is set. If unset (local), accepts without validation.
- __Content-Type__: `application/x-www-form-urlencoded` (default from Twilio) or JSON.
- __Behavior__:
  - Parses status fields like `MessageSid|SmsSid`, `MessageStatus|SmsStatus`, `To`, `From`, optional `ErrorCode`.
  - Emits `sms_status` analytics with masked phone tails (e.g. `***123456`).
  - Returns 200 on success and does not leak PII.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 401: `{ data: null, error: 'Invalid signature' }` (when signature validation fails)

## GET /api/admin/stats (EARTH-215)

- __Purpose__: Admin analytics dashboard showing funnel metrics, page traffic, conversion to activation (email & SMS), match conversion, and user journey analysis.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Query Params__:
  - `days?` (number, optional) — Time window in days (default: 30, min: 1, max: 90)
  - `since?` (ISO date or `YYYY-MM-DD`, optional) — Overrides the funnel/event window start for wizard/engagement analysis
  - `cutoff?` (ISO date or `YYYY-MM-DD`, optional) — Global lower bound to ignore earlier data (useful for methodology changes); if not provided, a safe default cutoff is applied by the server
- __Behavior__:
  - Queries `events` table for analytics data within the specified time window.
  - **Wizard Funnel** uses proper cohort-based tracking:
    - Tracks the SAME sessions moving sequentially through steps 1-9.
    - A session "reached step N" if it viewed ALL steps 1 through N (inclusive).
    - This ensures funnel integrity: each step count is always ≤ previous step.
    - Drop rates are guaranteed to be non-negative.
    - Form completions are matched to sessions that reached step 9.
  - **Page Traffic**: Top 10 pages by unique sessions + daily time series.
  - **Journey Analysis**: Categorizes sessions by whether they visited /fragebogen, /therapeuten, both, or neither. UI simplified to distribution only.
  - **Directory Engagement**: Tracks help clicks, contact modals, and message sends from /therapeuten.
  - **Abandoned Fields**: Top 15 fields where users drop off.
  - **Conversion Funnel (Lead Activation)**: Derives totals and rates from `people(type='patient')` using `status` and `metadata`:
    - `email_only`, `email_confirmed`, confirmation rate
    - `phone_only`, `phone_verified` (from metadata), verification rate
    - `converted_to_new` (activation), overall activation rate
  - **Match Conversion Funnel**: Aggregates `matches.status` into contacted → responded → selected → accepted/declined and rates.
  - Removed low-signal UI blocks: “Segmented Funnel”, “Online OK”. “Abgebrochene Felder” merged under Wizard Funnel as a collapsible section.
- __Response__:
  - 200: `{ data: StatsResponse, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Unexpected error' }`
- __StatsResponse Schema__:
  ```typescript
  {
    totals: { therapists: number; clients: number; matches: number };
    pageTraffic: {
      top: Array<{ page_path: string; sessions: number }>;
      daily: Array<{ day: string; page_path: string; sessions: number }>;
    };
    wizardFunnel: {
      page_views: number;              // Unique sessions that viewed /fragebogen
      steps: Record<1-9, number>;      // Cohort size at each step (sequential filtering)
      form_completed: number;          // Sessions that completed AND reached step 9
      start_rate: number;              // (step 1 / page_views) * 100
    };
    wizardDropoffs: Array<{
      step: number;                    // Transition from step N to N+1
      from: number;                    // Cohort size at step N
      to: number;                      // Cohort size at step N+1 (always ≤ from)
      drop: number;                    // from - to (always ≥ 0)
      drop_rate: number;               // (drop / from) * 100
    }>;
    abandonFieldsTop: Array<{ field: string; count: number }>;
    directory: {
      views: number;                   // Unique sessions on /therapeuten
      helpClicks: number;              // Clicks on questionnaire CTA from /therapeuten
      navClicks: number;               // "Alle Therapeuten ansehen" clicks site-wide
      contactOpened: number;           // Contact modal opens on /therapeuten
      contactSent: number;             // Messages sent via contact modal
    };
    journeyAnalysis: {
      fragebogen_only: number;
      therapeuten_only: number;
      both_fragebogen_first: number;
      both_therapeuten_first: number;
      neither: number;
      total_sessions: number;
      questionnaire_preference_rate: number;
      directory_to_questionnaire_rate: number;
    };
    conversionFunnel: {
      total_leads: number;
      email_only: number;
      phone_only: number;
      email_confirmed: number;
      phone_verified: number;
      converted_to_new: number;
      email_confirmation_rate: number; // % of email_only
      phone_verification_rate: number; // % of phone_only
      overall_activation_rate: number; // % of total_leads
    };
    matchFunnel: {
      total_matches: number;
      therapist_contacted: number;
      therapist_responded: number;
      patient_selected: number;
      accepted: number;
      declined: number;
      response_rate: number;   // responded / contacted * 100
      acceptance_rate: number; // accepted / responded * 100
      overall_conversion: number; // accepted / total_matches * 100
    };
  }
  ```
- __Implementation Notes__:
  - **Funnel Best Practice**: Uses cohort-based sequential filtering instead of independent step counts.
  - **Why This Matters**: Previous implementation counted ANY session at each step, leading to negative drop rates when users jumped to later steps. The corrected approach ensures mathematical integrity and accurate conversion metrics.
  - **Event Types Used**:
    - `page_view` with `properties.page_path` for page traffic and wizard entry
    - `screen_viewed` with `properties.step` (1-9) for wizard progression
    - `form_completed` with `properties.session_id` for completion tracking
    - `field_abandonment` with `properties.fields` for abandonment analysis
    - `cta_click`, `contact_modal_opened`, `contact_message_sent` for directory engagement

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

## Email Cadence (Post-Verification Follow-up)

Three-stage nurture sequence for patients who verified but haven't booked.

### GET /api/admin/leads/rich-therapist-email

- Purpose: Day 1 personalized email featuring the top therapist match with photo, modalities, and approach text.
- Auth: Cron secret or Admin cookie.
- Window: 20–28 hours after `email_confirmed_at`.
- Skips: No email, already sent, has selection, no matches.
- Tracks: `email_sent` with `kind='rich_therapist_d1'`.

### GET /api/admin/leads/selection-nudge

- Purpose: Day 5 reassurance email addressing common hesitations (free intro call, chemistry shows in person, can switch anytime).
- Auth: Cron secret or Admin cookie.
- Window: 5–6 days after `email_confirmed_at`.
- Requires: Day 1 email was sent.
- Tracks: `email_sent` with `kind='selection_nudge_d5'`.

### GET /api/admin/leads/feedback-request

- Purpose: Day 10 feedback collection with one-click options and interview incentive (€25 voucher).
- Auth: Cron secret or Admin cookie.
- Window: 10–11 days after `email_confirmed_at`.
- Requires: Day 5 email was sent.
- Links to: `/feedback/quick?patient=...&reason=...`
- Tracks: `email_sent` with `kind='feedback_request_d10'`.

### GET /api/admin/emails/preview

- Purpose: QA endpoint to preview or send email templates to `LEADS_NOTIFY_EMAIL`.
- Auth: Cron secret or Admin cookie.
- Query Params:
  - `template`: `rich_therapist` | `selection_nudge` | `feedback_request` | `email_confirmation` | `all`
  - `send`: `true` to send, omit for HTML preview
- Example: `GET /api/admin/emails/preview?template=all&send=true&token=...`

### Cron Configuration

See `vercel.json` for these cron schedules (9 AM / 10 AM daily).

Notes:
- Email HTML uses inline styles and `renderTherapistPreviewEmail()` for client compatibility.
- All email sending is best-effort and logged via the unified logger.

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
  campaign_variant: string;
  leads: number;
  confirmed: number;
  confirmation_rate: number;
}>
```

### Page Traffic & Wizard/Directory Tracking (EARTH-215)

With EARTH-215, the admin stats endpoint was completely rebuilt to focus on actionable tracking insights. All previously broken queries were removed. The endpoint now returns clean, tested data for page traffic, questionnaire funnel analysis (steps 1-9), and directory engagement.

**Query Parameters:**
- `days` (default `30`, max `90`): Window for aggregating events

**Response Structure:**

```typescript
{
  data: {
    totals: {
      therapists: number;        // Total registered therapists (all-time)
      clients: number;           // Total registered patients (all-time)
      matches: number;           // Total matches created (all-time)
    };
    pageTraffic: {
      top: Array<{
        page_path: string;       // e.g. '/therapeuten', '/fragebogen'
        sessions: number;        // Unique sessions (by session_id)
      }>;                        // Top 10 pages, sorted by sessions desc
      daily: Array<{
        day: string;             // 'YYYY-MM-DD' (UTC)
        page_path: string;
        sessions: number;
      }>;                        // Daily breakdown for top 10 pages only
    };
    wizardFunnel: {
      page_views: number;        // Unique sessions viewing /fragebogen (questionnaire page)
      steps: Record<number, number>; // step 1-9 => unique sessions
      form_completed: number;    // people.metadata.form_completed_at count
      start_rate: number;        // (step1 / page_views) * 100
    };
    wizardDropoffs: Array<{
      step: number;              // Transition from step k → k+1
      from: number;              // Sessions at step k
      to: number;                // Sessions at step k+1
      drop: number;              // from - to (can be negative if sessions increase)
      drop_rate: number;         // (drop / from) * 100 (can be negative)
    }>;                          // 8 rows (steps 1→2 through 8→9)
    abandonFieldsTop: Array<{
      field: string;             // Field name from field_abandonment events
      count: number;             // Number of abandonment occurrences
    }>;                          // Top 15, sorted by count desc
    directory: {
      views: number;             // Unique sessions viewing /therapeuten
      helpClicks: number;        // cta_click with id='therapeuten-callout-fragebogen' FROM /therapeuten page
      navClicks: number;         // "Alle Therapeuten ansehen" clicks across site
                                 // (id='alle-therapeuten' OR source='alle-therapeuten' OR href ends '/therapeuten')
      contactOpened: number;     // contact_modal_opened on /therapeuten (referrer contains '/therapeuten')
      contactSent: number;       // contact_message_sent on /therapeuten
    };
    journeyAnalysis: {
      fragebogen_only: number;              // Sessions viewing only /fragebogen
      therapeuten_only: number;             // Sessions viewing only /therapeuten
      both_fragebogen_first: number;        // Visited /fragebogen first, then /therapeuten
      both_therapeuten_first: number;       // Visited /therapeuten first, then /fragebogen
      neither: number;                      // Sessions not visiting either key page
      total_sessions: number;               // Total unique sessions analyzed
      questionnaire_preference_rate: number; // % of engaged users preferring questionnaire
                                            // (fragebogen_only + both_fragebogen_first) / (all engaged)
      directory_to_questionnaire_rate: number; // % of directory starters who went to questionnaire
                                            // both_therapeuten_first / (therapeuten_only + both_therapeuten_first)
    };
  };
  error: null;
}
```

**Key Design Decisions:**
- **Session-based deduplication**: All aggregations use `session_id` for unique sessions (not raw event counts)
- **Page traffic consistency**: `wizardFunnel.page_views` counts only `/fragebogen` sessions to match Page Traffic logic (not all page_view events)
- **Wizard tracking**: Steps 1-9 tracked via `screen_viewed` events with `properties.step`
- **Negative dropoffs allowed**: When more sessions appear at later steps (returning users, multi-device), dropoff can be negative
- **Average time removed**: Multi-day session gaps caused skewed averages; removed entirely (dropoff rates more actionable)
- **Directory help clicks scoped**: Only counts clicks from `/therapeuten` page using `properties.page_path` filter to prevent inflation from other pages
- **Abandoned fields**: Aggregated from `field_abandonment` events with `properties.fields` array
- **Totals are all-time**: Not filtered by time window; show lifetime therapists, clients, and matches
- **Journey analysis**: Tracks user preference between questionnaire (/fragebogen) vs directory (/therapeuten) by analyzing page_view sequences per session, determining first-visited page for users who visit both

**Event Dependencies:**
- `page_view` with `properties.page_path` (PR1: PageAnalytics updated)
- `screen_viewed` with `properties.step` (1-9)
- `screen_completed` with `properties.step` and `properties.duration_ms`
- `field_abandonment` with `properties.fields` (array)
- `cta_click` with `properties.id`, `properties.source`, `properties.href` (PR1: CtaLink updated)
- `contact_modal_opened` and `contact_message_sent` with `properties.referrer`

**Testing:**
- Comprehensive unit tests in `tests/admin.api.stats.tracking.test.ts` (15 passing tests)
- Tests cover aggregation logic, deduplication, dropoff calculations, and rate computations

**Ads Readiness:**
PR4 (ads readiness summary) was intentionally skipped per EARTH-215 implementation plan.
