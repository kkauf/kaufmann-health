# Technical Decisions (Non-obvious)

- __Next.js 15 + App Router__: modern file-based routing, server components; dev with Turbopack.
- __Tailwind v4 + shadcn/ui__: fast UI iteration with accessible primitives. Theme: "new-york", base color: slate. Installed deps: `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`.
- __Path aliases__: `@/*` to `src/*` for clean imports (`tsconfig.json`).
- __Supabase client choices__:
  - Browser client placeholder in `src/lib/supabase.ts` (not used for writes).
  - Server client in `src/lib/supabase-server.ts` with service role for secure writes from API routes.
- __Indexes__: Deferred per expected low volume (~10 leads). Revisit with real usage. For rate-limit lookups on `metadata`, consider: `CREATE INDEX people_metadata_gin_idx ON public.people USING GIN (metadata);`.
- __Lead intake security__: Basic IP-based rate limiting (60s) in `POST /api/leads` using `x-forwarded-for`; stores `ip` and `user_agent` in `metadata` to aid debugging/abuse triage. Tradeoff: best-effort; can be bypassed (NAT/VPN). Future: Upstash rate limit and/or hCaptcha if abuse observed.
- __Notifications (optional)__: Fire-and-forget email via Resend when `RESEND_API_KEY` and `LEADS_NOTIFY_EMAIL` are set to avoid adding latency to the request path. Safe to disable in non-prod.
- __CORS__: Not added; funnel submits same-origin. If cross-origin is needed, add `OPTIONS` handler and CORS headers on `/api/leads`.
- __Service role writes__: Writes handled only on the server via `supabaseServer` (service role). Never expose service role keys to the browser.
