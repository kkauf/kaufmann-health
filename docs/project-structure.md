# Project Structure

```
/src
  /app                      # Pages only (UI + layout)
    layout.tsx
    globals.css
    /(public)
      page.tsx              # Homepage
      therapie-finden/page.tsx
      wieder-lebendig/page.tsx
      ankommen-in-dir/page.tsx
      fuer-therapeuten/page.tsx
      ueber-uns/page.tsx
      datenschutz/page.tsx
      impressum/page.tsx
      confirm/page.tsx
      preferences/page.tsx   # Email-first step 2 (city/consent)
      fragebogen/            # 6-screen questionnaire (EARTH-190)
    /therapists
      complete-profile/[id]/page.tsx
      therapists/upload-documents/[id]/page.tsx
    /auswahl-bestaetigt/page.tsx
    /api
      /public
        events/route.ts                      # Server-side analytics ingest
        leads/route.ts                       # Email-first intake (patients + therapists)
        leads/[id]/preferences/route.ts      # Patient confirmation → status `new`
        therapists/[id]/documents/route.ts   # Therapist docs + Enhanced Conversions
      /admin
        ...                                  # Stats, reminders, matching, cron endpoints
      /images
        therapist-profiles/[...path]/route.ts
  /components               # UI primitives + shared components
  /features                 # Domain-specific UI + hooks (e.g., leads, landing)
  /lib                      # Shared utilities (Supabase clients, analytics, config)
  /content                  # Markdown/HTML content blocks
/tests
  ...                       # Vitest suite (see tests/README.md)
/supabase
  /migrations               # Database schema

```

## Landing Kit (Reusable Landing Page Blocks)

Locations:
- `src/features/landing/components/` — UI-only reusable sections
- `src/features/landing/lib/therapists.ts` — server helpers for therapist data (Supabase)
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
