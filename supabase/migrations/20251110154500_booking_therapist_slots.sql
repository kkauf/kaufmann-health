-- Therapist recurring availability slots
create table if not exists public.therapist_slots (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  time_local time not null,
  format text not null check (format in ('online','in_person')),
  address text not null default '',
  duration_minutes integer not null default 60 check (duration_minutes >= 30 and duration_minutes <= 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint therapist_slots_format_address_chk
    check ((format = 'in_person' and length(address) > 0) or (format = 'online' and address = ''))
);

alter table public.therapist_slots enable row level security;

create index if not exists therapist_slots_therapist_active_idx on public.therapist_slots(therapist_id, active);
create unique index if not exists therapist_slots_uniq on public.therapist_slots(therapist_id, day_of_week, time_local, format, address);
