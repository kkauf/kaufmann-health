# Design Language (Kaufmann Health)

This doc captures the visual patterns that save debugging time and keep the UI consistent. Our aesthetic is **premium, polished, and confident** — subtle depth, sophisticated gradients, and attention to detail throughout.

## Design Philosophy

**More Premium, More Polish**
- Add depth through layered gradients, soft shadows, and subtle blur effects
- Use larger, bolder typography with generous spacing
- Enhance interactive elements with smooth hover states and micro-animations
- CTAs get maximum impact; other sections maintain elegance without overwhelming

## Containers

- **Enhanced Gradient Panel** (default section wrapper)
  - Use for heros and key sections.
  - Classes:
    - Container: `relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12`
  - Enhanced radial overlays:
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />`
  - Optional decorative blur (for extra depth):
    - `<div class="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />`
  - Typography:
    - Section heading: `text-2xl sm:text-3xl font-bold tracking-tight text-gray-900`
    - Body text: `text-base leading-relaxed text-gray-700`

- **Elevated Plain Panel** (neutral sections with subtle elevation)
  - Use for content sections that need separation without heavy gradients.
  - Classes:
    - Container: `relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10`
  - Optional subtle overlay:
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />`

- **Premium CTA Panel** (final conversion sections - maximum impact!)
  - Use for high-impact CTA sections that need maximum attention.
  - Classes:
    - Container: `relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60 p-8 sm:p-12 lg:p-16`
  - Enhanced radial overlays:
    - Primary: `<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />`
    - Decorative blurs: corner glow elements using `blur-3xl` and emerald/teal gradients
      - Example: `<div class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />`
  - Typography:
    - Heading: `text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight`
    - Subtitle: `text-base sm:text-lg leading-relaxed text-gray-700`
  - Button: `h-14 px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]`
  - Footnote: `text-sm sm:text-base text-gray-600 flex flex-wrap items-center justify-center gap-2 sm:gap-3` with bullet separators
  - Reference: `FinalCtaSection` component

- **Feature Highlight Panel** (special announcements, hero sub-sections)
  - Use for standout content that deserves extra visual weight but isn't a CTA.
  - Classes:
    - Container: `relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30`
  - Radial overlay:
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />`

- Use these four section wrappers across pages based on hierarchy and purpose.

- **Page container spacing**
  - `main` container: `mx-auto max-w-7xl px-4 sm:px-6`
  - Vertical rhythm: `py-10 sm:py-14` (funnel), `py-12 sm:py-18` (home)
  - Increase breathing room between sections

## Cards (shadcn/ui)

- **Enhanced Standard Card**
  - Base: Use shadcn `Card` component
  - Classes: `border border-gray-200/60 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-white/80 backdrop-blur-sm`
  - Add subtle gradient overlay for depth:
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />`

- **Icon bubbles** (enhanced with gradients)
  - Indigo: `rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm`
  - Sky: `rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/60 p-3 text-sky-600 shadow-sm`
  - Emerald: `rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm`
  - Slate: `rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 p-3 text-slate-700 shadow-sm`

- **Numeric emphasis cards** (for stats/metrics)
  - Number: `text-4xl sm:text-5xl font-bold bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent`
  - Label: `text-sm font-medium text-gray-600 mt-2`

- **Step cards with enhanced rail** (Process sections)
  - Top rail: `<div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 rounded-t-xl" />`
  - Card classes: Add `pt-6` to account for thicker rail
  - Step number badge: `absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-lg`

- **Card consistency rules**
  - Use the shared `Card` from `src/components/ui/card.tsx` for all "boxes".
  - Radius: cards are `rounded-xl` (enhanced sections use `rounded-2xl` or `rounded-3xl`)
  - Background: cards are `bg-white/80 backdrop-blur-sm` for subtle depth
  - Spacing: use `CardHeader`, `CardContent`, `CardFooter` for padding; avoid ad‑hoc `p-*` on the card
  - Hover states: `hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300` for interactive cards
  - Static cards: `shadow-md` without hover transforms

