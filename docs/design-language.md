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
  - Tracking: POST `/api/public/events` with `{ type: 'faq_open', id, title }`

## Buttons (shadcn/ui)

- Primary CTA: `<Button size="lg">`
- Secondary: `<Button size="lg" variant="outline">`

## Spacing & Rhythm

- Section spacing: `mt-12 sm:mt-16`
- Inset padding for content blocks: `p-6 sm:p-8`

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

## Animations & Reveal Patterns

- Entrance reveal (IO-based)
  - Target elements include the attribute `data-reveal`.
  - Initial state: `opacity-0 translate-y-2 transition-all duration-300`.
  - On intersect: add `opacity-100 translate-y-0` and remove the initial classes.
  - Keep animations subtle (≤ 300ms) and CSS-only where possible.

- Applying reveals
  - For lists (e.g., checklist tokens, card grids), either:
    - Attach an `IntersectionObserver` in the component itself to observe each `li[data-reveal]`/card, or
    - Wrap the grid with a lightweight `RevealContainer` that observes descendants marked with `data-reveal`.
  - Stagger with inline delay: `style={{ transitionDelay: '60ms' }}` per item (e.g., 0ms/60ms/120ms).

- When to abstract
  - Start simple per our rules. If we repeat this pattern ≥ 3 times, extract a tiny util/hook (e.g., `useRevealObserver`) or keep using `RevealContainer`.
  - Respect `prefers-reduced-motion` if we add more animation later (optional enhancement).

## Notes

- Icons from `lucide-react`, size `h-5 w-5` for body, adjust to `h-4 w-4` inside smaller UI.
- Keep animations subtle (<= 300ms) and CSS-only when possible.
