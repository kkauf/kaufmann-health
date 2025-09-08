# API

## POST /api/leads
- __Purpose__: Create a `people` row for a new lead (patient or therapist).
- __Auth__: None (public funnel). Route uses service role on the server; add rate limiting/bot protection as needed.
- __Request Body__ (JSON):
  - `email` (required)
  - Optional common: `name`, `phone`, `notes`, `city`, `issue`, `availability`, `budget`, `specializations` (array of slugs)
  - Lead type: `type` (optional: `patient` | `therapist`, default `patient`)
  - Patient-only: `session_preference`, `session_preferences`, `consent_share_with_therapists` (required), `privacy_version`
  - Therapist-only: `qualification`, `experience`, `website`
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
- __Purpose__: Create a proposed match between a patient and a therapist.
- __Auth__: Admin session cookie (`kh_admin`, Path=/admin).
- __Request Body__ (JSON):
  - `patient_id` (uuid, required)
  - `therapist_id` (uuid, required)
  - `notes` (string, optional)
- __Validation__: Ensures `patient_id` references `people(type='patient')` and `therapist_id` references `people(type='therapist')`.
- __Response__:
  - 200: `{ data: { id: uuid }, error: null }`
  - 400: `{ data: null, error: 'patient_id and therapist_id are required' | 'Invalid patient_id' | 'Invalid therapist_id' | 'Invalid JSON' }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to create match' | 'Failed to verify entities' }`