- **Trust/Privacy cards** (enhanced for Datenschutz & Vertrauen)
  - Structure: `Card > CardHeader (icon bubble + title) > CardContent (description)`
  - Enhanced classes:
    - Card: Add `group` class for coordinated hover effects
    - Icon bubble: `rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 p-3 text-slate-700 shadow-sm group-hover:shadow-md transition-shadow`
    - Title: `font-semibold text-gray-900`
    - Description: `text-sm leading-relaxed text-gray-600`

- **Checklist tokens** (enhanced badges)
  - Structure: `div` with `rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-3 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow`
  - Icon: `h-5 w-5 text-emerald-600` (larger, more prominent)
  - Text: `text-gray-700 font-medium`
  - Use for qualifications, guarantees, key features

## Typography

**Bolder, Bigger, Better Hierarchy**

- **H1 (Hero - Maximum Impact)**
  - Funnel pages: `text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight`
  - Home: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight`
  - Optional gradient text: `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent`
  - Or with accent: `bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent`

- **H2 (Section Headings)**
  - Standard: `text-2xl sm:text-3xl font-bold tracking-tight text-gray-900`
  - Premium variant: `text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-transparent`

- **H3 (Card/Subsection Headings)**
  - `text-xl sm:text-2xl font-semibold text-gray-900`

- **Body Text**
  - Primary: `text-base sm:text-lg leading-relaxed text-gray-700`
  - Secondary: `text-sm sm:text-base leading-relaxed text-gray-600`
  - Emphasized: `font-medium text-gray-900`

- **Supporting Text**
  - Captions: `text-xs sm:text-sm text-gray-500`
  - Labels: `text-sm font-medium text-gray-700`

- **Line Height & Spacing**
  - Use `leading-tight` for headlines (1.25)
  - Use `leading-relaxed` for body text (1.625)
  - Add generous `mt-` spacing between elements (4-6 for related, 8-12 for sections)

## Logos

- Use `next/image` with `className="h-20 w-auto object-contain opacity-80"`

## FAQ Accordion

- Native HTML + minimal animation (accessibility-first):
  - Structure: `<details><summary>...</summary><div>content</div></details>`
  - Animation (grid rows trick):
    - Wrapper: `grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]`
    - Inner: `overflow-hidden`
  - Chevron rotation on open: `group-open:rotate-180`
  - Tracking: POST `/api/public/events` with `{ type: 'faq_open', id, title }`

## Buttons (shadcn/ui)

**Enhanced Interactive Elements**

- **Primary CTA (High Impact)**
  - Base: `<Button size="lg">`
  - Enhanced classes: `h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold`
  - Premium shadow: `shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]`
  - Color variants:
    - Default (emerald): `shadow-emerald-600/20 hover:shadow-emerald-600/30`
    - Indigo: `shadow-indigo-600/20 hover:shadow-indigo-600/30 bg-indigo-600 hover:bg-indigo-700`
    - Purple: `shadow-purple-600/20 hover:shadow-purple-600/30 bg-purple-600 hover:bg-purple-700`

- **Secondary CTA**
  - Base: `<Button size="lg" variant="outline">`
  - Enhanced: `h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200`
  - Note: Outline buttons do not invert text color on hover (avoid white on light backgrounds). Keep text readable; background shifts subtly.

- **Ghost/Tertiary**
  - `<Button variant="ghost" size="lg" className="hover:bg-gray-100/80 transition-colors">`

- **Icon Buttons**
  - Use `h-10 w-10 sm:h-12 sm:w-12` for better touch targets
  - Add `rounded-full` for circular icon buttons with `shadow-md hover:shadow-lg`

## Spacing & Rhythm

**More Generous Breathing Room**

- **Section spacing** (between major sections)
  - Standard: `mt-14 sm:mt-20 lg:mt-24`
  - Compact (when needed): `mt-10 sm:mt-14`

- **Content padding**
  - Sections: `p-8 sm:p-10 lg:p-12` (standard), `p-8 sm:p-12 lg:p-16` (premium CTAs)
  - Cards: `p-5 sm:p-6` (via CardHeader/CardContent)
  - Small elements: `p-3 sm:p-4`

- **Element spacing within sections**
  - Between heading and body: `mt-4 sm:mt-6`
  - Between paragraphs: `mt-3 sm:mt-4`
  - Between content groups: `mt-8 sm:mt-10`
  - Between cards in grid: `gap-4 sm:gap-6 lg:gap-8`

## Mobile UX Principles (Email-First Wizard)

- **Touch targets (44px min)**
  - Buttons and inputs use `h-11` (≈44px) by default. Increase vertical padding instead of font size.

- **Progressive trust, progressive disclosure**
  - Capture email first, then ask for details in small, low‑friction steps. Avoid long forms on a single screen.
  - Use short helper text to set expectations; keep labels concise.

- **Step navigation and focus management**
  - On step change, call `window.scrollTo({ top: 0, behavior: 'smooth' })` to prevent partial screens.
  - Keep Back/Next CTAs large and consistently positioned. Avoid multiple competing CTAs per screen.

- **Inline validation (no modals, no blocking)**
  - Validate on blur or on navigation; render small inline error text beneath the field.
  - Only show errors for fields the user interacted with or when leaving a screen.

- **Keyboard & input types**
  - Use semantic input types to trigger the right keyboard: `type="email"`, `inputmode="numeric"` when appropriate.
  - Ensure the active input is not covered by the keyboard (use adequate bottom spacing and avoid sticky blockers near inputs).

- **Autosave and resilience**
  - Save on every field change to `localStorage`; sync to backend at a light cadence (≈30s) using a shallow payload.
  - Prefer fire‑and‑forget network updates; UI must remain responsive when offline or on high latency.

- **Analytics (no PII, server‑side)**
  - Client sends small, PII‑free events via `navigator.sendBeacon` (fallback to `fetch`):
    - `screen_viewed`, `screen_completed` (with `duration_ms`, `missing_required`), `field_change`, `field_abandonment`, `form_completed`.
  - Do not duplicate in Vercel Analytics. Keep Vercel for high‑level conversions only.

- **Copy & tone**
  - Du‑Form throughout. Use plain language and affirmative microcopy (“Fast geschafft …”).

- **Performance**
  - Prefer native controls, minimal animation (≤300ms), and avoid heavy libraries on funnel pages.

## Radii & Elevation

**Enhanced Depth & Dimensionality**

- **Sections**
  - Standard: `rounded-3xl border border-slate-200/60 shadow-lg`
  - Premium CTA: `rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20`
  - Compact/Inline: `rounded-2xl border shadow-md`

- **Cards**
  - Interactive: `rounded-xl border border-gray-200/60 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`
  - Static: `rounded-xl border border-gray-200/60 shadow-md`
  - Nested/Sub-cards: `rounded-lg border shadow-sm`

- **Small Elements**
  - Tokens/Badges: `rounded-lg border border-emerald-200/60 shadow-sm hover:shadow-md transition-shadow`
  - Icon bubbles: `rounded-xl shadow-sm`
  - Pills/Tags: `rounded-full`

### Modality Pills (Therapists)

Use the same visual language for modality tokens on cards and as interactive filters in the directory.

- **Base component**: shadcn `Badge`
- **Sizing by context**:
  - **On cards** (display only): `text-xs font-medium px-2 py-0.5 gap-1.5` with `h-3 w-3` icons
  - **Directory filters (desktop)**: `h-11 px-4 py-2.5 text-sm font-medium gap-2` with `h-4 w-4` icons (44px tap target)
  - **Directory filters (mobile sheet)**: `h-12 px-5 py-3 text-sm font-medium gap-2` with `h-4 w-4` icons (48px tap target)
- **Layout**: `inline-flex items-center rounded-full`
- **Icons**:
  - NARM → `HeartHandshake`
  - Somatic Experiencing → `Shell`
  - Hakomi → `Wind`
  - Core Energetics → `Target`
- **Color mapping** (same for cards and filters):
  - NARM: `border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100`
  - Somatic Experiencing: `border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100`
  - Hakomi: `border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100`
  - Core Energetics: `border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 hover:border-fuchsia-300 hover:bg-fuchsia-100`
  - Default/unknown: `border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100`
- **Directory filter behavior**:
  - Pills are clickable Badges (keyboard: Enter/Space). Selected pill adds `ring-2 ring-emerald-300`.
  - Include an "Alle" pill for resetting. When selected, use distinct indigo styling to avoid confusion with modality colors: `bg-indigo-100 text-indigo-700 border-indigo-200 ring-2 ring-indigo-300`.
  - Desktop: horizontal, scrollable rail (`overflow-x-auto`, gradients optional for edges) in sticky filters.
  - Mobile: pills in sheet use `flex flex-wrap` with same sizes for tap targets.
  - Accessibility: `role="button"` and `tabIndex=0` on badge wrappers.
- **Format filter buttons** (Alle/Online/Vor Ort):
  - Desktop: `h-11` (44px) for adequate tap targets.
  - Mobile sheet: `h-12` (48px) for comfortable thumb interaction.
  - Use Button component with `flex-1` for equal width distribution.

- **Shadows Palette**
  - Subtle: `shadow-sm` (2px blur)
  - Standard: `shadow-md` (4px blur)
  - Elevated: `shadow-lg` (8px blur)
  - Premium: `shadow-xl` (16px blur)
  - With tint: Add color like `shadow-emerald-100/20` or `shadow-indigo-100/30`

## Colors

**Sophisticated Palette with Depth**

- **Primary Neutrals**
  - Background layers: Gray/Slate 50, White, Gray 50/30 (subtle gradients)
  - Text: Gray 900 (headings), Gray 700 (body), Gray 600 (secondary), Gray 500 (captions)
  - Borders: Gray 200/60, Slate 200/60 (with opacity for subtlety)

- **Accent Colors** (use gradients for depth)
  - **Emerald** (primary brand, CTAs, success)
    - Solid: emerald-600, emerald-700
    - Gradient: `from-emerald-50/90 via-teal-50/70 to-cyan-50/60`
    - Shadows: `shadow-emerald-600/20`
  - **Indigo** (trust, features)
    - Solid: indigo-600, indigo-700
    - Gradient: `from-indigo-600 to-purple-600`
    - Shadows: `shadow-indigo-600/20`
  - **Purple/Pink** (premium, highlights)
    - Gradient: `from-purple-600 via-pink-600 to-rose-600`
    - For special emphasis and premium elements
  - **Sky/Cyan** (calm, professional)
    - Solid: sky-600, cyan-600
    - Gradient: `from-sky-50 to-cyan-50`

- **Semantic Colors**
  - Success: Emerald scale
  - Warning: Amber scale
  - Error: Red scale (use sparingly)
  - Info: Sky/Blue scale

- **Gradient Patterns**
  - Multi-layer backgrounds: Use 2-3 color stops with varying opacity
  - Text gradients: Prefer subtle (gray-900 to gray-800) for readability, bold (multi-color) for impact
  - Always use `bg-clip-text text-transparent` for text gradients

## Legal & Compliance

- Disclaimers primarily live in the footer. If a page‑specific note is legally required, place it at the end of the page in small, subdued text (e.g., `text-xs text-gray-600`).
- Wording: We operate as a Makler. Empfehlungs‑/Vermittlungs‑Sprache ist zulässig. Weiterhin keine medizinischen Aussagen und keine Erfolgsversprechen.
- Cookies: Keine Tracking‑Cookies auf der öffentlichen Seite; nur technisch notwendige Cookies in geschützten Bereichen wie `/admin`.

## Accessibility & Semantics

- Sections must have `aria-labelledby` referencing an element `id` inside the section (usually the H1/H2).
- Example: `<section aria-labelledby="trust"><h2 id="trust">...</h2></section>`

## Anchors & CTAs

- Anchor CTAs should target in-page ids (e.g., `#top-form`). Ensure the target wrapper has that `id`.

