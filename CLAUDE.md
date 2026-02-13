# Kaufmann Health - Development Guide

German-language therapy matching platform connecting patients with body-oriented therapists (NARM, Hakomi, Somatic Experiencing, Core Energetics).

## Context Layers

This file covers the **WHAT** — tech stack, patterns, commands.

| File | Purpose | Loaded |
|------|---------|--------|
| This file | Tech stack, conventions, workflows | Always |
| `CLAUDE.local.md` | Private: German copy, integrations, Kraken mode | Always |
| `~/.claude/.../memory/MEMORY.md` | Auto-learnings from past sessions | Always |
| `docs/private/*` | Deep context (ads, crons, pricing) | On-demand |

For WHO + universal behavior, see `~/.claude/CLAUDE.md`.

## Database Schema (Core Tables)

```
people (leads/patients)
├── id, email, name, phone_number
├── type: 'patient' | 'therapist'
├── status: 'new' | 'email_confirmation_sent' | 'email_confirmed' | 'matched' | 'rejected' | ...
├── campaign_source, campaign_variant (attribution)
└── metadata (jsonb)

therapists
├── id, first_name, last_name, email, phone, city, slug
├── status: 'pending_verification' | 'verified' | 'rejected' | 'declined'
├── modalities, schwerpunkte, languages (jsonb arrays)
├── cal_username, cal_enabled, cal_intro_event_type_id, cal_full_session_event_type_id
└── accepting_new, typical_rate

matches (patient ↔ therapist)
├── id, patient_id → people, therapist_id → therapists
├── status: 'proposed' | 'accepted' | 'therapist_contacted' | 'therapist_responded' | 'session_booked' | 'completed' | 'rejected'
├── timestamps: created_at, therapist_contacted_at, therapist_responded_at, patient_confirmed_at
└── secure_uuid (for public links)

cal_bookings (Cal.com webhooks)
├── id, cal_uid, therapist_id, patient_id, match_id
├── booking_kind: 'intro' | 'full_session'
├── source: 'concierge' | 'directory'
├── status, start_time, end_time
├── email flags: client_confirmation_sent_at, therapist_notification_sent_at, followup_sent_at, reminder_*_sent_at
└── is_test

events (analytics/errors)
├── id, type, level, properties (jsonb)
├── hashed_ip, user_agent, created_at
└── Common types: 'user_facing_error', 'conversion', 'funnel_*'
```

## Core Philosophy

- Ship fast, refactor when patterns emerge (3x rule)
- Document only the "why" (business rules, security decisions, weird workarounds)
- Discover before coding: grep existing patterns, check docs, verify state

## Standard Workflows

When starting work, identify the task type and follow the corresponding workflow:

### Task Type Detection
| Signal | Task Type | Workflow |
|--------|-----------|----------|
| "X is broken", "not working", error reports | **Bug** | Investigate → Fix → Test |
| "Add X", "implement Y", new capability | **Feature** | Clarify → Plan → Implement → Test → Document |
| "Clean up", "improve", "simplify" | **Refactor** | Scope → Test coverage → Refactor → Verify |
| "Change schema", "add column", "migrate" | **Migration** | Schema review → Migration → Backfill → Verify |
| "Review", "analyze", "what's happening with" | **Research** | Gather data → Analyze → Summarize |

### Workflow: Bug Fix
1. **Investigate** — Use `/investigate` skill or: check errors in `events` table, recent git changes, reproduce the issue
2. **Identify root cause** — Form hypotheses, test each, confirm the actual cause
3. **Fix** — Minimal change that addresses root cause
4. **Test** — Run affected tests, verify in browser if UI-related
5. **Verify** — Confirm original error no longer occurs
6. **Document** — If non-obvious, add to MEMORY.md

### Workflow: Feature
1. **Clarify** — What's the user-facing outcome? What's out of scope?
2. **Explore** — Launch parallel agents to map the territory: existing patterns, related features, architecture boundaries. For complex features, use 2-3 Explore agents targeting different aspects (e.g., "how does the existing booking flow work?" + "what API patterns do we use for X?").
3. **Clarifying questions** — After exploration, consolidate all ambiguities into one organized list. Ask the user in a single round — don't drip-feed questions across steps.
4. **Plan** — For multi-file changes, outline the approach first. For complex features, present 2-3 competing approaches with trade-offs (e.g., minimal change vs. clean architecture vs. pragmatic middle ground). Get explicit approval before implementing.
5. **Implement** — Edit existing files > create new ones. Type-check after each file.
6. **Test** — Unit tests for logic, E2E for user flows
7. **Document** — Update docs if behavior changed, add to MEMORY.md if learnings

