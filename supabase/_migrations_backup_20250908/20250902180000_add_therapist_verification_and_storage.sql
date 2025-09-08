-- EARTH-69: Therapist verification status and document storage

-- 1) people.status constraint and data backfill
alter table public.people drop constraint if exists people_status_check;
alter table public.people add constraint people_status_check
  check (status in ('new', 'pending_verification', 'verified', 'rejected'));

update public.people
set status = 'pending_verification'
where type = 'therapist' and (status is null or status = 'new');

-- 2) Storage bucket for therapist documents (private)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'therapist-documents') then
    insert into storage.buckets (id, name, public)
    values ('therapist-documents', 'therapist-documents', false);
  end if;
end $$;

-- 3) RLS policies for storage.objects
-- Allow uploads by authenticated users into this bucket (paths managed by application)
drop policy if exists "Authenticated can upload therapist docs" on storage.objects;
create policy "Authenticated can upload therapist docs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'therapist-documents');

-- Allow service role (server) to read/manage docs for admin workflows
-- Read
drop policy if exists "Service role can read therapist docs" on storage.objects;
create policy "Service role can read therapist docs"
  on storage.objects for select
  to service_role
  using (bucket_id = 'therapist-documents');

-- Update/Delete/Upsert
drop policy if exists "Service role can manage therapist docs" on storage.objects;
create policy "Service role can manage therapist docs"
  on storage.objects for all
  to service_role
  using (bucket_id = 'therapist-documents')
  with check (bucket_id = 'therapist-documents');