## When to use these patterns

- Use the Gradient Panel for heros and any section that should visually separate from the page background.
- Use step cards with top rails for ordered processes.
- Use icon bubbles to visually categorize content without heavy imagery.

### Pattern mapping for `src/app/therapie-finden/page.tsx`

- „Warum Körperpsychotherapie?“ → Gradient Panel + 3 info cards (icons + gradient numerics).
- „Datenschutz & Vertrauen“ → 3 Trust/Privacy cards (use `Card`, not ad‑hoc `div` boxes; white background).
- „So funktioniert’s“ → Step cards with top rail (1‑3), consistent icon bubbles.
- „Persönlich ausgewählte …“ → Plain Panel callout (white), single leading icon bubble, no tinted panel.
- „Unsere sorgfältig geprüften Therapeuten“ → Checklist tokens (not full cards), two‑column grid on `sm+`.
- „Häufige Fragen“ → `FaqAccordion` component.
- Final CTA → Primary button (`<Button size="lg">`) linking to `#top-form`.

### Consistency checklist (apply when editing pages)

- Sections use only Gradient Panel or Plain Panel wrappers.
- All boxes inside sections are `Card` components, except checklist tokens.
- Radii: sections `rounded-2xl`, cards `rounded-xl`, tokens `rounded-lg`.
- Avoid mixing tinted backgrounds and white cards within the same grid unless a callout is intended.

