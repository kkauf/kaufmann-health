# Design Language (Kaufmann Health)

This doc captures the visual patterns that save debugging time and keep the UI consistent. Prefer these snippets before inventing new styles.

## Containers

- Gradient Panel (default section wrapper)
  - Use for heros and key sections.
  - Classes:
    - `relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8`
  - Radial overlay (child of the section):
    - `<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />`

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

## Colors

- Neutrals: Slate/Gray scale (50–700)
- Accents: Indigo, Sky, Emerald
- Warnings/Legal: Amber

## Legal & Compliance

- Place legal disclaimers in the footer only; avoid prominent mid-page blocks. Use subtle, non-distracting styles when needed (e.g., small gray text).
- Wording: Use directory language (e.g., „Informationsverzeichnis“, „zeigen Ihnen Optionen“) and avoid Empfehlungen/Vermittlung oder medizinische Aussagen. Keine Eignungs- oder Erfolgsversprechen.

## Accessibility & Semantics

- Sections must have `aria-labelledby` referencing an element `id` inside the section (usually the H1/H2).
- Example: `<section aria-labelledby="trust"><h2 id="trust">...</h2></section>`

## Anchors & CTAs

- Anchor CTAs should target in-page ids (e.g., `#top-form`). Ensure the target wrapper has that `id`.

## When to use these patterns

- Use the Gradient Panel for heros and any section that should visually separate from the page background.
- Use step cards with top rails for ordered processes.
- Use icon bubbles to visually categorize content without heavy imagery.

## Notes

- Icons from `lucide-react`, size `h-5 w-5` for body, adjust to `h-4 w-4` inside smaller UI.
- Keep animations subtle (<= 300ms) and CSS-only when possible.
