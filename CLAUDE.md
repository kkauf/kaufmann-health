# Kaufmann Health - Development Guide

German-language therapy matching platform connecting patients with body-oriented therapists (NARM, Hakomi, Somatic Experiencing, Core Energetics).

## Core Philosophy

- Ship fast, refactor when patterns emerge (3x rule)
- Document only the "why" (business rules, security decisions, weird workarounds)
- Discover before coding: grep existing patterns, check docs, verify state

## Tech Stack

- **Framework**: Next.js (App Router), Tailwind v4, shadcn/ui
- **Backend**: Supabase (Postgres + RLS), Vercel serverless
- **Integrations**: Cal.com (booking), Resend (email), Google Ads (conversions)
- **Testing**: Vitest

## Directory Structure

```
/app              # Pages + API routes
  /api/public     # Public endpoints
  /api/admin      # Authenticated admin endpoints
/features         # Business domains (leads, landing, matches, therapists)
/components       # Shared UI (incl. /ui for shadcn)
/lib              # Utilities (Supabase clients, email, analytics)
/docs             # Detailed documentation
```

See `docs/project-structure.md` for full breakdown.

## Essential Commands

```bash
npm run dev              # Start dev server
npm run build            # Build (run before committing)
npm run test:critical    # Run critical tests before deploy
npm test <path>          # Run specific test
```

## Key Documentation

Read these before major work:

- `docs/architecture.md` — Data flow, boundaries, key patterns
- `docs/analytics.md` — Dual analytics system (Supabase events + Vercel)
- `docs/technical-decisions.md` — Why we chose what we chose
- `docs/data-model.md` — Database schema
- `docs/security.md` — Auth, RLS, cookie policy

For specific features:
- `docs/contact-flow-guide.md` — Patient→therapist contact flow
- `docs/api.md` / `docs/api-quick-reference.md` — API patterns

## Boundaries

**Components**: UI only (render + local state). No business logic.
**Hooks**: Data fetching + business logic. Extract when repeated.
**API routes**: Server-only logic, DB writes. Always return `{ data, error }`.

## Decision Tree

1. shadcn component exists? → Use it
2. Supabase RLS handles it? → Let it
3. Complexity needed today? → Delete it
4. Pattern repeated 3x? → Extract it
5. Confusing in 3 months? → Add one comment

## Before Writing Code

1. **Map territory**: grep for existing usage of what you're touching
2. **Check patterns**: look at similar features, follow established conventions
3. **Verify state**: `supabase migration list` if touching database

## Testing Protocol

- After route changes → `npm run build`
- After component changes → verify in browser
- After utility changes → run relevant test file
- Before deploy → `npm run test:critical`

## Analytics (Critical)

Two systems, different purposes:
- **Supabase events**: Business logic, detailed behavior, errors
- **Vercel Analytics**: High-level funnel conversions only

Never duplicate events across both systems. See `docs/analytics.md`.

## Git Workflow

Follow conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, chore, perf, test
- Include Linear task ID when applicable: `Refs: EARTH-123`
