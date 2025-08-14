# Architecture Overview

- __App Router__: Pages in `src/app/` (UI only: rendering, local state, event handlers). Business logic does not live in components.
- __Components__: Reusable UI in `src/components/` and shadcn-generated primitives in `src/components/ui/`.
- __API routes__: Server-only logic in `src/app/api/*` with `export const runtime = 'nodejs'` where secrets (service role) are required.
- __Lib__: Shared utilities in `src/lib/` including Supabase clients.

## Data Flow (Frontend → API → DB)
- UI submits to `POST /api/leads`.
- Route handler uses the server-side Supabase client (service role) to write to Postgres.
- API responses consistently return `{ data, error }`.

Why this design:
- Keeps secrets and DB writes on the server.
- Keeps components simple and testable.
- Aligns with RLS and security best practices.

## Supabase & Database
- Tables: `people`, `matches` (see `docs/data-model.md`).
- Defaults: `id gen_random_uuid()`, `created_at timestamptz now()`.
- RLS enabled on tables. Note: the service role client bypasses RLS by design—route handlers must validate inputs and enforce rules.

## Runtime & Hosting
- Next.js App Router, Tailwind v4, shadcn/ui (style: new-york, baseColor: slate).
- Node.js runtime for API routes that need secrets.
- Designed for Vercel deploys (set env vars in Vercel project settings).
