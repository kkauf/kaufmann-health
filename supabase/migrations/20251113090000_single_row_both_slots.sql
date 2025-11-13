begin;

-- 1) Allow 'both' in format
alter table if exists public.therapist_slots
  drop constraint if exists therapist_slots_format_check;
alter table if exists public.therapist_slots
  add constraint therapist_slots_format_check check (format in ('online','in_person','both'));

-- 2a) Merge duplicate recurring slots into a single survivor row (set to 'both' when both exist)
with grp as (
  select therapist_id, day_of_week, time_local,
         array_agg(id order by (format='both') desc, (format='in_person') desc, created_at asc) as ids,
         bool_or(format='in_person') as has_in_person,
         bool_or(format='online') as has_online,
         bool_or(format='both') as has_both,
         min(duration_minutes) as dur_min,
         min(end_date) as end_min,
         max(nullif(address,'')) as any_addr
  from public.therapist_slots
  where is_recurring = true
  group by 1,2,3
  having count(*) > 1
), surv as (
  select ids[1] as survivor_id, has_in_person, has_online, has_both, dur_min, end_min, any_addr
  from grp
)
update public.therapist_slots t
set format = (case when s.has_both or (s.has_in_person and s.has_online) then 'both' else t.format end),
    duration_minutes = coalesce(s.dur_min, t.duration_minutes),
    end_date = coalesce(s.end_min, t.end_date),
    address = case when s.has_in_person or t.format='in_person' or t.format='both' then coalesce(s.any_addr, t.address) else '' end
from surv s
where t.id = s.survivor_id;

-- 2b) Delete non-survivors for recurring
with grp as (
  select array_agg(id order by (format='both') desc, (format='in_person') desc, created_at asc) as ids
  from public.therapist_slots
  where is_recurring = true
  group by therapist_id, day_of_week, time_local
  having count(*) > 1
)
delete from public.therapist_slots t
using grp g
where t.id = any(g.ids) and t.id <> g.ids[1];

-- 2c) Merge duplicate one-time slots into a single survivor row
with grp as (
  select therapist_id, specific_date, time_local,
         array_agg(id order by (format='both') desc, (format='in_person') desc, created_at asc) as ids,
         bool_or(format='in_person') as has_in_person,
         bool_or(format='online') as has_online,
         bool_or(format='both') as has_both,
         min(duration_minutes) as dur_min,
         max(nullif(address,'')) as any_addr
  from public.therapist_slots
  where is_recurring = false
  group by 1,2,3
  having count(*) > 1
), surv as (
  select ids[1] as survivor_id, has_in_person, has_online, has_both, dur_min, any_addr
  from grp
)
update public.therapist_slots t
set format = (case when s.has_both or (s.has_in_person and s.has_online) then 'both' else t.format end),
    duration_minutes = coalesce(s.dur_min, t.duration_minutes),
    address = case when s.has_in_person or t.format='in_person' or t.format='both' then coalesce(s.any_addr, t.address) else '' end
from surv s
where t.id = s.survivor_id;

-- 2d) Delete non-survivors for one-time
with grp as (
  select array_agg(id order by (format='both') desc, (format='in_person') desc, created_at asc) as ids
  from public.therapist_slots
  where is_recurring = false
  group by therapist_id, specific_date, time_local
  having count(*) > 1
)
delete from public.therapist_slots t
using grp g
where t.id = any(g.ids) and t.id <> g.ids[1];

-- 3) Update unique indexes to ignore format
drop index if exists therapist_slots_recurring_uniq;
create unique index if not exists therapist_slots_recurring_uniq on public.therapist_slots(therapist_id, day_of_week, time_local) where is_recurring = true;

drop index if exists therapist_slots_one_time_uniq;
create unique index if not exists therapist_slots_one_time_uniq on public.therapist_slots(therapist_id, specific_date, time_local) where is_recurring = false;

commit;