## Analytics & Event Tracking

- Endpoint: POST `/api/public/events` with `{ type: string, id?: string, title?: string }`
- Event types (use these):
  - `cta_click` (for button/link clicks)
  - `faq_open` (FAQ expansion)
  - `form_submit` or feature-specific (e.g., `therapist_apply_submitted`)
- eventId naming convention: `{page}-{location}-{action}[-{qualifier}]`
  - Examples:
    - `fuer-therapeuten-hero-apply`
    - `fuer-therapeuten-cta-apply`
    - `fuer-therapeuten-faq-fee`
    - `fuer-therapeuten-form-submit`
- Prefer `navigator.sendBeacon` for reliability; fallback to `fetch(..., { keepalive: true })`.

## Animations & Micro-interactions

**Smooth, Delightful, Never Jarring**

- **Entrance Reveals** (Intersection Observer based)
  - Target elements: Add `data-reveal` attribute
  - Initial state: `opacity-0 translate-y-4 transition-all duration-500 ease-out`
  - On intersect: `opacity-100 translate-y-0`
  - Stagger delays: `style={{ transitionDelay: '100ms' }}` per item (0ms, 100ms, 200ms, etc.)
  - Keep subtle and respect `prefers-reduced-motion`

- **Hover Transitions** (interactive elements)
  - Cards: `hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`
  - Buttons: `hover:shadow-xl hover:scale-[1.02] transition-all duration-200`
  - Links: `hover:text-indigo-700 transition-colors duration-150`
  - Icon bubbles: `group-hover:shadow-md group-hover:scale-105 transition-all duration-200`

