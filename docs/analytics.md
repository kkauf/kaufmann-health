# Analytics & Observability

## Overview
- Dual system by design. No duplication.
  - Supabase Events: business logic, user behavior, and errors (system observability). Source of truth for what happened.
  - Vercel Analytics: high‑level funnels and page signals (cookieless). Not for debugging.
- APIs always return `{ data, error }`. Errors are logged server‑side via unified logger.

## Where to look (birdseye)
- Supabase Events (Admin UI): `/admin/errors`
  - Filter by `source` (e.g., `api.leads`, `email.client`) and `type` (e.g., `error`, `cron_failed`, `lead_submitted`).
  - Default to level `error`; enable `warn`/`info` only when needed.
- Vercel Logs: Function runtime traces and stack output. Use when an error didn’t reach Supabase (e.g., cold‑start/freeze) or you need stack details.
- Vercel Analytics: page views and major conversions only. Never used for debugging or detailed flows.

## Supabase Events (unified)
- Table: `public.events` with `id, level('info'|'warn'|'error'), type, properties jsonb, hashed_ip, user_agent, created_at`.
- Helpers
  - `track({ type, source, props, ip, ua })` — info/warn.
  - `logError(source, error, props?, ip?, ua?)` — standardized error payloads.
  - `ServerAnalytics.trackEventFromRequest(req, { type, source, props })` — merges referrer/UTMs + IP/UA.
- Event naming (core)
  - Business: `lead_submitted`, `email_submitted`, `email_confirmed`, `form_completed`, `therapist_responded`, `match_created`, `faq_open`, `cta_click`.
  - Contact flow (EARTH-203): `contact_modal_opened`, `contact_verification_code_sent`, `contact_verification_completed`, `contact_message_sent`, `contact_match_created`, `contact_email_sent`, `contact_rate_limit_hit`.
 - Contact flow (EARTH-203): `contact_modal_opened`, `contact_verification_code_sent`, `contact_verification_completed`, `contact_message_sent`, `contact_match_created`, `contact_email_sent`, `contact_rate_limit_hit`.
 - Directory draft (server-side): `draft_contact_stored` (via: 'email'|'phone'), `draft_contact_processed`, `draft_contact_failed` (includes HTTP status on failure). Emitted by:
   - `POST /api/public/verification/send-code` (stored)
   - `GET /api/public/leads/confirm` (processed/failed)
   - `POST /api/public/verification/verify-code` (processed/failed)
 - Verification completion for directory flows: `contact_verification_completed` with `contact_method: 'email'|'phone'` emitted by:
   - `GET /api/public/leads/confirm` (email)
   - `POST /api/public/verification/verify-code` (phone)
  - **Phone-only gap tracking**: `patient_notify_skipped` with `reason: 'phone_only_no_email'` tracks when therapist accepts/declines but patient has no real email (temp placeholder). Monitor this to measure SMS notification need.

- Returning contact flow (EARTH-204):
  - `match_link_view` (GET /api/public/matches/:uuid)
  - `contact_message_sent` (POST /api/public/matches/:uuid/contact)
  - `contact_rate_limit_hit` (POST /api/public/matches/:uuid/contact when blocked)
  - Ops: `cron_executed`, `cron_completed`, `cron_failed`, `internal_alert_sent`.

### Cal.com Integration (EARTH-265)
- **Booking Events**: Emitted by `POST /api/public/cal/webhook`.
  - `cal_booking_created`
  - `cal_booking_rescheduled`
  - `cal_booking_cancelled`
- **Ops & Alerts**:
  - `cal_webhook_failure` — tracks database/validation issues during ingestion.
  - `cal_webhook_alert` — level `error` event emitted after 3+ consecutive failures for a booking ID.
  - `cal_webhook_signature_failed` — level `warn` if signature verification fails.

### Match page client events (EARTH-206)

- `match_page_view` — includes only `therapist_count` (no PII)
- `match_page_preferences_shown` — non‑PII flags summarizing the preference chips (issue present, online/in_person flags, urgent flag, modality_matters)

