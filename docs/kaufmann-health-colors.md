# Kaufmann Health Color Palette & Brand Guidelines

## Brand Positioning

Kaufmann Health embodies **vibrant growth** and **professional trust**. Our palette is energetic yet grounded: a vivid emerald green signals life and forward momentum, anchored by deep slate tones that convey authority and modern sophistication. The result is a brand that feels alive, premium, and unmistakably confident.

---

## Primary Brand Colors

### Vibrant Emerald (Primary Brand)

The heart of our visual identity. Used for CTAs, logo tree, key highlights, and anywhere we want to drive action or signal vitality.

| Token | Hex | RGB | Usage | Tailwind |
|-------|-----|-----|-------|----------|
| **emerald-600** | `#059669` | `5, 150, 105` | Primary CTAs, buttons, logo tree (light mode) | `emerald-600` |
| **emerald-500** | `#10B981` | `16, 185, 129` | Hover states, success accents, logo tree (vibrant variant) | `emerald-500` |
| **emerald-400** | `#34D399` | `52, 211, 153` | **Dark mode primary** – passes contrast on dark backgrounds | `emerald-400` |

**Personality:** Growth, vitality, healing energy, forward momentum, trust through action.

### Deep Slate (Secondary Brand)

Our grounding anchor. Used for text, headers, professional contexts, and anywhere we need authority without heaviness.

| Token | Hex | RGB | Usage | Tailwind |
|-------|-----|-----|-------|----------|
| **slate-900** | `#0F172A` | `15, 23, 42` | Primary text, headers, logo text (light mode) | `slate-900` |
| **slate-800** | `#1E293B` | `30, 41, 59` | Secondary emphasis, dark UI elements | `slate-800` |
| **slate-200** | `#E2E8F0` | `226, 232, 240` | **Dark mode text**, logo text (dark backgrounds) | `slate-200` |

**Personality:** Authority, sophistication, modern professionalism, trustworthy depth.

---

## Light & Dark Mode System

### Light Mode (Default)

| Element | Color | Token |
|---------|-------|-------|
| Background | `#FFFFFF` | white |
| Surface/Cards | `#FFFFFF` | white |
| Primary Text | `#0F172A` | slate-900 |
| Secondary Text | `#475569` | slate-600 |
| Muted Text | `#64748B` | slate-500 |
| Primary Action | `#059669` | emerald-600 |
| Primary Hover | `#047857` | emerald-700 |
| Borders | `#E2E8F0` | slate-200 |
| Section BG | `#F8FAFC` | slate-50 |

### Dark Mode

| Element | Color | Token | Contrast vs bg |
|---------|-------|-------|----------------|
| Background | `#0F172A` | slate-900 | — |
| Surface/Cards | `#1E293B` | slate-800 | — |
| Primary Text | `#F1F5F9` | slate-100 | 15.1:1 ✅ AAA |
| Secondary Text | `#CBD5E1` | slate-300 | 10.2:1 ✅ AAA |
| Muted Text | `#94A3B8` | slate-400 | 6.3:1 ✅ AA |
| **Primary Action** | `#34D399` | **emerald-400** | 8.4:1 ✅ AAA |
| Primary Hover | `#6EE7B7` | emerald-300 | 11.2:1 ✅ AAA |
| Borders | `#334155` | slate-700 | — |

> **⚠️ Dark Mode CTA Note:** Using `emerald-600` (`#059669`) on dark backgrounds fails WCAG AA contrast (only ~3.8:1). Always use `emerald-400` (`#34D399`) for dark mode CTAs and interactive elements.

---

## Supporting Palette

### Accent Gradients (Premium Feel)

Our design language uses sophisticated gradients rather than flat colors for depth:

```css
/* CTA Section Backgrounds */
bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60

/* Premium Text (Headlines) */
bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900

/* Feature Highlights */
bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30
```

### Semantic Colors

| Purpose | Light Mode | Dark Mode | Tailwind |
|---------|------------|-----------|----------|
| Success | `#059669` | `#34D399` | emerald-600 / emerald-400 |
| Warning | `#D97706` | `#FBBF24` | amber-600 / amber-400 |
| Error | `#DC2626` | `#F87171` | red-600 / red-400 |
| Info | `#0284C7` | `#38BDF8` | sky-600 / sky-400 |

---

## Logo Implementation

### Current Logo Colors (To Be Updated)

```
Tree Symbol: #368F8B (muted teal) → UPDATE NEEDED
Text "KAUFMANN HEALTH": #1A365D (navy) → UPDATE NEEDED
Dark Mode Text: #9CA3AF (gray-400) → UPDATE NEEDED
```

### Recommended Logo Colors (Vibrant Alignment)

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| **Tree Symbol** | `#10B981` (emerald-500) | `#34D399` (emerald-400) |
| **Text** | `#0F172A` (slate-900) | `#E2E8F0` (slate-200) |

**Rationale:**
- `emerald-500` is slightly lighter than `emerald-600`, giving the tree icon better visibility at small sizes while maintaining brand consistency
- `slate-900` replaces the legacy navy for a more modern, cohesive look
- `slate-200` for dark mode provides excellent contrast (10.7:1) vs the muted `gray-400` (4.6:1)

### Logo Variants

1. **Full Color (Light BG)** — Emerald tree + Slate text
2. **Full Color (Dark BG)** — Bright emerald tree + Light slate text
3. **Monochrome Light** — All slate-900
4. **Monochrome Dark** — All slate-200 or white

