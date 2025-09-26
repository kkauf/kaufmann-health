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
 
- __Pre-deploy quick checks__:
  - `npm run test:critical`
  - `npm run build`
  
- __Unified logger__:
  - Events and errors are written to `public.events` via Supabase REST from server routes.
  - RLS: enable and allow inserts for `service_role` only.
  - PII: properties are sanitized/truncated; IPs are stored as sha256(`IP_HASH_SALT` + ip).
- __Logos (homepage social proof)__:
  - Current filenames: `narm.png`, `hakomi.png`, `somatic-experiencing.png`, `core-energetics.png`.
  - Use transparent PNGs around 120–140×40 for consistent height; adjust width for balance.
  - If the number of logos changes, update grid classes in `src/app/page.tsx` (social proof section), e.g. `grid-cols-2 sm:grid-cols-4 lg:grid-cols-4`.
- __Migrations__: Schema is managed in Supabase (UUID defaults, timestamptz, RLS). Track future DDL in SQL migrations when patterns emerge.

  ## Images & Resizing (Profile Photos)

- WHY: Normalize therapist profile photos to ensure consistent display and reduce payload size.
- HOW: Server-side best-effort resize to max 800×800 (fit: inside) is performed in `src/app/api/public/leads/route.ts` using `sharp` if available; otherwise it falls back to the original file. UI-level optimizations (e.g., Next/Vercel responsive images) still apply.
  - Enable resizing in production:
  - `npm i sharp`
  - No other configuration required. The API dynamically imports `sharp` and gracefully continues if missing.

## Observability & Alerts (Runbook)

- Open Admin Errors UI: `/admin/errors` and filter `level=error`. Refine by `source` (e.g., `api.leads`, `email.client`) or `type` (`error`, `cron_failed`).
- Check the latest system alert digest email (subject `[KH] System alerts: ...`).
- Deep dive: Vercel → Functions → Logs for stack traces/timeouts.
- Re-run cron endpoints manually if needed: append `?token=<CRON_SECRET>` or send `Authorization: Bearer <CRON_SECRET>`.
- Email issues: verify `RESEND_API_KEY` and inspect `email_attempted` / `error` entries in `/admin/errors`.

### Alerts digest
- Route: `GET /api/admin/alerts/system?minutes=15`
- Schedule: every 15m via `vercel.json`
- Behavior: emails when `level='error'` or `type='cron_failed'` exists in the window; de-duped by logging `internal_alert_sent` with a `digest_key`.

### Local testing
```bash
# Create a safe error (e.g., trigger a known validation failure), then run:
curl "http://localhost:3000/api/admin/alerts/system?minutes=60&token=$CRON_SECRET"
```