### Workflow: Database Migration (Self-Healing Pipeline)
1. **Review schema** — Query current state via `mcp__supabase__execute_sql`
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = '[table]';
   ```

2. **Create branch** — Isolate changes for safe testing
   ```
   mcp__supabase__create_branch → get branch_id
   ```

3. **Write & apply migration** — On the branch
   ```
   mcp__supabase__apply_migration with branch project_id
   ```

4. **Validate** — Run integrity checks on branch
   - Row counts match expectations
   - No orphaned foreign keys
   - Constraints don't block existing data
   - Sample queries return expected results

5. **If validation fails** → Analyze error, rollback branch, try alternative approach
   ```
   mcp__supabase__reset_branch or mcp__supabase__delete_branch
   ```
   Loop back to step 3 with revised migration (max 3 attempts)

6. **If validation passes** → Output final migration SQL for production
   - Document any edge cases discovered
   - Note backfill requirements if applicable

7. **Promote to production** — Only after explicit approval
   ```
   mcp__supabase__apply_migration on main project_id
   ```

8. **Verify production** — Re-run validation queries against live data

### Agent Teams vs. Subagents (Decision Rule)

**Default to agent teams** (TeamCreate + SendMessage) for any task that involves **parallel implementation work** — i.e., multiple agents that need to write code, not just report findings. Teams give each agent a full independent session with file editing, and agents can coordinate with each other directly.

**Use teams when:**
- **2+ files need parallel edits** — e.g., frontend + backend, or feature + tests
- **Cross-layer changes** — Frontend, backend, tests owned by different teammates
- **Multiple hypotheses** — Parallel investigation where agents may need to try fixes
- **Research + Implementation** — One researches while another starts implementing
- **Complex features** — Anything touching 3+ files that could be split into independent streams

**Use subagents (Task tool) only for:**
- Pure read-only research that reports back findings
- Quick lookups, grep searches, doc reading
- Single focused questions ("what pattern does X use?")

**Rule of thumb:** If agents need to *edit files* or *run commands*, use a team. If they just need to *read and report*, use subagents.

### Checkpoints (Automatic)
After every significant change:
- [ ] Type-check passes (hook runs automatically)
- [ ] Relevant tests pass
- [ ] No regressions in related functionality
- [ ] If stuck 2-3 attempts → surface constraint, ask

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

## After Writing Code

1. **Update documentation**: If you changed behavior, configs, or APIs — update the relevant docs. Check `docs/`, `docs/private/`, `docs/operations/`, and any `*.local.md` files near what you touched. Stale docs are worse than no docs.
2. **Sensitive docs go in `/private`**: Business-internal documentation (ads configs, conversion strategy, pricing, internal metrics) MUST go in gitignored `/private` folders (e.g., `docs/private/`, `google_ads_api_scripts/private/`). Never put business-sensitive information in public-facing docs.
3. **Update QA test cases**: If you changed user-facing behavior (signup flows, therapist registration, matching, booking, admin), update the QA testing guide at `docs/operations/qa-testing-guide.md`. After editing, re-upload to Google Drive as native Google Doc:
   ```bash
   cd /tmp && pandoc /path/to/qa-testing-guide.md -o "20260209 QA Testing Guide.docx" && rclone copy "20260209 QA Testing Guide.docx" "GDrive - KEARTH:QA/" --drive-import-formats docx
   ```
   Update the date prefix in the filename to today's date. The Google Drive copy is the source of truth for external testers.

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

## Metric Queries

`docs/metabase-kpis.md` and `docs/metabase-detail.md` are the **source of truth** for metric definitions.
When running analytics SQL via `mcp__supabase__execute_sql`:
- Copy the relevant query from these files rather than writing from scratch
- Replace `{{start_date}}` with a date literal (e.g., `'2026-01-01'`)
- These are canonical definitions — don't duplicate metric logic elsewhere

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
5. **Major features (3+ files or 500+ lines)**: Ensure a Linear issue exists (create one after the fact if needed). This creates an audit trail and keeps the roadmap honest. Include: what shipped, what it unblocks, any follow-up needed.
6. `git ship` when confident
