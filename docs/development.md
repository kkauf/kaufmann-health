# Development

- __Env vars__ (required):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only; do not expose)
  - `IP_HASH_SALT` (for hashing IP addresses in logs; can be any random string)
  - Copy `.env.example` to `.env.local` and fill real values. Do not commit `.env.local`.
- __Run dev__: `npm run dev` → http://localhost:3000
- __Add UI components__: `npx shadcn@latest add <component>`
- __Deploy (Vercel)__:
  - Set the env vars in Vercel Project Settings (do not commit secrets).
  - API routes needing secrets must run on Node.js runtime.
  
- __Unified logger__:
  - Events and errors are written to `public.events` via Supabase REST from server routes.
  - RLS: enable and allow inserts for `service_role` only.
  - PII: properties are sanitized/truncated; IPs are stored as sha256(`IP_HASH_SALT` + ip).
- __Logos (homepage social proof)__:
  - Files live in `public/logos/`.
  - Current filenames: `narm.png`, `hakomi.png`, `somatic-experiencing.png`, `core-energetics.png`.
  - Use transparent PNGs around 120–140×40 for consistent height; adjust width for balance.
  - If the number of logos changes, update grid classes in `src/app/page.tsx` (social proof section), e.g. `grid-cols-2 sm:grid-cols-4 lg:grid-cols-4`.
- __Migrations__: Schema is managed in Supabase (UUID defaults, timestamptz, RLS). Track future DDL in SQL migrations when patterns emerge.
