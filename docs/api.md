# API

## POST /api/leads
- __Purpose__: Create a `people` row for a new patient lead.
- __Auth__: None (public funnel). Route uses service role on the server; add rate limiting/bot protection as needed.
- __Request Body__ (JSON):
  - `email` (required)
  - Optional: `name`, `phone`, `notes`, `city`, `issue`, `availability`, `budget`
- __Validation__: email regex; strings sanitized (control chars removed; max ~1000 chars).
- __Behavior__: inserts with `type='patient'`, `status='new'`, packs extras in `metadata` plus `funnel_type='narm'` and `submitted_at`.
- __Response__:
  - 200: `{ data: { id: uuid }, error: null }`
  - 400: `{ data: null, error: 'Invalid email' | 'Invalid JSON' }`
  - 500: `{ data: null, error: 'Failed to save lead' }`

Example:
```bash
curl -X POST /api/leads \
  -H 'Content-Type: application/json' \
  -d '{"email":"max@example.com","city":"Berlin"}'
```