- **Loading States**
  - Skeleton screens with shimmer: `bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse`
  - Spinner: Use minimal, branded spinner (emerald-600)

- **Focus States** (accessibility critical)
  - All interactive: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all`
  - Buttons: Add `focus-visible:scale-[1.02]`
  - Rationale: Use the design token `ring` (brand teal) and include a ring offset to ensure good contrast on both white and tinted backgrounds.

- **Duration Guidelines**
  - Micro (hover, focus): 150-200ms
  - Standard (cards, modals): 250-300ms
  - Entrance reveals: 400-500ms
  - Never exceed 600ms

- **When to Abstract**
  - Use `RevealContainer` component for lists/grids
  - Extract `useRevealObserver` hook if pattern repeats 3+ times
  - Always respect `prefers-reduced-motion`

## Implementation Checklist

When updating or creating new pages/sections, ensure:

- [ ] Sections use one of the four container patterns (Enhanced Gradient, Elevated Plain, Premium CTA, Feature Highlight)
- [ ] Typography follows the enhanced hierarchy (larger headings, better spacing)
- [ ] Cards have proper shadows (`shadow-md` to `shadow-xl` on hover)
- [ ] Icon bubbles use gradient backgrounds with `shadow-sm`
- [ ] Buttons have enhanced sizing (`h-12` to `h-14`) with hover effects
- [ ] Generous spacing between sections (`mt-14` to `mt-24`)
- [ ] Borders use opacity for subtlety (`border-gray-200/60`)
- [ ] Interactive elements have smooth transitions (200-300ms)
- [ ] Focus states are accessible (`focus-visible:ring-2`)
- [ ] Gradient text used strategically for impact
- [ ] Backdrop blur on cards for depth (`bg-white/80 backdrop-blur-sm`)
- [ ] Decorative blur elements add subtle depth to key sections
- [ ] All animations respect `prefers-reduced-motion`

## Email Design (Transactional)

**CRITICAL: Force Light Mode to Prevent Dark Mode Rendering Issues**

Modern email clients (especially Gmail, Apple Mail) automatically invert colors in dark mode, causing illegible text (dark on dark). We enforce light-only rendering.

**Dark Mode Prevention Strategy:**

1. **Meta tags** (in `<head>`):
   ```html
   <meta name="color-scheme" content="light only" />
   <meta name="supported-color-schemes" content="light" />
   ```

2. **Inline styles with `!important`** on ALL color properties:
   - `background: #ffffff !important;`
   - `background: linear-gradient(...) !important;`
   - `background-image: linear-gradient(...) !important;` (double declaration for Gmail)
   - `color: #334155 !important;`
   - Legacy `bgcolor="#ffffff"` attribute on `<table>` and `<td>` as fallback