### Email‑first wizard (EARTH‑190)
- Track per‑screen if needed (`screen_viewed`, `screen_completed`, optional `field_change`).
- Completion emits `form_completed` (server). Ads fire server Enhanced Conversions and a minimal client gtag conversion.
- Deduplication by lead id: `orderId` (server) == `transaction_id` (client).

### Campaign attribution (server‑side)
- `campaign_source` inferred from referer path.
- `campaign_variant` A/B/C from `?v=`.
- **GCLID persistence**: `gclid` and `utm` parameters are stored in `localStorage` and synchronized across domains to ensure stable attribution even if the user navigates away and returns.
- Stored on patient leads; included in relevant events; do not duplicate into Vercel Analytics.


## Operations & Alerts (birdseye)
- New (2025‑09‑26): System error digest.
  - Route: `GET /api/admin/alerts/system?minutes=15`
  - Schedule: every 15m via Vercel Cron (see `vercel.json`).
  - Behavior: pulls `level=error` and `type=cron_failed` in the window, emails a summary to `LEADS_NOTIFY_EMAIL` (top sources/types + 5 latest). De‑dupes per window by writing `internal_alert_sent { kind: 'system_errors_digest', digest_key }`.
  - Auth: Vercel Cron header, `CRON_SECRET` (header or `?token=`), or admin cookie (manual run).
  - Manual test: introduce a safe error, then hit `/api/admin/alerts/system?minutes=60&token=<CRON_SECRET>`.

## Implementation patterns (short)
- Server tracking
```ts
await ServerAnalytics.trackEventFromRequest(req, {
  type: 'lead_submitted',
  source: 'api.leads',
  props: { lead_type: 'patient', city }
});
```
- Client interactions (fire‑and‑forget)
```ts
const trackEvent = (type: string, props = {}) => {
  const body = JSON.stringify({ type, ...props });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/public/events', body);
  else fetch('/api/public/events', { method: 'POST', body, keepalive: true });
};
```
- Error handling
```ts
try {
  // ...
} catch (e) {
  await logError('api.leads', e, { stage: 'validation' }, ip, ua);
  return NextResponse.json({ data: null, error: 'Invalid data' }, { status: 400 });
}
```

## Google Ads conversions (minimal & private)
- Server Enhanced Conversions: hashed email uploads on key events (e.g., `client_registration`, `therapist_registration`).
- **GCLID inclusion**: Payload now explicitly includes `gclid` for more robust server-side attribution matching.
- Client signal (minimal): single gtag conversion after Fragebogen completion to help Ads optimization; deduped by lead id.

- Consent Mode v2
  - Default denied (cookieless). If `NEXT_PUBLIC_COOKIES=true`, we enable conversion linker only after explicit consent.
- Env (production only): `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GAD_CONV_CLIENT`, plus server creds for Enhanced Conversions.

## Privacy & compliance
- No PII in `properties`. IPs hashed with `IP_HASH_SALT`.
- Public site remains cookie‑free by default; only necessary cookies in restricted areas (e.g., `/admin`).

## Expected funnel impact (EARTH-222)
- **Directory ordering**: Therapists with bookable time-slots now appear first. Expected to increase `contact_modal_opened` and `contact_verification_code_sent` rates by surfacing availability upfront. Monitor conversion from directory view to contact initiation.

## Maintenance
- Monthly review of event types; prune unused.
- Performance: logging is best‑effort, time‑boxed (~3s) and never blocks user flows.

## Code pointers
- Logger: `src/lib/logger.ts`
- Server analytics: `src/lib/server-analytics.ts`
- Public events API: `src/app/api/public/events/route.ts`
- Admin errors UI/API: `src/app/admin/errors/page.tsx`, `src/app/api/admin/errors/route.ts`
- Alerts digest (new): `src/app/api/admin/alerts/system/route.ts` and `vercel.json`
