-- Outreach contacts table for tracking cold outreach campaigns
-- Used for therapist acquisition campaigns (SE, NARM, Hakomi, etc.)
-- See docs/private/outreach-system.md for usage guide

create table outreach_contacts (
  id uuid primary key default gen_random_uuid(),

  -- Contact info
  email text unique not null,
  first_name text,
  last_name text,
  full_name text,
  city text,
  phone text,
  website text,

  -- Source tracking
  source text not null, -- 'se_directory', 'narm_directory', 'hakomi_directory', etc.
  source_url text, -- Original profile URL if available

  -- Campaign status
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'followed_up', 'replied', 'opted_out', 'converted', 'bounced')),

  -- Timestamps for sequence logic
  first_sent_at timestamptz,
  follow_up_1_sent_at timestamptz,
  follow_up_2_sent_at timestamptz,
  replied_at timestamptz,
  opted_out_at timestamptz,
  converted_at timestamptz,

  -- Notes for manual tracking
  notes text,

  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for querying by status and source
create index idx_outreach_contacts_status on outreach_contacts(status);
create index idx_outreach_contacts_source on outreach_contacts(source);
create index idx_outreach_contacts_first_sent_at on outreach_contacts(first_sent_at);

-- RLS: Admin only (no public access needed for outreach table)
-- Note: updated_at is managed by application code
alter table outreach_contacts enable row level security;

-- Comments for documentation
comment on table outreach_contacts is 'Tracks cold outreach contacts for therapist acquisition campaigns. Status flow: pending → sent → (replied|opted_out|followed_up) → converted';
comment on column outreach_contacts.source is 'Directory source: se_directory, narm_directory, hakomi_directory, core_energetics_directory';
comment on column outreach_contacts.status is 'pending=not yet contacted, sent=first email sent, followed_up=follow-up sent, replied=responded, opted_out=unsubscribed, converted=signed up, bounced=email failed';
