# Technical Decisions (Non-obvious)

- __Next.js 15 + App Router__: modern file-based routing, server components; dev with Turbopack.
- __Tailwind v4 + shadcn/ui__: fast UI iteration with accessible primitives. Theme: "new-york", base color: slate. Installed deps: `class-variance-authority`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`.
- __Path aliases__: `@/*` to `src/*` for clean imports (`tsconfig.json`).
- __Supabase client choices__:
  - Browser client placeholder in `src/lib/supabase.ts` (not used for writes).
  - Server client in `src/lib/supabase-server.ts` with service role for secure writes from API routes.
- __Indexes__: Deferred per expected low volume (~10 leads). Revisit with real usage.
