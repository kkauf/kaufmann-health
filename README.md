# Kaufmann Health Development Guidelines

## Core Architecture Decisions

**Tech Stack:**
- **Frontend:** Next.js App Router, TypeScript, Tailwind, shadcn/ui
- **Backend:** Next.js API routes (Edge/Node as appropriate)
- **Database:** Supabase (PostgreSQL) with RLS; Storage for private documents (e.g., `therapist-documents` bucket)
- **Email:** Resend (German templates)
- **Analytics/Attribution:** Server-side measurement (no cookies); Google Ads Enhanced Conversions (hashed email)
- **Deployment:** Vercel

**Key Decisions:**
1. **Unified events table** — One table for errors and analytics
2. **Fire-and-forget operations** — Email/logging never blocks user flow
3. **PII-safe by default** — IP hashing with `IP_HASH_SALT`; no client tracking cookies
4. **GDPR-first** — Public site is cookie-free; server-side measurement only
5. **Manual-first MVP** — Admin tools before automation
6. **API shape** — Endpoints return `{ data, error }`

**Database Patterns:**
- UUID defaults on all tables
- `timestamptz` for all timestamps
- Metadata JSON for flexible form storage
- Proper indexing on query columns

**Security and Privacy:**
- **Admin authentication** — `POST /api/admin/login` verifies `ADMIN_PASSWORD` and sets an HTTP-only session cookie `kh_admin` (HMAC-signed via Web Crypto, 24h expiry, scoped to `/admin`). Edge middleware protects `/admin/*`. Public site remains cookie-free.
- **Magic links** — Secure UUIDs with 72h expiration; no cookies. Responses record `responded_at`.
- **RLS everywhere** — Row Level Security enforced for tables; storage buckets are private by default and managed server-side.
- **Service role usage** — Service role keys are used only server-side.

**Analytics & Tracking:**
- All features follow dual analytics system (Supabase + Vercel)
- See `docs/analytics.md` for implementation patterns and event conventions
- Plan tracking during feature design, test both systems work

## Architecture Rules

- **Boundaries** — Components are UI-only (render + local state). Hooks handle data fetching and business logic. Start inline; extract when repeated 3x or files exceed ~200 lines.
- **Data flow** — Frontend never writes directly to the DB. API always returns `{ data, error }`. Keep state close to usage; use context only when prop drilling hurts (>3 levels).
- **Documentation** — Focus on the “why”: business rules, performance hacks, security decisions, and necessary workarounds. Skip CRUD explanations and framework basics.
- **Tech choices** — Use shadcn/ui, Tailwind, and Edge Functions for secrets when needed. Avoid heavy state libraries and custom build tools.


## Testing and QA

- **Focus** — Prioritize tests for money flows and complex logic. Keep them fast and targeted.
- **Quick run** — `npm run test:critical` before deploy. Ensure `npm run build` succeeds.
- **Principles** — Test observable outcomes, not internals; mock fire-and-forget operations.
- **Representative flows** — Patient registration, therapist registration (contract + status), manual matching (outreach + response timestamps).

## Environment and Deployment

- **Environment variables** — See `.env.example` for the authoritative list. Critical keys include Supabase URL/keys, `IP_HASH_SALT`, Resend keys, lead notification emails, `ADMIN_PASSWORD`, Google Ads variables for Enhanced Conversions, and terms/privacy versioning.

**Before Production:**
1. `npm run test:critical`
2. `npm run build`
3. Verify environment variables in Vercel
4. Confirm admin authentication works (`/admin/login`)
5. Verify emails send (Resend) and Enhanced Conversions fire server-side
6. Check error logging and events are recorded

**Success Metrics:**
- Landing → Signup: >15%
- Signup → Profile completion: >80%
- CAC: <€50
- Match success rate: >60%

## Project Docs
- [Architecture](./docs/architecture.md)
- [Data model](./docs/data-model.md)
- [Security](./docs/security.md)
- [Technical decisions](./docs/technical-decisions.md)
- [API](./docs/api.md)
- [Development](./docs/development.md)
- [Project structure](./docs/project-structure.md)

## License
Licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
