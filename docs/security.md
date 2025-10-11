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

## RLS Boundaries & Access Model

- **Policy boundary lives in API routes** using the `service_role` Supabase client (`src/lib/supabase-server.ts`). Client code does not talk to privileged tables.
- **RLS enabled** on `people`, `matches`, `therapist_contracts`, and analytics `events`.
  - Inserts/updates are performed by server routes only; the browser never uses the service role.
  - Storage buckets:
    - `therapist-documents` (private): authenticated insert; `service_role` read/manage only.
    - `therapist-applications` (private): holds pending profile photos before approval.
    - `therapist-profiles` (public): serves approved photos via our image proxy.

## Cookies, Consent, and Privacy

- **Public site is cookie-free by default.** Functional cookies are limited to `/admin`.
- **Consent Mode v2**: When `NEXT_PUBLIC_COOKIES=true`, only Google Ads conversion linker is enabled post-consent (no analytics/personalization cookies).
- **Server-side measurement first**: Google Ads Enhanced Conversions (hashed email) run server-side. Minimal client signal fires only after Fragebogen completion and is deduped by lead id.
- **PII handling**: No PII in `events.properties`. IPs are hashed with `IP_HASH_SALT`.

- **Consent storage (patients)**: API stores consent in `people.metadata`:
  - `consent_share_with_therapists: true`
  - `consent_share_with_therapists_at: <ISO timestamp>`
  - `consent_privacy_version: <string>` (kept in sync with `src/lib/privacy.ts`)
  - Enforced in `POST /api/public/leads` and standardized in `POST /api/public/contact`.
- **Consent record (therapists)**: AGB acceptance is recorded in `therapist_contracts` with the current `TERMS_VERSION` (see `src/content/therapist-terms`). The UI shows an acceptance line; the server record is canonical.

## Admin Session & Scope

- **Login**: `POST /api/admin/login` sets HTTP-only `kh_admin` cookie, 24h expiry, `Path=/admin`.
- **Middleware**: Edge middleware protects `/admin/*`. Purpose: keep public surface cookie-free.
- **Token**: HMAC via Web Crypto in `src/lib/auth/adminSession.ts`.

## Cron Authentication

- **Accepted mechanisms** for admin cron endpoints (any one):
  - `x-vercel-cron` header (Vercel Cron invocations)
  - `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`
  - `?token=<CRON_SECRET>` (fallback for manual runs)
- **Example**: see `src/app/api/admin/matches/selection-reminders/route.ts` and `src/app/api/admin/alerts/system/route.ts`.

## Secrets & Runtime Boundaries

- **Secrets live on server only** (Vercel Project Settings). Never expose service role keys to the browser.
- **Node runtime** for endpoints touching secrets or storage (set `export const runtime = 'nodejs'`).
- **Configuration**: `.env.example` documents all relevant keys; copy to `.env.local` for local dev.

## Image & Email Safety Nets

- **Image proxy**: All therapist profile images in emails are rewritten to the internal proxy (`/api/images/therapist-profiles/[...path]`) to avoid external hotlinks and enhance deliverability.
- **Email templates**: Patient emails avoid external links; inline styles, local images only.

## IP Hashing & Retention

- **Hashing**: `sha256(IP_HASH_SALT + ip)` stored in `events.hashed_ip` for diagnostics; raw IPs are not persisted.
- **Rotation**: Rotate `IP_HASH_SALT` only if compromised; consider versioning if frequent rotations are required.
- **Retention**: Revisit data retention windows as volume grows; start with 90-day rolling for `events` if needed.

## Incident Response (Runbook)

1. Open `/admin/errors` and filter `level=error`.
2. Check the latest digest email (subject `[KH] System alerts: ...`).
3. For stack details/timeouts, open Vercel → Functions → Logs for the affected route.
4. If email delivery issues: verify `RESEND_API_KEY`, template context, and check logger entries `email_attempted` / `error`.
5. If cron failed: re-run with `?token=<CRON_SECRET>`; inspect `cron_failed` events.

## Google Ads Campaign Configuration Security

**Problem:** Campaign configs contain sensitive competitive intelligence (keywords, budgets, ad copy, policy workarounds). Public exposure reveals strategy to competitors and violates operational security.

### Private Folder Policy

**All production campaign configs MUST be stored in:**
```
google_ads_api_scripts/private/
```

This folder is **gitignored** and will never be committed to the public repo.

**File naming convention:**
- `campaign-config-{test-name}.ts` — TypeScript configs (preferred)
- `{campaign-name}.json` — JSON configs (for CLI use)

**What goes in `private/`:**
- Actual keywords, budgets, and scheduling
- Real landing page URLs
- Ad copy (headlines, descriptions)
- Negative keyword lists
- Budget amounts and bid strategies
- Policy workaround strategies and flagged keywords

**What can be public:**
- Type definitions (`CampaignConfig`, `KeywordTier`)
- Generic scripts (`create-campaigns.ts`, `monitor-campaigns.ts`)
- Ultra-minimal examples with dummy data only

### Protection Mechanisms

**.gitignore entry (enforced):**
```gitignore
/google_ads_api_scripts/private/
```

**Public file rules:**
- No comments revealing flagged keywords or policy violations
- No real keyword examples (use generic placeholders)
- No budget amounts or actual landing pages
- Sample configs for type demonstration only

### Audit Commands

Check for accidental exposure:
```bash
# Check if private configs were ever committed
git log --all --full-history -- "google_ads_api_scripts/private/"

# Check for keyword leaks in commit messages
git log --all --grep="keyword-terms" --oneline

# Check for deleted config files that might have been public
git log --all --full-history --diff-filter=D -- "google_ads_api_scripts/*.json"
```

**Status:** Private folder contents have never been committed; sensitive comments removed from public files.

## Security Checklist (Essentials)

- [ ] Service role only in server routes; never in client code.
- [ ] RLS enabled on privileged tables; storage buckets private by default.
- [ ] Admin cookie scoped to `/admin`; no tracking cookies on public.
- [ ] Consent Mode v2 honored; Ads linker only after consent.
- [ ] No PII in analytics events; IPs hashed with salt.
- [ ] Cron endpoints require `x-vercel-cron` or `CRON_SECRET`.
- [ ] Secrets set in Vercel env; Node runtime for secret-using routes.
- [ ] Campaign configs in `private/` folder; no real keywords in public files.
