# Project Structure

```
/src
  /app                      # Pages only (UI + layout) – flat structure, no route groups
    layout.tsx
    globals.css
    page.tsx                # Homepage
    /start                  # Alternative entry point for email-first flow
    /fragebogen             # 6-screen questionnaire (EARTH-190) – primary intake
    /therapie-finden        # Main matching service page
    /wieder-lebendig        # Campaign landing page
    /ankommen-in-dir        # Campaign landing page
    /fuer-therapeuten       # Therapist recruitment page
    /ueber-uns              # About us
    /vermittlung            # Matching service explanation
    /therapie               # Therapy modality pages
      /somatic-experiencing
      /[other-modalities]
    /datenschutz            # Privacy policy
    /impressum              # Imprint
    /agb                    # Terms of service
    /confirm                # Email confirmation (legacy, redirects to /fragebogen)
    /preferences            # Preferences page (legacy, redirects to /fragebogen/confirmed)
    /feedback-received      # Feedback confirmation
    /auswahl-bestaetigt     # Patient selection confirmation
    /match/[uuid]           # Therapist match acceptance page
    /matches                # Match listing
    /therapists             # Therapist onboarding
      /complete-profile/[id]
      /upload-documents/[id]
      /[2-more-routes]
    /therapeuten            # German therapist route (alias/redirect?)
    /therapist-terms        # Therapist terms content
    /admin                  # Admin pages
      page.tsx              # Admin dashboard
      layout.tsx
      /login
      /leads
      /matches
      /therapists
      /errors
    /api
      /public               # Public API routes
        /events             # Server-side analytics ingest
        /leads              # Email-first intake (patients + therapists)
        /form-sessions      # Fragebogen session autosave
        /contact            # Contact form submission
        /feedback           # Feedback submission
        /verification       # SMS/phone verification (send-code, verify-code)
        /match              # Match acceptance flow
        /matches            # Match queries
        /session            # Session management
        /therapists         # Therapist endpoints (profile, documents, photo)
        /images             # Image proxy (therapist-profiles)
      /admin                # Admin API routes
        /login              # Admin authentication
        /stats              # Dashboard stats + campaign analytics
        /leads              # Lead management (PATCH status)
        /matches            # Match creation, outreach, reminders
        /therapists         # Therapist management, verification, reminders
        /errors             # Error log queries
        /alerts             # Alert system (new leads, action reminders)
        /ads                # Google Ads reporting/exports
      /events               # Analytics (may duplicate /public/events)
      /images               # Backward-compat alias for /public/images
      /internal             # Internal endpoints
      /[...catchall]        # Catch-all handler
  /components               # Shared UI primitives (ui/, analytics, layout)
    /ui                     # shadcn/ui components (Avatar, Badge, Button, Card, etc.)
    AnalyticsProvider.tsx
    CheckList.tsx
    CookieBanner.tsx
    CtaLink.tsx
    ExitIntentModal.tsx
    FaqAccordion.tsx
    FloatingWhatsApp.tsx
    Footer.tsx
    GtagLoader.tsx
    Header.tsx
    NoCookieToast.tsx
    PageAnalytics.tsx
    RevealContainer.tsx
    SectionViewTracker.tsx
    TherapistPreview.tsx
    TherapyModalityExplanations.tsx
    VariantGate.tsx
    WhatToExpectSection.tsx
  /features                 # Domain-specific UI + hooks
    /leads                  # Lead conversion domain (#1 business goal)
      /components           # EmailEntryForm, SignupWizard, screens, etc.
      /lib                  # validation, handlers, types, match logic, rateLimit
      copy.ts
    /landing                # Reusable landing page blocks
      /components           # LandingHero, ProcessSteps, TherapistTeaserSection, etc.
      /lib                  # therapists.ts (server helpers)
    /matches                # Match flow components
      /components
    /therapists             # Therapist onboarding/management UI
      /components           # 5 components (profile forms, document upload, etc.)
    /therapy                # Therapy modality content/components
      /components
    /admin                  # Admin domain
      /components           # AdminNav, AdminStats
  /lib                      # Shared utilities (Supabase, analytics, email, auth, config)
  /content                  # Markdown/HTML content blocks
/tests
  ...                       # Vitest suite (see tests/README.md)
/supabase
  /migrations               # Database schema

```

