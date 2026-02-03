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

## Cross-Boundary Contracts

When a UI component emits values (event properties, enum codes, form fields) that a backend consumer reads, they form an implicit contract. Mismatches silently degrade features without errors.

**Rule: Use `src/contracts/` Zod schemas as the single source of truth.**

- All API boundary values (enums, status codes, form fields) belong in `src/contracts/`. Both UI components and backend consumers import from there — never hardcode the same strings on both sides.
- Validation helpers in `src/lib/api-utils.ts` (`parseBody`, `parseQuery`, `parseRequestBody`) enforce schemas at API boundaries. Use them for every endpoint.
- When adding a new enum value, grep for all consumers (switch statements, maps, templates) across the codebase. An unhandled value silently falls through to a default.
- When building a consumer that branches on values from another system (UI events, webhook payloads, external APIs), log which branch was taken. If `default/other` fires more than expected, the mapping is stale.

This applies to: event type/reason codes, status enums, booking kinds, rejection reasons, campaign variants, modality slugs — anywhere a string is written in one place and read in another.

## Resilience & Avoiding Silent Failures

When building features that involve async processes (webhooks, crons, emails):

1. **Verify return types** - Don't assume. `if (result)` on `{sent: false}` is truthy! Always check the actual property: `if (result.sent)`.

2. **Validate schema before writing** - Before any INSERT/UPSERT, check the target table for NOT NULL constraints and required columns via Supabase MCP. Missing a NOT NULL column silently fails the insert. Before any UPDATE to a table with unique constraints, handle duplicate key errors (Postgres `23505`) with user-friendly messages instead of generic 500s.

3. **Think in outcomes, not processes** - A cron that runs successfully but processes 0 items is often broken, not idle. Add sanity checks:
   - Expected N bookings to get emails → verify N emails were sent
   - If 0 processed for multiple runs → alert

4. **Fail loudly** - Silent failures compound. When a query returns unexpectedly empty results or a send fails, log at error level with context.

5. **Build fallback chains** - Primary path fails → cron catches it → sanity check alerts if both fail:
   ```
   Webhook sends email → if fails, flag stays NULL
   Cron retries unsent → if schema broken, 0 processed
   Sanity check alerts → "7 bookings missing emails"
   ```

6. **Test the actual path** - After writing a cron or recovery mechanism, manually trigger it and verify it actually finds and processes the expected records.

## Testing Protocol

- After route changes → `npm run build`
- After component changes → verify in browser
- After utility changes → run relevant test file
- **After new API + UI feature** → Playwright E2E through the real flow (catches constraint violations, missing columns, cookie issues that unit tests miss)
- Before deploy → `npm run test:critical`

## Analytics (Critical)

Two systems, different purposes:
- **Supabase events**: Business logic, detailed behavior, errors
- **Vercel Analytics**: High-level funnel conversions only

Never duplicate events across both systems. See `docs/analytics.md`.

## Git Workflow

**Branch strategy**: Work on `staging`, ship to `main` when ready.

```bash
# During development: commit and push to staging frequently
git add <files> && git commit -m "..." && git push

# When feature is tested and QA'd: ship to production
git ship    # merges staging→main, syncs staging, keeps you on staging

# Hotfixes: can push directly to main when urgent
```

**Commit conventions**: `type(scope): description`
- Types: feat, fix, refactor, docs, chore, perf, test
- Include Linear task ID when applicable: `Refs: EARTH-123`

**After completing a feature**:
1. Update relevant docs in `/docs` (proactive - check what you touched)
2. Flag if business docs may need updates (Google Drive: Partner Support, etc.)
3. **If touching funnels/analytics**: Check if Metabase queries need updating (`docs/metabase-*.md`), then run `npx tsx scripts/metabase-sync.ts --sync`
4. Run `npm run test:critical` and verify in browser
5. `git ship` when confident
