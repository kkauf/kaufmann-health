# Security Decisions (What matters and why)

- __Service role only on server__: `SUPABASE_SERVICE_ROLE_KEY` is used exclusively in API routes (Node runtime). Never expose to the browser. Why: service role bypasses RLS—treat the route as the policy boundary.
- __RLS enabled__ on `people` and `matches`. Clients never access these tables directly; API routes using the service role are the policy boundary. Tighten table policies as productized auth emerges.
- __Input hardening__: `/api/public/leads` sanitizes strings (control chars removed, length capped) and validates email. Why: prevent low-effort injection/spam and malformed data.
- __Timezone safety__: `created_at` is `timestamptz`. Why: avoid cross-timezone ambiguity.
- __PII considerations__: Emails/phones are PII. Ensure production logs avoid sensitive payloads. Consider retention and encryption requirements before scale.
- __Abuse controls__: Add rate limiting (IP-based), bot protection (Turnstile/reCAPTCHA) for public lead forms. Why: service route is intentionally open to accept new leads.

## Admin Authentication & Cookies

- __Admin session__: `POST /api/admin/login` sets an HTTP-only `kh_admin` cookie (HMAC-signed via Web Crypto) with 24h expiry and `Path=/admin`. Edge Middleware protects `/admin/*`. Public site is cookie-free by default; functional cookies are allowed only within `/admin`. When `NEXT_PUBLIC_COOKIES=true`, marketing cookies (Google Ads conversion linker) are set only after explicit consent via the cookie banner; users can revisit consent via the footer “Cookie‑Einstellungen”.
- __Login rate limiting__: 10 requests/minute per IP; returns 429 with `Retry-After` seconds when exceeded.
- __Server-side measurement (default)__: We rely on server-side Google Ads Enhanced Conversions (hashed email) without requiring browser cookies. In consented mode, the Google Ads conversion linker cookie may be enabled post-consent to improve attribution; Enhanced Conversions remain server-side in all cases.

## Storage: Therapist Documents
- __Bucket__: `therapist-documents` (private)
- __Access__:
  - `authenticated` users can `insert` into this bucket (uploads only). Paths are application-controlled.
  - `service_role` can `select` and `all` (manage) for admin workflows.
- __Why__: Keep verification documents out of the public scope; enforce least privilege via RLS. Public site remains cookie-free; authentication only used in restricted areas.
 - __Validation__: Server accepts only PDF/JPG/PNG; 10MB max per file.
 - __Serving__: Documents are never exposed via public signed URLs. Admin-only routes stream files server-side using the service role.
