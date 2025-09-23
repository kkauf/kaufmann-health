# Analytics & Tracking System

## Architecture Overview

**Dual Analytics Strategy:**
- **Vercel Analytics**: High-level funnel conversion rates, page performance (cookieless)
- **Supabase Events**: Granular business logic, user behavior, error tracking

**Key Principle**: No duplication - each system serves different analytical needs.

## Supabase Events System

### Database Schema
```sql
-- public.events table (unified logging)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  type text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  hashed_ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Implementation Patterns

**Server-side tracking (API routes):**
```typescript
import { ServerAnalytics } from '@/lib/server-analytics';

// In API routes
await ServerAnalytics.trackEventFromRequest(req, {
  type: 'lead_submitted',
  source: 'api.leads', 
  props: { lead_type: 'patient', city: city || null }
});
```

**Client-side tracking (components):**
```typescript
// Use navigator.sendBeacon for reliability
const trackEvent = (type: string, props = {}) => {
  const payload = { type, ...props };
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/events', JSON.stringify(payload));
  } else {
    fetch('/api/events', { 
      method: 'POST', 
      body: JSON.stringify(payload),
      keepalive: true 
    });
  }
};

// Usage in components
trackEvent('cta_click', { 
  eventId: 'fuer-therapeuten-hero-apply',
  location: 'hero'
});
```

### Event Type Standards

**Business Events:**
- `lead_submitted` - Form submissions (patient/therapist)
- `email_submitted` - Email-only capture started (EARTH-146)
- `email_confirmed` - Email confirmed via token (EARTH-146)
- `preferences_viewed` - Preferences page viewed after email confirmation (client-side ping via /api/events)
- `preferences_submitted` - Preferences saved via POST /api/leads/:id/preferences (server-side)
- `therapist_responded` - Match responses
- `match_created` - Manual matches by admin
- `cta_click` - Call-to-action interactions
- `form_submit` - Form completions
- `faq_open` - FAQ expansions

**System Events:**
- `error` - Application errors
- `email_sent` - Email delivery tracking
- `payment_completed` - Transaction events

**Event ID Naming Convention:**
`{page}-{location}-{action}[-{qualifier}]`

Examples:
- `fuer-therapeuten-hero-apply`
- `fuer-therapeuten-cta-apply`
- `fuer-therapeuten-faq-fee`

### Privacy & Compliance
- All IPs hashed with `IP_HASH_SALT`
- No PII in event properties
- GDPR-compliant by design

## Campaign Attribution (EARTH-145)

First‑party campaign fields are captured server‑side and stored on `public.people` for patient leads. They are also included in relevant events.

- `campaign_source`: inferred from Referer pathname
  - `/ankommen-in-dir` | `/wieder-lebendig` | default `/therapie-finden`
- `campaign_variant`: A/B variant from `?v=`
  - Precedence: Referer query param `?v=A|B` wins; fallback to the API URL’s `?v=`; default `A`.
  - Sanitized to `A | B` only.
- `landing_page`: Referer pathname only (e.g. `/wieder-lebendig`), not the full URL.

Persistence & events
- Email‑only flow (EARTH‑146): persisted on `people` at insert (`status='pre_confirmation'`) and included in `email_submitted`.
- Legacy patient flow (flag off): persisted on `people` at insert (`status='new'`) and included in `lead_submitted`.
- Therapist flow: not persisted (no columns) but included in `lead_submitted` event props.
- We continue to include UTM/referrer via `ServerAnalytics.parseAttributionFromRequest` for broader marketing reporting—do not duplicate into Vercel Analytics.

### Admin Dashboard Campaign Reporting (EARTH-153)

The Admin dashboard surfaces two campaign reporting cards based on first‑party attribution stored on `public.people` (patient leads only):

- Summary per `(campaign_source, campaign_variant)` over the selected window (default last 7 days)
- Daily breakdown by `YYYY-MM-DD` and `(campaign_source, campaign_variant)`

Metrics:
- `leads`: Count of `people(type='patient')` rows with a non‑null `campaign_source` in the window
- `confirmed`: Leads with `status != 'pre_confirmation'` (aligned with email double opt‑in)
- `confirmation_rate`: `confirmed / leads * 100` (1 decimal)

Notes:
- Self‑pay intent is tracked via events (`self_pay_confirmed` / `self_pay_declined`) and is presented separately in the "Lead‑Qualität" card. It is not mixed into the campaign aggregates.

## Vercel Analytics System

### Implementation
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/next';

<Analytics 
  beforeSend={(event) => {
    // Redact sensitive URLs
    if (event.url.includes('/match/') || event.url.includes('/admin/')) {
      return null;
    }
    return event;
  }}
/>
```