---

## Typography Colors

### Light Mode

| Level | Color | Token | Contrast |
|-------|-------|-------|----------|
| H1/H2 Headlines | `#0F172A` | slate-900 | 17.1:1 ✅ AAA |
| H3/Card Titles | `#1E293B` | slate-800 | 14.5:1 ✅ AAA |
| Body Text | `#334155` | slate-700 | 10.3:1 ✅ AAA |
| Secondary Text | `#475569` | slate-600 | 7.5:1 ✅ AAA |
| Captions/Muted | `#64748B` | slate-500 | 5.4:1 ✅ AA |

### Dark Mode

| Level | Color | Token | Contrast |
|-------|-------|-------|----------|
| H1/H2 Headlines | `#F8FAFC` | slate-50 | 16.3:1 ✅ AAA |
| H3/Card Titles | `#F1F5F9` | slate-100 | 15.1:1 ✅ AAA |
| Body Text | `#E2E8F0` | slate-200 | 12.9:1 ✅ AAA |
| Secondary Text | `#CBD5E1` | slate-300 | 10.2:1 ✅ AAA |
| Captions/Muted | `#94A3B8` | slate-400 | 6.3:1 ✅ AA |

---

## Interactive Elements

### Buttons

**Primary (Light Mode)**
```css
bg-emerald-600 text-white 
hover:bg-emerald-700 
shadow-lg shadow-emerald-600/20 
hover:shadow-xl hover:shadow-emerald-600/30
```

**Primary (Dark Mode)**
```css
bg-emerald-400 text-slate-900 
hover:bg-emerald-300 
shadow-lg shadow-emerald-400/20
```

**Secondary/Outline**
```css
/* Light */
border-2 border-emerald-600 text-emerald-700 bg-white
hover:bg-emerald-50

/* Dark */
border-2 border-emerald-400 text-emerald-400 bg-transparent
hover:bg-emerald-400/10
```

### Links

```css
/* Light */
text-emerald-600 hover:text-emerald-700 underline-offset-4

/* Dark */
text-emerald-400 hover:text-emerald-300
```

### Form Focus States

```css
/* Both modes */
focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
/* Dark mode adds: */ focus:ring-offset-slate-900
```

---

## Implementation

### CSS Custom Properties (globals.css)

```css
:root {
  /* Brand tokens */
  --brand-emerald: #059669;
  --brand-emerald-light: #10B981;
  --brand-emerald-dark-mode: #34D399;
  --brand-slate: #0F172A;
  --brand-slate-light: #E2E8F0;

  /* Semantic mapping */
  --primary: var(--brand-emerald);
  --primary-foreground: #FFFFFF;
  --foreground: var(--brand-slate);
  --ring: var(--brand-emerald);
}

.dark {
  --primary: var(--brand-emerald-dark-mode);
  --primary-foreground: var(--brand-slate);
  --foreground: var(--brand-slate-light);
  --ring: var(--brand-emerald-dark-mode);
}
```

### External Services (Cal.com, etc.)

| Service | Light Theme | Dark Theme |
|---------|-------------|------------|
| **Cal.com** | `#0F172A` | `#34D399` ✅ (not `#059669`) |
| **Resend/Email** | `#059669` | N/A (emails are light-only) |

---

## Accessibility Checklist

### WCAG AA Requirements Met

- ✅ All text meets 4.5:1 minimum contrast
- ✅ Large text (18pt+) meets 3:1 minimum
- ✅ Interactive elements have visible focus states
- ✅ Color is never the only indicator of state
- ✅ Dark mode CTAs use `emerald-400` (not `emerald-600`)

### Color-Blind Safe

- Emerald + Slate have distinct luminance values
- Icons accompany all color-coded states (success, error, warning)
- Links have underlines, not just color changes

---

## Migration Checklist

### Immediate (Logo Files)

- [ ] Update `Tree.svg`: Change `#368f8b` → `#10B981`
- [ ] Update `Kaufmann_health_logo.svg`: Tree `#368f8b` → `#10B981`, Text `#1a365d` → `#0F172A`
- [ ] Update `Kaufmann_health_logo_white.svg`: Tree `#368f8b` → `#34D399`, Text `#9ca3af` → `#E2E8F0`
- [ ] Regenerate PNG exports at all sizes
- [ ] Update Cal.com dark mode brand color: `#059669` → `#34D399`

### Code (globals.css)

- [ ] Update `--brand-teal` → `--brand-emerald` with new value
- [ ] Add dark mode `--primary` override to use `emerald-400`
- [ ] Verify all `emerald-600` usages work in both modes

### Documentation

- [ ] Update this file ✅
- [ ] Update `design-language.md` color references
- [ ] Archive old `kaufmann-health-colors.md`

---

## Brand Psychology

### Vibrant Emerald Communicates:

- **Life and growth** — the color of thriving plants and renewal
- **Confident action** — energetic without being aggressive
- **Premium quality** — associated with luxury and value
- **Health and vitality** — natural association with wellness

### Deep Slate Anchors:

- **Modern sophistication** — tech-forward without being cold
- **Professional trust** — serious but approachable
- **Timeless elegance** — won't feel dated
- **Readability** — excellent for long-form content

### Together They Express:

*"Your healing journey is vibrant and full of possibility. We're the trusted, modern guide who helps you get there."*

---

*Last updated: December 2025*
*Color system aligned to production website implementation*