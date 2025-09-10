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

- __Purpose__: Upload required verification documents and optional profile fields after signup (email link). Builds on EARTH-71 and EARTH-115.
- __Auth__: None (access via emailed link). The endpoint validates that the therapist exists and is in `pending_verification`; otherwise returns 404 to avoid information leaks.
- __Content-Type__: `multipart/form-data`
- __Path Param__:
  - `:id` — therapist UUID returned from `/api/leads` (therapist JSON or multipart path)
- __Required fields__:
  - `psychotherapy_license`: one document proving qualification. Formats: PDF, JPG, PNG. Max 10MB.
  - `specialization_cert`: at least one modality certificate. Multiple files allowed (send multiple fields of the same name). Formats: PDF, JPG, PNG. Max 10MB each.
- __Optional fields__:
  - `profile_photo`: JPEG or PNG, max 5MB. Stored pending review.
  - `approach_text`: string, max 2000 chars.
- __Storage__:
  - Documents are stored in private bucket `therapist-documents` under `therapists/<id>/...` and merged into `therapists.metadata.documnpnts` as:
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
  - 400: `{ data: null, error: 'Missing psychotherapy_license' | 'license: <reason>' | 'profile_photo: <reason>' | 'approach_text too long (max 2000 chars)' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Failed to upload document' | 'Failed to update' | 'Unexpected error' }`

### Therapist uploads (multipart)
- __Content-Type__: `multipart/form-data`
- __Required files__:
  - `license`: one document proving qualification. Accepted: Psychologischer Psychotherapeut (approbiert), Heilpraktiker für Psychotherapie, Großer Heilpraktiker. Formats: PDF, JPG, PNG. Max 10MB.
  - `specialization_cert_{slug}`: at least one certificate per selected specialization.
    - Supported slugs: `narm`, `core-energetics`, `hakomi`, `somatic-experiencing`
    - Multiple files allowed per slug (send multiple fields of the same name)
- __Optional profile fields__ (EARTH-116):
  - `profile_photo`: JPEG or PNG, max 5MB. Stored in private `therapist-applications` bucket under `applications/<therapist-id>/profile-photo-<ts>.(jpg|png)` pending admin review.
  - `approach_text`: string, max 2000 chars. Stored in `therapists.metadata.profile.approach_text`.
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
  - `specialization` (optional: slug, e.g. `narm`)
  - `status` (optional: `pending_verification` | `verified` | `rejected`, default `pending_verification`)
  - `limit` (optional, default 50, max 200)
- __Response__:
  - 200: `{ data: Array<Pick<people, 'id'|'name'|'email'|'phone'|'type'|'status'|'metadata'|'created_at'>>, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to fetch therapists' }`

## GET /admin/api/therapists/:id
- __Purpose__: Retrieve single therapist details including profile data for review.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Response__:
  - 200: `{ data: { id, name, email, phone, city, status, profile: { photo_pending_url?: string, approach_text?: string, photo_url?: string } }, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 404: `{ data: null, error: 'Not found' }`
  - 500: `{ data: null, error: 'Unexpected error' }`

## PATCH /admin/api/therapists/:id
- __Purpose__: Update therapist verification status, notes, and profile approval.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__:
  - `status?`: `pending_verification` | `verified` | `rejected`
  - `verification_notes?`: string
  - `approve_profile?`: boolean — when true, moves pending photo from `therapist-applications` to public `therapist-profiles` and sets `photo_url`. Also clears `metadata.profile.photo_pending_path`.
  - `approach_text?`: string (max 2000) — updates `metadata.profile.approach_text`.
- __Response__:
  - 200: `{ data: { ok: true }, error: null }`
  - 400: `{ data: null, error: 'Missing fields' | 'Invalid status' | 'approach_text too long (max 2000 chars)' | 'No pending profile photo to approve' }`
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

---

## POST /admin/api/therapists/:id/reminder

- __Purpose__: Send a profile completion reminder email to a specific therapist, based on missing items derived from `therapists.metadata`.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Body__ (JSON):
  - `stage?`: Optional label for the email subject (e.g. "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung").
- __Behavior__:
  - Computes missing items: `documents` (license), `photo` (pending path), `approach` (text).
  - Sends reminder email including CTA link to `/therapists/upload-documents/:id`.
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
