# Project Structure

```
/src
  /app
    page.tsx                # Homepage (UI only)
    /therapie-finden
      page.tsx              # Funnel page for prospective clients
    /fuer-therapeuten
      page.tsx              # Therapist CTA + application form (posts to /api/leads)
    /impressum
      page.tsx
    /agb
      page.tsx
    /datenschutz
      page.tsx
    /ueber-uns
      page.tsx
    /match/[uuid]
      page.tsx              # Magic link page (respond to match)
    /admin
      page.tsx              # Admin dashboard (protected by Edge middleware)
      /errors
        page.tsx            # Error log viewer (protected)
      /leads
        page.tsx            # Leads dashboard (protected)
      /matches
        page.tsx            # Matching workflow (protected)
      /login
        page.tsx            # Admin login UI
      /api
        /leads
          route.ts          # Admin leads list/search (protected)
        /therapists
          route.ts          # Admin therapists list/search (protected)
        /matches
          route.ts          # Admin match actions (protected)
        /stats
          route.ts          # Admin stats (protected)
        /errors
          route.ts          # Admin errors feed (protected)
    /api
      /leads
        route.ts            # Server-only form handler (service role)
      /events
        route.ts            # Server-side analytics endpoint
      /match/[uuid]/respond
        route.ts            # Therapist respond (accept/decline)
      /admin
        /login
          route.ts          # Admin login; sets scoped cookie
  /components
    TherapieFinderForm.tsx  # Patient form (posts to /api/leads)
    TherapistApplicationForm.tsx
    Header.tsx
    Footer.tsx
    CtaLink.tsx
    /ui                     # shadcn/ui primitives
      button.tsx
      input.tsx
      card.tsx
      select.tsx
      form.tsx
      label.tsx
  /lib
    supabase.ts             # Supabase clients (browser + server helpers)
    analytics.ts            # Server/client helpers for events
    logger.ts               # Unified logger → events table
    auth/
      adminSession.ts       # HMAC-signed admin token helpers
    google-ads.ts           # Enhanced Conversions (server-side)
    email/                  # Email templates and client

google_ads_api_scripts/      # Operational scripts for Google Ads EC
  reupload-leads.ts          # Backfill uploads (63-day window)

Notes:
- Components = UI only. Business logic lives in hooks/lib or API routes.
- Keep state near usage. Use context only when prop drilling >3 levels.
- API returns `{ data, error }` consistently.
- See also: [architecture](./architecture.md), [API docs](./api.md)
