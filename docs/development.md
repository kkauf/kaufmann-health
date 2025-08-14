# Development

- __Env vars__ (required):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only; do not expose)
  - Copy `.env.example` to `.env.local` and fill real values. Do not commit `.env.local`.
- __Run dev__: `npm run dev` → http://localhost:3000
- __Add UI components__: `npx shadcn@latest add <component>`
- __Deploy (Vercel)__:
  - Set the env vars in Vercel Project Settings (do not commit secrets).
  - API routes needing secrets must run on Node.js runtime.
- __Migrations__: Schema is managed in Supabase (UUID defaults, timestamptz, RLS). Track future DDL in SQL migrations when patterns emerge.