## API Routes Overview

All API routes live under `/app/api/` with three main categories:

### Public APIs (`/api/public/`)
User-facing endpoints (no authentication required unless specified):

- **`/events`** — Server-side analytics ingest
- **`/leads`** — Email-first patient/therapist intake
  - `POST /leads` — Create new lead
  - `GET /leads/confirm` — Email confirmation
  - `POST /leads/resend-confirmation` — Resend confirmation email
  - `POST /leads/[id]/form-completed` — Fragebogen completion
- **`/form-sessions`** — Fragebogen autosave
  - `POST /form-sessions` — Create session
  - `GET/PATCH /form-sessions/[id]` — Get/update session
- **`/verification`** — SMS/phone verification
  - `POST /verification/send-code` — Send verification code
  - `POST /verification/verify-code` — Verify code
- **`/match`** — Match acceptance flow
  - `GET/POST /match/[uuid]/select` — Patient selects therapist
  - `POST /match/[uuid]/respond` — Therapist accepts/declines
- **`/matches`** — Match queries
- **`/therapists`** — Therapist endpoints
  - `POST /therapists/[id]/profile` — Update profile
  - `POST /therapists/[id]/documents` — Upload documents
  - `POST /therapists/[id]/photo` — Upload photo
- **`/contact`** — Contact form submission
- **`/feedback`** — Feedback submission
- **`/session`** — Session management
- **`/images/therapist-profiles/[...path]`** — Image proxy

### Admin APIs (`/api/admin/`)
Authenticated endpoints (requires admin session cookie):

- **`/login`** — Admin authentication
- **`/stats`** — Dashboard analytics (totals, funnels, campaigns)
- **`/leads/[id]`** — Lead status management (PATCH)
- **`/matches`** — Match management
  - `POST /matches` — Create match(es)
  - `POST /matches/email` — Send outreach/selection emails
  - `GET /matches/therapist-action-reminders` — Therapist action reminders (cron)
- **`/leads`** — Lead management & email cadence
  - `GET /leads/rich-therapist-email` — Day 1 personalized therapist email (cron)
  - `GET /leads/selection-nudge` — Day 5 reassurance email (cron)
  - `GET /leads/feedback-request` — Day 10 feedback collection (cron)
- **`/emails`** — Email utilities
  - `GET /emails/preview` — QA preview/send email templates
- **`/therapists`** — Therapist management
  - `GET /therapists` — List therapists
  - `GET /therapists/[id]` — Get therapist details
  - `PATCH /therapists/[id]` — Update therapist (verification, profile approval)
  - `POST /therapists/[id]/photo` — Admin photo upload
  - `POST /therapists/[id]/reminder` — Send single reminder
  - `GET/POST /therapists/reminders` — Batch reminders (cron)
- **`/errors`** — Error log queries
- **`/alerts`** — Alert system
  - `GET /alerts/new-leads` — New lead notifications
- **`/ads`** — Google Ads reporting/exports

### Other APIs
- **`/events`** — Analytics (may duplicate `/public/events`)
- **`/images`** — Backward-compat alias for `/public/images`
- **`/internal`** — Internal endpoints
- **`/[...catchall]`** — Catch-all handler

## Leads Domain (Lead Conversion Flow)

**Location**: `src/features/leads/`

All lead submission and conversion logic is consolidated here. This is the #1 business goal domain.

**Structure**:
- `components/` — Form components for lead capture
  - `EmailEntryForm.tsx` (alias: ContactEntryForm) — Device-aware email/phone entry
  - `TherapistApplicationForm.tsx` — Therapist registration form
  - `ResendConfirmationForm.tsx` — Resend email confirmation
  - `SignupWizard.tsx` — Multi-step patient intake wizard
  - `screens/` — Wizard screen components (Screen1-5)
- `lib/` — Lead processing utilities
  - `handlers.ts` — `handleTherapistLead` for therapist submission
  - `rateLimit.ts` — `isIpRateLimited` for rate limiting
  - `validation.ts` — `sanitize`, `normalizeSpecializations`, `hashIP`, `getEmailError`
  - `types.ts` — `LeadType`, `LeadPayload`, `HandlerContext`
  - `match.ts` — `computeMismatches` for therapist-patient matching