3. **Minimal CSS** (email clients strip `<style>` tags):
   ```css
   * { color-scheme: light only !important; }
   body { background: #f9fafb !important; }
   ```

4. **Never rely on CSS media queries** - Gmail strips them completely

**Email Section Patterns:**

All inline styles must include `!important` for colors and backgrounds.

- **Hero/Highlight sections** (action-oriented):
  - Background: `background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;`
  - Border: `1px solid rgba(34, 197, 94, 0.2)`
  - Text: `color:#0f172a !important;` (heading), `color:#166534 !important;` (body on tinted bg)
  - Shadow: `0 2px 8px 0 rgba(34, 197, 94, 0.08)`

- **Info/neutral sections**:
  - Background: `background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;`
  - Border: `1px solid rgba(226, 232, 240, 0.8)`
  - Text: `color:#64748b !important;` (body), `color:#475569 !important;` (emphasis), `color:#0f172a !important;` (headings)
  - Shadow: `0 2px 4px 0 rgba(100, 116, 139, 0.05)`

- **Urgency/warning sections**:
  - Background: `background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; background-image: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;`
  - Border: `1px solid rgba(251, 191, 36, 0.3)`
  - Text: `color:#78350f !important;`

- **Buttons**:
  - Background: `background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;`
  - Text: `color:#ffffff !important;`

- **All sections**: 
  - `padding:16px 20px` (min), `border-radius:12px`
  - ALL styles inline (no external CSS)
  - ALWAYS add `!important` to `color`, `background`, and `background-image`

**Implementation Reference:** 
- Layout: `src/lib/email/layout.ts`
- Templates: `src/lib/email/templates/*.ts`
- Components: `src/lib/email/components/*.ts`

**Testing Checklist:**
- ✅ Gmail web (light & dark mode)
- ✅ Gmail iOS app (dark mode)
- ✅ Apple Mail (dark mode)
- ✅ Outlook web
- ✅ Outlook desktop (Windows)

## Notes

- Icons from `lucide-react`, size `h-5 w-5` for body, `h-6 w-6` for emphasis, `h-4 w-4` inside smaller UI
- All animations CSS-only where possible
- Prefer gradients over flat colors for depth
- Layer effects (gradients + shadows + blur) for premium feel
- When in doubt, add more padding and larger type