### Custom Events (High-Level Only)
```typescript
import { track } from '@vercel/analytics';

// Major conversion points only
track('Lead Started');           // Form opened
track('Lead Submitted');         // Form completed  
track('Therapist Applied');      // Application started
track('Match Created');          // Manual match made
```

### When to Use Each System

**Use Vercel Analytics for:**
- Page view analysis
- High-level conversion funnel
- Performance monitoring
- A/B testing page variants
- Geographic insights (cookieless)

**Use Supabase Events for:**
- Business logic events
- User behavior within features
- Error tracking and debugging
- Operational monitoring
- Detailed conversion attribution

## Implementation Guidelines for New Features

### 1. Planning Phase
- Identify if feature needs tracking
- Determine if it's high-level (Vercel) or detailed (Supabase)
- Plan event naming following conventions

### 2. Implementation
- Add Supabase events for business logic
- Add Vercel events ONLY for major conversions
- Test both systems work correctly

### 3. Documentation
- Update this file with new event types
- Document any new event ID patterns
- Add to README if it affects deployment

## Common Patterns

**Form Submissions:**
```typescript
// Supabase: Detailed form tracking
await ServerAnalytics.trackEventFromRequest(req, {
  type: 'form_submit',
  source: 'api.therapist-signup',
  props: { 
    form_type: 'therapist_application',
    specializations_count: specializations.length 
  }
});

// Vercel: High-level conversion only
track('Therapist Applied');
```

**Error Handling:**
```typescript
// Always use Supabase for errors
catch (e) {
  await logError('api.leads', e, { 
    stage: 'validation', 
    form_data: safeFormData 
  }, ip, ua);
  return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
}
```

**User Actions:**
```typescript
// Client-side: Detailed interaction tracking (Supabase)
onClick={() => {
  trackEvent('cta_click', { 
    eventId: 'therapist-profile-contact',
    therapist_id: therapist.id 
  });
}}

// Major milestone reached (Vercel)
track('Match Accepted');
```

## Monitoring & Maintenance

- **Supabase**: Query events table for business insights
- **Vercel**: Use dashboard for funnel analysis
- **Regular Review**: Monthly check of event types and cleanup unused ones
- **Performance**: Events are fire-and-forget, never block user experience

## Migration Notes

When adding new tracking:
1. Follow existing patterns from this doc
2. Test in development first
3. Deploy incrementally
4. Monitor for 24h after deployment
5. Update this documentation

## Profile Completion Funnel (EARTH-73)

__Why__: Profile completion touches both documents and profile data. Tracking server-side keeps the public site cookie-free and centralizes observability in one place without duplicating high-level analytics.

__Server Events__ (Supabase):
- `therapist_documents_uploaded` — emitted by `POST /api/therapists/:id/documents`
  - props: `license: boolean`, `specialization_count: number`, `profile_photo: boolean`, `approach_text: boolean`
- `email_attempted` — emitted around upload confirmation, approval, rejection, and reminder sends
- Optional additions (if needed later): `therapist_profile_approved`, `therapist_profile_rejected`

### Business Opportunities (EARTH-124)

