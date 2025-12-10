-- Fix RLS policy performance issue on short_links
-- Wrap auth.role() in subquery to cache the value instead of re-evaluating per row

DROP POLICY IF EXISTS short_links_service_write ON public.short_links;

CREATE POLICY short_links_service_write ON public.short_links
  FOR ALL
  USING ((select auth.role()) = 'service_role'::text);
