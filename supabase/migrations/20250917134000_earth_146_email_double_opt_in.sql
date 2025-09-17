-- EARTH-146: Email-only lead capture with double opt-in

-- 1) Extend people.status to include pre_confirmation (pre email-confirmation)
alter table public.people drop constraint if exists people_status_check;
alter table public.people add constraint people_status_check
  check (status in ('new', 'pending_verification', 'verified', 'rejected', 'matched', 'pre_confirmation'));

-- 2) Campaign attribution fields on people (nullable)
alter table public.people add column if not exists campaign_source text;
alter table public.people add column if not exists campaign_variant text;
alter table public.people add column if not exists landing_page text;
