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
    /ankommen-in-dir
      page.tsx
    /fuer-therapeuten
      page.tsx               # Therapist application (posts to /api/leads)
    /ueber-uns
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
    20250917134000_earth_146_email_double_opt_in.sql
/tests
  ...                         # Vitest suite (see tests/README.md)

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
- `EmailEntryForm` automatically forwards `?v=` to `/api/leads`.
- For test variants (B/C), `buildLandingMetadata` sets `robots: noindex, nofollow`.
