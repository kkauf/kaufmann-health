-- EARTH-116: Add storage buckets for therapist profile workflow (applications + profiles)

begin;

-- 1) Buckets
-- Private bucket to hold pending application assets (profile photos, docs if needed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'therapist-applications') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('therapist-applications', 'therapist-applications', false);
  END IF;
END $$;

-- Public bucket to hold approved profile photos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'therapist-profiles') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('therapist-profiles', 'therapist-profiles', true);
  END IF;
END $$;

-- 2) Storage policies
-- Applications bucket: service role manage
DROP POLICY IF EXISTS "Service role can manage therapist applications" ON storage.objects;
CREATE POLICY "Service role can manage therapist applications"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'therapist-applications')
  WITH CHECK (bucket_id = 'therapist-applications');

-- Profiles bucket: public read, service role manage
DROP POLICY IF EXISTS "Anon can read therapist profiles" ON storage.objects;
CREATE POLICY "Anon can read therapist profiles"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'therapist-profiles');

DROP POLICY IF EXISTS "Authenticated can read therapist profiles" ON storage.objects;
CREATE POLICY "Authenticated can read therapist profiles"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'therapist-profiles');

DROP POLICY IF EXISTS "Service role can manage therapist profiles" ON storage.objects;
CREATE POLICY "Service role can manage therapist profiles"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'therapist-profiles')
  WITH CHECK (bucket_id = 'therapist-profiles');

commit;