- `copy.ts` — Lead-specific copy text

**Usage**:
- Import forms: `import { EmailEntryForm } from '@/features/leads/components/EmailEntryForm'`
- Import utilities: `import { getEmailError } from '@/features/leads/lib/validation'`
- API routes use handlers from `@/features/leads/lib/handlers`

## Landing Kit (Reusable Landing Page Blocks)

**Location**: `src/features/landing/`

UI-only reusable sections for landing pages.

**Structure**:
- `components/` — Reusable landing page sections
- `lib/therapists.ts` — Server helpers for therapist data (Supabase)
- `src/lib/seo.ts` — SEO helpers (metadata + JSON-LD)

Component index (what to use and when):
- **LandingHero** (`LandingHero.tsx`)
  - Use for top-of-page: title, subtitle, trust strip, optional modality logos, embedded `EmailEntryForm`.
  - Props: `title`, `subtitle?`, `trustItems?`, `showModalityLogos?`, `defaultSessionPreference? ('online'|'in_person')`, `ctaPill?`, `analyticsQualifier?`.
- **ModalityLogoStrip** (`ModalityLogoStrip.tsx`)
  - Use to show NARM/Hakomi/SE/Core logos under hero copy.
- **TherapistTeaserSection** (`TherapistTeaserSection.tsx`)
  - Use to display a grid of real `TherapistPreview` cards.
  - Props: `ids?` (curated) or `filters? { city?, accepting_new? }`, `limit?`, `title?`, `subtitle?`.
- **PrivacySelfPaySection** (`PrivacySelfPaySection.tsx`)
  - Use for “Therapie ohne Krankenkasseneintrag”. Handles Variant A/B/C headings via `VariantGate`.
- **ProcessSteps** (`ProcessSteps.tsx`)
  - Use for the 3-step card flow. Props: `items: { icon, step, title, description? }[]`.
- **RecognitionSection** (`RecognitionSection.tsx`)
  - Use for “Erkennst du dich wieder?” lists. Thin wrapper around `CheckList` with a heading.
- **MethodComparison** (`MethodComparison.tsx`)
  - Use for two-column “Gesprächstherapie” vs “+ Körperorientiert”. Pass string arrays.
- **InvestmentSection** (`InvestmentSection.tsx`)
  - Use for pricing. `mode="tiers"` (cards) or `mode="note"` (bullets). CTA via `CtaLink`.
- **FinalCtaSection** (`FinalCtaSection.tsx`)
  - Use for final call-to-action targeting `#top-form`. Optional scarcity via `VariantGate`.

Server utilities:
- **getTherapistsByIds(ids)** — fetch curated therapist list.
- **getTherapistsForLanding({ city?, accepting_new?, limit? })** — fetch by filters.
- **mapTherapistRow(row)** — centralizes `metadata.profile.approach_text` mapping.

SEO helpers:
- **buildLandingMetadata({ baseUrl, path, title, description, searchParams, openGraph?, twitter? })** — variant-aware robots (B/C = noindex).
- **buildFaqJsonLd(items)** — FAQPage schema.
- **buildLocalBusinessJsonLd({ baseUrl, path, areaServed })** — LocalBusiness schema.

Quick recipes:
- **New landing page skeleton**
  1. In `/app/<slug>/page.tsx`, import from `src/features/landing/components/`.
  2. Add `<LandingHero title=... subtitle=... showModalityLogos />`.
  3. Add `<TherapistTeaserSection ids=[...] />` or `filters={{ city: 'Berlin' }}`.
  4. Add `<RecognitionSection items={[ ... ]} />`, `<MethodComparison ... />` as needed.
  5. Add `<PrivacySelfPaySection />`, `<ProcessSteps items={[ ... ]} />`.
  6. Add `<InvestmentSection mode="note" />` or `mode="tiers"`.
  7. Add `<FinalCtaSection targetId="#top-form" />`.
  8. Use SEO helpers for `export const metadata` and JSON-LD where relevant.

Notes for A/B/C variants:
- Use existing `VariantGate` inside page copy where variants diverge.
- `EmailEntryForm` automatically forwards `?v=` to `/api/public/leads`.
- For test variants (B/C), `buildLandingMetadata` sets `robots: noindex, nofollow`.

