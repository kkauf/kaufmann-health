begin;

alter table if exists public.therapists
  add column if not exists cal_username text;

alter table if exists public.therapists
  add column if not exists cal_enabled boolean not null default false;

alter table if exists public.therapists
  add column if not exists cal_intro_event_type_id integer;

alter table if exists public.therapists
  add column if not exists cal_full_session_event_type_id integer;

create index if not exists idx_therapists_cal_username on public.therapists(cal_username);
create unique index if not exists therapists_cal_username_key on public.therapists(cal_username)
  where cal_username is not null;

create table if not exists public.cal_bookings (
  id uuid primary key default gen_random_uuid(),
  cal_uid text not null,
  last_trigger_event text not null,
  organizer_username text,
  event_type_id integer,
  start_time timestamptz,
  end_time timestamptz,
  therapist_id uuid references public.therapists(id) on update cascade on delete set null,
  patient_id uuid references public.people(id) on update cascade on delete set null,
  match_id uuid references public.matches(id) on update cascade on delete set null,
  booking_kind text,
  source text,
  status text,
  is_test boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cal_bookings_last_trigger_event_chk check (
    last_trigger_event in ('BOOKING_CREATED','BOOKING_RESCHEDULED','BOOKING_CANCELLED')
  ),
  constraint cal_bookings_booking_kind_chk check (booking_kind in ('intro','full_session') or booking_kind is null),
  constraint cal_bookings_source_chk check (source in ('directory','questionnaire') or source is null)
);

create unique index if not exists cal_bookings_uid_key on public.cal_bookings(cal_uid);
create index if not exists idx_cal_bookings_therapist_id on public.cal_bookings(therapist_id);
create index if not exists idx_cal_bookings_patient_id on public.cal_bookings(patient_id);
create index if not exists idx_cal_bookings_match_id on public.cal_bookings(match_id);
create index if not exists idx_cal_bookings_start_time on public.cal_bookings(start_time);
create index if not exists idx_cal_bookings_updated_at on public.cal_bookings(updated_at desc);

alter table public.cal_bookings enable row level security;

create policy if not exists "service role can manage cal_bookings" on public.cal_bookings
  for all to service_role using (true) with check (true);

commit;
