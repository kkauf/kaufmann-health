# Project Structure

```
/src
  /app
    layout.tsx
    globals.css
    page.tsx                 # Homepage (UI only)
    sitemap.ts
    robots.ts
    /therapie-finden
      page.tsx               # Funnel (Klient:in)
    /wieder-lebendig
      page.tsx
      Hero.tsx
    /ankommen-in-dir
      page.tsx
      Hero.tsx
    /fuer-therapeuten
      page.tsx               # Therapist application (posts to /api/leads)
    /ueber-uns
      page.tsx
    /agb
      page.tsx
    /impressum
      page.tsx
    /datenschutz
      page.tsx
    /therapist-terms
      page.tsx
    /preferences
      page.tsx
    /therapists
      /complete-profile
        /[id]
          page.tsx
          ProfileForm.tsx
      /upload-documents
        /[id]
          page.tsx
          UploadForm.tsx
    /auswahl-bestaetigt
      page.tsx               # Friendly selection confirmation page
    /confirm
      page.tsx               # Public email confirmation status page
    /feedback-received
      page.tsx
    /match/[uuid]
      page.tsx               # Magic link page (respond to match)
      Actions.tsx
    /admin
      layout.tsx
      page.tsx               # Admin dashboard (protected via middleware)
      AdminNav.tsx
      AdminStats.tsx
      /errors
        page.tsx             # Error log viewer (protected)
      /leads
        page.tsx             # Leads dashboard (protected)
      /matches
        page.tsx             # Matching workflow (protected)
      /therapists
        page.tsx             # Therapists management (protected)
      /login
        page.tsx             # Admin login UI
      /api
        /ads
          /monitor
            route.ts
        /errors
          route.ts
        /leads
          route.ts
          /[id]
            route.ts
        /matches
          route.ts
          /email
            route.ts
          /selection-reminders
            route.ts
          /therapist-action-reminders
            route.ts
          /blocker-survey
            route.ts
        /stats
          route.ts
        /therapists
          route.ts
          /reminders
            route.ts
          /[id]
            route.ts
            /documents
              route.ts
            /photo
              route.ts
            /reminder
              route.ts
    /api
      /admin
        /leads
          route.ts
        /login
          route.ts
      /events
        route.ts             # Server-side analytics endpoint
      /feedback
        route.ts             # One-click feedback (session blockers)
      /images
        /therapist-profiles
          /[...path]
            route.ts         # Image proxy for email-safe photos
      /leads
        route.ts             # Server-only form handler (service role)
        /confirm
          route.ts
        /resend-confirmation
          route.ts
        /[id]
          /preferences
            route.ts
      /match
        /[uuid]
          /respond
            route.ts
          /select
            route.ts
      /therapists
        /opt-out
          route.ts
        /[id]
          /documents
            route.ts
          /profile
            route.ts
  /components
    Header.tsx
    Footer.tsx
    AnalyticsProvider.tsx
    PageAnalytics.tsx
    ResendConfirmationForm.tsx
    ConfirmSuccessFallback.tsx
    EmailEntryForm.tsx
    TherapistApplicationForm.tsx
    TherapistPreview.tsx
    PreferencesForm.tsx
    PreferencesViewTracker.tsx
    CtaLink.tsx
    CheckList.tsx
    CookieBanner.tsx
    NoCookieToast.tsx
    ExitIntentModal.tsx
    FaqAccordion.tsx
    FloatingWhatsApp.tsx
    RevealContainer.tsx
    SectionViewTracker.tsx
    TherapyModalityExplanations.tsx
    VariantGate.tsx
    WhatToExpectSection.tsx
    /ui                      # shadcn/ui primitives
      avatar.tsx
      badge.tsx
      button.tsx
      card.tsx
      form.tsx
      input.tsx
      label.tsx
      select.tsx
  /content
    /agreements
    /therapist-terms
  /hooks
    useMatchMismatches.ts
  /lib
    analytics.ts
    attribution.ts
    server-analytics.ts
    logger.ts
    rate-limit.ts
    google-ads.ts          # Server-side Enhanced Conversions client
    supabase.ts
    supabase-server.ts
    config.ts
    constants.ts
    signed-links.ts
    utils.ts
    /auth
      adminSession.ts
    /email
      client.ts
      layout.ts
      internalNotification.ts
      types.ts
      /components
        therapistPreview.ts
      /templates
        ...
    /leads
      ...
/google_ads_api_scripts/       # Operational scripts for Google Ads
  README.md
  campaign-config.ts
  create-week38-campaigns.ts
  diagnose_account_access.ts
  generate_refresh_token.py
  get-conversion-actions.ts
  monitor-campaigns.ts         # Monitor & auto-pause underperformers
  reupload-leads.ts            # Backfill uploads (63-day window)
  test-access.ts               # Access test (auth + basic ops)
  test-google-ads.ts
/scripts
  send-therapist-reminders.ts
/supabase
  /migrations
    20250908181148_remote_schema.sql
    20250908184500_add_therapists_metadata.sql
    20250908192000_add_therapist_profile_buckets.sql
    20250910134500_add_business_opportunities.sql
    20250911143000_add_matched_lead_status.sql
    20250916140000_add_session_blockers.sql
    20250917134000_earth_146_email_double_opt_in.sql
/tests
  ...                         # Vitest suite (see tests/README.md)
```
Notes:
- Components = UI only. Business logic lives in hooks/lib or API routes.
- Keep state near usage. Use context only when prop drilling >3 levels.
- API returns `{ data, error }` consistently.
- See also: [architecture](./architecture.md), [API docs](./api.md)
