# API

## POST /api/leads
- __Purpose__: Create a `people` row for a new patient lead.
- __Auth__: None (public funnel). Route uses service role on the server; add rate limiting/bot protection as needed.
- __Request Body__ (JSON):
  - `email` (required)
  - Optional: `name`, `phone`, `notes`, `city`, `issue`, `availability`, `budget`, `specializations` (array of slugs)
- __Validation__: email regex; strings sanitized (control chars removed; ~1000 chars max). Server requires `email`; `phone` is optional server-side (funnel UI requires phone on client).
- __Behavior__: inserts with `type='patient'`, `status='new'`, packs extras in `metadata` plus `funnel_type='koerperpsychotherapie'`, `submitted_at`, as well as `ip` and `user_agent` when available. Recognized `specializations` slugs: `narm`, `core-energetics`, `hakomi`, `somatic-experiencing` (others ignored).
- __Rate limiting__: basic IP-based rate limiting (60s window). Best effort via `x-forwarded-for`. Exceeds return 429.
- __Notifications (optional)__: If `RESEND_API_KEY` and `LEADS_NOTIFY_EMAIL` are set, the API will send a non-blocking email via Resend on new lead. Use `LEADS_FROM_EMAIL` to control the sender address (defaults to `no-reply@kaufmann-health.de`).
- __Notes__: No alias `/api/directory-requests`; use `/api/leads`.
- __Response__:
  - 200: `{ data: { id: uuid }, error: null }`
  - 400: `{ data: null, error: 'Invalid email' | 'Invalid JSON' }`
  - 429: `{ data: null, error: 'Rate limited' }`
  - 500: `{ data: null, error: 'Failed to save lead' }`

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
  - `limit` (optional, default 50, max 200)
- __Response__:
  - 200: `{ data: Array<Pick<people, 'id'|'name'|'email'|'phone'|'type'|'status'|'metadata'|'created_at'>>, error: null }`
  - 401: `{ data: null, error: 'Unauthorized' }`
  - 500: `{ data: null, error: 'Failed to fetch therapists' }`

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
