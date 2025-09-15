# Therapist Profile Reminders – Vercel Cron Setup

This document describes how to schedule server-side reminders for therapists who have not completed their profile (documents, profile photo, approach text).

## Endpoints

- `POST /admin/api/therapists/reminders`
  - Auth: Admin cookie OR Cron secret (`x-cron-secret` header or `?token=...` query string) matching `CRON_SECRET`.
  - Body: `{ limit?: number }` (stage is ignored; stage is derived automatically server‑side)
  - Returns: `{ data: { processed, sent, skipped_no_missing, skipped_cooldown, skipped_capped, examples }, error }`

- `POST /admin/api/therapists/:id/reminder`
  - Manual reminder for one therapist (admin cookie required).

## Why

- Server-side reminders keep the public site cookie-free.
- Business logic (what is "missing") stays in the backend and can evolve with schema.
- One secure endpoint allows flexible scheduling (daily/weekly) without deploying new clients.

## Environment

Add to `.env.local` (see `.env.example`):

```bash
# choose a long random value (e.g., openssl rand -base64 32)
CRON_SECRET="<your-secret>"
```

## Vercel Cron

Recommended: configure schedules in `vercel.json`.

```json
{
  "crons": [
    { "path": "/admin/api/therapists/reminders?limit=200", "schedule": "15 9 * * *" }
  ]
}
```

Notes:
- Method is GET by default; our endpoint supports GET and requires no body.
- If `CRON_SECRET` is set, Vercel includes `Authorization: Bearer <CRON_SECRET>` in requests. Our endpoint authorizes using that header.
- Stage is derived dynamically from prior sends (see Throttling). You do not need to pass `stage`.

You can also trigger jobs from the Cron Jobs UI using a Path (no domain). Headers are not configurable in the UI; rely on the `Authorization` header Vercel adds automatically when `CRON_SECRET` is present.

Observe stats in the JSON response or via events (`email_attempted`, `email_sent`, `therapist_documents_uploaded`).

## Throttling & Caps (Why)

- To avoid email fatigue, batch reminders enforce:
  - 7‑day cooldown per therapist between sends.
  - Max 3 reminders total per therapist; after that we stop (reactivation campaign can handle long‑tail).
- Stage labels are derived from prior sends:
  - 0: `Erinnerung`
  - 1: `Zweite Erinnerung`
  - 2: `Abschließende Erinnerung`
- Derivation is based on `public.events` rows of type `email_sent` where `properties.stage = 'therapist_profile_reminder'` and `properties.therapist_id = <id>`.

## Local Helper

You can trigger a batch locally (useful for testing):

```bash
# .env.local must include CRON_SECRET and BASE_URL/NEXT_PUBLIC_BASE_URL
npm run reminders:run -- --stage="Erinnerung" --limit=50
```

This calls `POST /admin/api/therapists/reminders` with the secret header and prints the server response.

## Observability

- Each email send emits `email_attempted` with `source` and `stage` (e.g., `therapist_profile_reminder`).
- The upload API emits `therapist_documents_uploaded` with:
  - `license: boolean`
  - `specialization_count: number`
  - `profile_photo: boolean`
  - `approach_text: boolean`

These are queryable via the `public.events` table in Supabase for funnel metrics.
