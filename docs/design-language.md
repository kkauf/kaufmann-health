# Design Language (Kaufmann Health)

This doc captures the visual patterns that save debugging time and keep the UI consistent. Prefer these snippets before inventing new styles.

## Containers

- Gradient Panel (default section wrapper)
  - Use for heros and key sections.
  - Classes:
    - `relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8`
  - Radial overlay (child of the section):
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />`

- Plain Panel (section wrapper for neutral sections)
  - Classes:
    - `relative rounded-2xl border bg-white p-6 sm:p-8`
- Use only these two section wrappers across pages.

- Page container spacing
  - `main` container: `mx-auto max-w-7xl px-4`
  - Vertical rhythm: `py-8 sm:py-12` (funnel), `py-10 sm:py-16` (home)

## Cards (shadcn/ui)

- Standard info card
  - `transition-all duration-200 hover:shadow-md`
  - Icon bubble by color context:
    - Indigo: `rounded-xl bg-indigo-50 p-2 text-indigo-600`
    - Sky: `rounded-xl bg-sky-50 p-2 text-sky-600`
    - Emerald: `rounded-xl bg-emerald-50 p-2 text-emerald-600`
  - Numeric emphasis (optional):
    - `CardTitle` with gradient text: `text-3xl bg-gradient-to-r from-<start> to-<end> bg-clip-text text-transparent`

- Step card rail (Process section)
  - Top rail: `<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />`

- Card consistency rules
  - Use the shared `Card` from `src/components/ui/card.tsx` for all “boxes”.
  - Radius: cards are `rounded-xl` only. Sections are `rounded-2xl`.
  - Background: cards are `bg-white` (default). Use tinted backgrounds only for callouts (see below).
  - Spacing: use `CardHeader`, `CardContent`, `CardFooter` for padding; avoid ad‑hoc `p-*` on the card.
  - Hover: `hover:shadow-md` for interactive or highlight cards only; static cards keep `shadow-sm`.

- Trust/Privacy card (used for Datenschutz & Vertrauen)
  - Structure: `Card > CardHeader (icon bubble + title) > CardContent (description)`
  - Example classes: icon bubble `rounded-xl bg-slate-100 p-2 text-slate-700` (or accent color), title `font-medium`, description `text-sm text-gray-600`.

- Checklist token (used for qualifications)
  - Structure: `div` with `rounded-lg border bg-white p-3 flex items-start gap-2 text-sm`
  - Icon: small check or badge icon in `text-slate-600`.
  - Use for short, single‑line guarantees/criteria only.

## Typography

- H1 (hero)
  - Funnel: `text-3xl sm:text-4xl font-semibold tracking-tight`
  - Home: `text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight`
- H2 (section headings): `text-2xl font-semibold`
- Body subdued: `text-gray-700` (primary), `text-gray-600` (secondary)

## Logos

- Use `next/image` with `className="h-20 w-auto object-contain opacity-80"`

## FAQ Accordion

- Native HTML + minimal animation (accessibility-first):
  - Structure: `<details><summary>...</summary><div>content</div></details>`
  - Animation (grid rows trick):
    - Wrapper: `grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-open:grid-rows-[1fr]`
    - Inner: `overflow-hidden`
  - Chevron rotation on open: `group-open:rotate-180`
  - Tracking: POST `/api/events` with `{ type: 'faq_open', id, title }`

## Buttons (shadcn/ui)

- Primary CTA: `<Button size="lg">`
- Secondary: `<Button size="lg" variant="outline">`

## Spacing & Rhythm

- Section spacing: `mt-12 sm:mt-16`
- Inset padding for content blocks: `p-6 sm:p-8`

## Radii & Elevation

- Sections: `rounded-2xl border`, elevation via subtle background (plain or gradient panel).
- Cards: `rounded-xl border shadow-sm`; add `hover:shadow-md` for interactive states.
- Tokens (checklist, badges): `rounded-lg border` without shadows.

## Colors

- Neutrals: Slate/Gray scale (50–700)
- Accents: Indigo, Sky, Emerald
- Warnings/Legal: Amber

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

- Endpoint: POST `/api/events` with `{ type: string, id?: string, title?: string }`
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

## Notes

- Icons from `lucide-react`, size `h-5 w-5` for body, adjust to `h-4 w-4` inside smaller UI.
- Keep animations subtle (<= 300ms) and CSS-only when possible.