## Matches Domain (Patient Selection Flow)

**Location**: `src/features/matches/`

Components for the patient selection and match acceptance flow.

**Structure**:
- `components/` — Match flow UI components

**Related Routes**:
- Pages: `/app/match/[uuid]`, `/app/matches`, `/app/auswahl-bestaetigt`
- APIs: `/app/api/public/match`, `/app/api/public/matches`, `/app/api/admin/matches`

## Therapists Domain (Therapist Onboarding)

**Location**: `src/features/therapists/`

Therapist-specific components for profile completion, document upload, and verification.

**Structure**:
- `components/` — 5 therapist UI components (profile forms, document upload, etc.)

**Related Routes**:
- Pages: `/app/therapists/complete-profile/[id]`, `/app/therapists/upload-documents/[id]`
- APIs: `/app/api/public/therapists`, `/app/api/admin/therapists`

## Therapy Domain (Modality Content)

**Location**: `src/features/therapy/`

Therapy modality-specific content and components.

**Structure**:
- `components/` — Therapy modality UI components

**Related Routes**:
- Pages: `/app/therapie/somatic-experiencing`, etc.

## Shared Components

**Location**: `src/components/`

Cross-cutting UI components used throughout the application.

**Key Components**:
- **UI primitives** (`/ui/`) — shadcn/ui components (Avatar, Badge, Button, Card, Input, etc.)
- **Analytics**:
  - `AnalyticsProvider.tsx` — Vercel Analytics wrapper
  - `PageAnalytics.tsx` — Page view and scroll depth tracking
  - `SectionViewTracker.tsx` — Section visibility tracking
- **Layout & Navigation**:
  - `Header.tsx` — Main site header
  - `Footer.tsx` — Main site footer
  - `FloatingWhatsApp.tsx` — Floating WhatsApp button
- **Forms & Interaction**:
  - `CtaLink.tsx` — CTA link with click tracking
  - `FaqAccordion.tsx` — FAQ accordion with analytics
  - `TherapistPreview.tsx` — Therapist card (email/web/admin variants)
- **Marketing & UX**:
  - `CheckList.tsx` — Animated checklist (pain points, recognition)
  - `RevealContainer.tsx` — Scroll-in animation wrapper
  - `WhatToExpectSection.tsx` — "What to Expect" reusable section
  - `ExitIntentModal.tsx` — Exit intent capture
- **Consent & Compliance**:
  - `CookieBanner.tsx` — Cookie consent (NEXT_PUBLIC_COOKIES gate)
  - `GtagLoader.tsx` — Consent-gated gtag loading
  - `NoCookieToast.tsx` — Cookie-free notice
- **Content**:
  - `TherapyModalityExplanations.tsx` — Modality descriptions
  - `VariantGate.tsx` — A/B/C variant gating

**Usage**:
```tsx
import { CtaLink } from '@/components/CtaLink'
import { Button } from '@/components/ui/button'
import { TherapistPreview } from '@/components/TherapistPreview'
```

## Admin Domain (Management & Monitoring)

**Location**: `src/features/admin/`

Admin functionality is cleanly separated between pages, APIs, and components.

**Structure**:
- `components/` — Admin UI components
  - `AdminNav.tsx` — Navigation bar for admin pages
  - `AdminStats.tsx` — Dashboard statistics and analytics display

**Usage**:
- Import components: `import AdminNav from '@/features/admin/components/AdminNav'`
- Admin pages: Located in `/app/admin` (pages only)
- Admin APIs: Located in `/app/api/admin` (backend logic)

**Architecture**:
- **Pages**: `/app/admin` — All admin page routes (dashboard, leads, matches, therapists, errors)
- **APIs**: `/app/api/admin` — All admin backend endpoints (stats, reminders, matching, cron, alerts, ads)
- **Components**: `/features/admin/components` — Reusable admin UI components

**Key Admin APIs**:
- `/api/admin/stats` — Dashboard analytics (totals, funnels, campaigns)
- `/api/admin/leads/[id]` — Lead status management
- `/api/admin/matches` — Match creation, outreach, selection emails
- `/api/admin/therapists` — Therapist verification, reminders
- `/api/admin/alerts` — New lead alerts, action reminders
- `/api/admin/ads` — Google Ads reporting/exports
