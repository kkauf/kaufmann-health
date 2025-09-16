# API

## POST /api/leads
- __Purpose__: Create a `people` row for a new lead (patient or therapist).
- __Auth__: None (public funnel). Route uses service role on the server; add rate limiting/bot protection as needed.
- __Request Body__ (JSON):
  - `email` (required)
  - Optional common: `name`, `phone`, `notes`, `city`, `issue`, `availability`, `budget`, `specializations` (array of slugs)
  - Lead type: `type` (optional: `patient` | `therapist`, default `patient`)
  - Patient-only: `session_preference`, `session_preferences`, `consent_share_with_therapists` (required), `privacy_version`
  - Therapist JSON: requires at least one `specializations` entry (modality)
- __Validation__: email regex; strings sanitized (control chars removed; ~1000 chars max). Server requires `email`. For patient leads, explicit consent is required via `consent_share_with_therapists`.
- __Behavior__:
  - `type` set from payload (default `patient`).
  - `status` defaults to `new` for patients; `pending_verification` for therapists.
  - Packs extras in `metadata` and sets `funnel_type` (`koerperpsychotherapie` for patients; `therapist_acquisition` for therapists), `submitted_at`, plus `ip` and `user_agent` when available.
  - Recognized `specializations` slugs: `narm`, `core-energetics`, `hakomi`, `somatic-experiencing` (others ignored).
  - Enhanced Conversions: after a successful insert, the server may upload a hashed email (SHA-256) to Google Ads using configured env variables. Failures are logged and do not block the request.
- __Rate limiting__: IP-based, 60s window (best effort via `x-forwarded-for`). Patients: checks recent inserts in `people` by `metadata.ip`. Therapists: additionally checks recent `therapist_contracts` rows by hashed IP (`sha256(IP_HASH_SALT + ip)`). On exceed, returns 429.
- __Notifications (optional)__: If `RESEND_API_KEY` and `LEADS_NOTIFY_EMAIL` are set, the API will send a non-blocking email via Resend on new lead. Use `LEADS_FROM_EMAIL` to control the sender address (defaults to `no-reply@kaufmann-health.de`).
- __Notes__: No alias `/api/directory-requests`; use `/api/leads`.
- __Response__:
  - 200: `{ data: { id: uuid }, error: null }`
  - 400: `{ data: null, error: 'Invalid email' | 'Invalid JSON' | 'Einwilligung zur Datenübertragung erforderlich' }`
  - 429: `{ data: null, error: 'Rate limited' }`
  - 500: `{ data: null, error: 'Failed to save lead' }`

## POST /api/therapists/:id/documents

- __Purpose__: Step 2 of the two-step flow (EARTH-129). Upload required verification documents after signup (email link). The flow is split to respect serverless body limits and ensure at least one specialization certificate is provided.
- __Auth__: None (access via emailed link). The endpoint validates that the therapist exists and is in `pending_verification`; otherwise returns 404 to avoid information leaks.
- __Content-Type__: `multipart/form-data`
- __Path Param__:
  - `:id` — therapist UUID returned from `/api/leads` (therapist JSON or multipart path)
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

Example (multipart):
```bash
curl -X POST http://localhost:3000/api/leads \
  -F type=therapist \
  -F email=therapist@example.com \
  -F name="Max Muster" \
  -F city=Berlin \
  -F "session_preference=online" \
  -F "specializations=narm" \
  -F "specializations=hakomi" \
  -F license=@/path/to/license.pdf \
  -F specialization_cert_narm=@/path/to/narm-cert-1.pdf \
  -F specialization_cert_hakomi=@/path/to/hakomi-cert-1.jpg \
  -H "Accept: application/json"
```


Example:
```bash
curl -X POST /api/leads \
  -H 'Content-Type: application/json' \
  -d '{"email":"max@example.com","city":"Berlin"}'
```

## GET /admin/api/leads
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

## GET /admin/api/therapists
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

## GET /admin/api/therapists/:id
- __Purpose__: Retrieve single therapist details including profile data for review.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Response__:
  - 200: `{ data: { id, name, email, phone, city, status, profile: { photo_pending_url?: string, approach_text?: string, photo_url?: string } }, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Unexpected error' }`