- `business_opportunity_logged` — emitted by `POST /admin/api/matches` when selected therapists don't perfectly match a patient's preferences.
  - props: `{ patient_id: string, reasons: ('gender'|'location'|'modality')[] }`
  - Also persisted in `public.business_opportunities` for monthly summaries.

__Vercel Analytics__:
- No additional events; keep high-level only. Existing page-level conversions are sufficient.

__Queries__: Use the `events` table to derive:
- Signup → Document upload rate
- Document upload → Approval rate
- Signup → Profile completion rate (photo + approach)
- Completion → Activation rate (approval with `photo_url`)

### Google Ads Configuration Notes (EARTH-174)

- Create two website conversion actions in Google Ads UI:
  - `Client Registration` (alias: `client_registration`) — category “Submit lead form”; Primary; Count = One; Data-driven attribution if eligible; include in “Conversions”. Enable Enhanced Conversions for web (first-party data). Use the same action for both client-side gtag and server-side enhanced conversions. Deduplication: `transaction_id` (gtag) == `orderId` (server) == lead id.
  - `Therapist Registration` (alias: `therapist_registration`) — category “Sign-up” or “Submit lead form”; Secondary by default (exclude from “Conversions” if it shouldn’t drive bidding in patient campaigns); Count = One; Data-driven attribution if eligible; Enhanced Conversions enabled (server-side only).
- Values: default to €10 (client) and €25 (therapist) to match server. The server also sends values.
- Windows: Click-through 30 days; View-through 1 day; Cross-device enabled; adjust to your preference.
- Consent Mode: already implemented; gtag loads post-consent when `NEXT_PUBLIC_COOKIES=true`, else cookieless mode.

## Minimal Google Ads Conversion (EARTH-132)

__Why__: Google Ads' optimization algorithms require a client-side conversion signal to learn which clicks lead to conversions. Our server-side Enhanced Conversions remain the source of truth, but without a browser-side ping Google cannot attribute conversions to ad clicks, hurting optimization and budget scaling.

__What__: A single, minimal client-side `gtag` conversion event fired only after successful preferences submission on `PreferencesForm` (the moment a patient lead becomes active: status transitions to `new`). This aligns exactly with server-side Enhanced Conversions for 1:1 accuracy.

__Privacy__: Consent Mode defaults to `denied` for all storages. No cookies/tracking, no PII, and no cross-site profiling. This yields a cookieless conversion signal suitable for model-based attribution.

__Implementation__:
- `app/layout.tsx`: inject Google Ads tag with Consent Mode defaults (all denied). Load only when `NEXT_PUBLIC_GOOGLE_ADS_ID` is set.
- `components/PreferencesForm.tsx`: after successful submit (HTTP 200 from `POST /api/leads/:id/preferences`), call
  `gtag('event', 'conversion', { send_to: "AW-XXXX/YYYY", value: 10, currency: 'EUR', transaction_id: <leadId> })` guarded by environment checks, with per‑lead dedupe via `sessionStorage` and `localStorage`.

__Environment__:
```
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_CONVERSION_LABEL=XXXXXXXXXXXXX
NEXT_PUBLIC_COOKIES=false | true
```

__Notes__:
- This complements server-side Enhanced Conversions; both use the same value (10 EUR) and the same identifier (`transaction_id` == `orderId` == lead id) for deduplication.
- Keep disabled in non-production environments by leaving env vars unset.

## Email Double Opt-in (EARTH-146)

**Why:** Improve deliverability and list quality by requiring email confirmation before treating a patient lead as active.

**Server Events:**
- `email_submitted` — emitted by `POST /api/leads` in the email‑only path with props `{ campaign_source, campaign_variant, landing_page, requires_confirmation: true }`.
- `email_confirmed` — emitted by `GET /api/leads/confirm` with props `{ campaign_source, campaign_variant, landing_page, elapsed_seconds }`.

