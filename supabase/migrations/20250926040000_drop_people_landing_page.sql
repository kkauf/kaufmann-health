-- Drop deprecated campaign attribution column: landing_page
-- Reason: campaign_source suffices as the persistent source; landing_page was redundant and sometimes inaccurate.

alter table public.people drop column if exists landing_page;