## PATCH /admin/api/leads/:id

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

## PATCH /admin/api/therapists/:id
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

## GET /admin/api/therapists/:id/documents/[...type]
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

## POST /admin/api/matches
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

### POST /admin/api/matches/email

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

## POST /admin/api/therapists/:id/reminder

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

## POST/GET /admin/api/therapists/reminders

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
- `/api/leads` (therapist): Welcome email prompts profile completion.
- `/api/therapists/:id/documents` (POST): Upload confirmation after successful submission.
- `/admin/api/therapists/:id` (PATCH): Sends approval/rejection emails when status changes.

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
    - To therapist: selection notification with basic client contact info (name/email/phone if available).
    - To patient: confirmation that the selected therapist will reach out (German copy).
  - Emits event `patient_selected` via `ServerAnalytics`.
- Responses:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing uuid' | 'therapist is required' | 'Invalid JSON' }`
  - 404: `{ data: null, error: 'Not found' | 'Match not available' }`
  - 500: `{ data: null, error: 'Failed to update' }`

### POST /admin/api/matches/email (extended)

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

### GET /admin/api/matches/selection-reminders

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

Vercel Cron is configured in `vercel.json`:

```
{ "path": "/admin/api/matches/selection-reminders?stage=24h", "schedule": "0 12 * * *" }
{ "path": "/admin/api/matches/selection-reminders?stage=48h", "schedule": "0 16 * * *" }
{ "path": "/admin/api/matches/selection-reminders?stage=72h", "schedule": "0 18 * * *" }
{ "path": "/admin/api/matches/therapist-action-reminders?stage=20h", "schedule": "0 * * * *" }
```

Notes:
- Email HTML uses inline styles and the existing `renderTherapistPreviewEmail()` to ensure client compatibility.
- All email sending is best-effort and logged via the unified logger (`email_sent`, `email_retry`, `email_timeout_retry`).

## EARTH-126: Therapist Action Template (One-Click Client Contact)

### GET /api/track/therapist-action

- Purpose: Tracking redirect used in therapist notification emails to capture one-click actions before opening the user's mail client.
- Auth: None. Accepts only `mailto:` redirects to avoid open redirect abuse.
- Query Params:
  - `action` (string, required): currently `email_clicked`.
  - `match_id` (uuid, required): `matches.id` for observability and side-effects.
  - `redirect` (string, required): must start with `mailto:`. This is the actual mailto link with prefilled subject/body.
- Behavior:
  - When `action='email_clicked'`, sets `matches.therapist_contacted_at = now()` for the given `match_id` (best-effort).
  - Emits event `therapist_action_email_clicked` via `ServerAnalytics`.
  - Issues a 302 redirect to the given `mailto:` link (works universally on desktop/mobile mail clients).
- Responses:
  - 302: Redirect to `mailto:` URL (on success)
  - 400: `{ data: null, error: 'Missing action' | 'Missing match_id' | 'Missing redirect' | 'Invalid redirect' }`
  - 500: `{ data: null, error: 'Unexpected error' }`

### GET /admin/api/matches/therapist-action-reminders

- Purpose: Send a 20-hour reminder to therapists who were selected by a patient but haven’t clicked the email CTA yet.
- Auth: Admin cookie or Cron secret (`x-cron-secret` / `Authorization: Bearer`), or Vercel platform header `x-vercel-cron`.
- Query Params:
  - `stage`: currently `20h` (window is between 20 and 21 hours after the initial selection event).
- Behavior:
  - Scans `public.events` for `patient_selected` in the [T-21h, T-20h) window and extracts `match_id`.
  - Skips matches not in `status='patient_selected'` or already having `therapist_contacted_at`.
  - Sends an email to the therapist with a big CTA button that opens a prefilled `mailto:` message (wrapped via `/api/track/therapist-action`).
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

### GET /admin/api/matches/blocker-survey

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

Added in `vercel.json`:

```
{ "path": "/admin/api/matches/blocker-survey", "schedule": "0 10 * * *" }
```

### Admin Stats

`GET /admin/api/stats` now returns a new dataset:

```
blockers: {
  last30Days: {
    total: number,
    breakdown: Array<{ reason: string; count: number; percentage: number }>
  }
}
```