**Enhanced Conversions timing:**
- In email-only mode, server-side Google Ads Enhanced Conversions (`client_registration`) are sent when preferences are submitted (status becomes `new`) via `POST /api/leads/:id/preferences`. The confirmation endpoint (`GET /api/leads/confirm`) only sets status to `email_confirmed` and redirects to preferences.
- In legacy mode (flag off), they continue to fire after the initial patient insert.

__Therapists (EARTH-174)__:
- We only consider therapists “qualified” after documents are submitted.
- Server-side Enhanced Conversion `therapist_registration` is fired by `POST /api/therapists/:id/documents` after successful upload/merge of required docs.
- There is no client-side gtag for therapist signup; only server-side Enhanced Conversion is used.

**Vercel Analytics:**
- Do not duplicate `email_submitted`/`email_confirmed` in Vercel Analytics. Keep Vercel for high-level milestones only.

## Cookie Toggle for Google Ads Linking (EARTH-133)

__Goal__: Allow switching between a strictly cookie-free setup and a slightly more involved setup that improves Google Ads attribution quality.

__Environment__:
```
NEXT_PUBLIC_COOKIES=false | true
```

__Behavior__:
- When `false` (default):
  - Consent Mode defaults to denied for all storages.
  - gtag configured with `url_passthrough: true` (no cookies).
  - Public UI shows “Keine Cookies” badges.
- When `true`:
  - Consent Mode grants only `ad_storage`; `ad_user_data`, `analytics_storage`, and `ad_personalization` remain denied.
  - gtag configured with both `conversion_linker: true` and `url_passthrough: true` to maximize baseline linking before consent and smoothly upgrade to cookies after acceptance. Cookies (conversion linker) are only set after explicit consent updates `ad_storage` to `granted`.
  - Public UI updates badges to privacy‑friendly messaging (no analytics cookies).

__Notes__:
- Vercel Analytics remains cookieless in both modes.
- We do not enable analytics cookies in either mode.

## Consent Mode v2 & Cookie Settings (EARTH-175)

__Why__: Transparent cookie handling and GDPR/TDDDG compliance when introducing client-side Google Ads tracking. Maintain cookieless defaults while allowing explicit opt-in to conversion linking.

__What changed__:
- Cookie banner is shown when `NEXT_PUBLIC_COOKIES=true` and `NEXT_PUBLIC_GOOGLE_ADS_ID` is configured. `gtag` library loads only after explicit consent.
- After acceptance, we (re)apply `gtag('config', <AW-ID>, { conversion_linker: true, url_passthrough: true })` and keep all personalization storages denied.
- Footer now includes a “Cookie-Einstellungen” control that re-opens the banner:

```ts
// Footer → re-open banner on demand
window.dispatchEvent(new Event('open-cookie-settings'));
```

- The banner listens for `open-cookie-settings` and shows again for consent changes. On rejection or withdrawal, Consent Mode is updated to `denied` for all storages and `conversion_linker` is disabled to prevent cookie operation.
- Datenschutzerklärung updated: cookie types and legal bases, Google Ads cookie retention, Consent Mode v2 behavior, Enhanced Conversions (server-side), and “Datenübermittlung in die USA”. Version bumped to 2.0 (dynamic date displayed).
- Forms: `privacy_version` updated to `2025-09-01.v2`. Keep any future forms in sync with the Datenschutz version.

__Environment__:
```
NEXT_PUBLIC_COOKIES=false | true
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_CONVERSION_LABEL=XXXXXXXXXXXXX
```

__Code pointers__:
- `src/app/layout.tsx` — inline `gtag` stub with Consent Mode defaults (all denied).
- `src/components/GtagLoader.tsx` — loads `gtag` post-consent when cookies are enabled; always loads in cookieless mode.
- `src/components/CookieBanner.tsx` — re-open support via `open-cookie-settings`; applies consent grant/deny updates (including disabling `conversion_linker` on deny) and dispatches `ga-consent-accepted`.
- `src/components/Footer.tsx` — “Cookie-Einstellungen” link triggers the re-open event when cookies are enabled.