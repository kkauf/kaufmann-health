-- Adds optional status timestamp columns used by admin matches dashboard.
-- Safe to run multiple times.

alter table public.matches
  add column if not exists therapist_contacted_at timestamptz null,
  add column if not exists therapist_responded_at timestamptz null,
  add column if not exists patient_confirmed_at timestamptz null;
