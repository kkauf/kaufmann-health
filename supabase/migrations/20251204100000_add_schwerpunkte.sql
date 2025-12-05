-- Add schwerpunkte column to therapists table
-- Stores array of category IDs (e.g., ['trauma', 'angst', 'depression'])
ALTER TABLE public.therapists
ADD COLUMN IF NOT EXISTS schwerpunkte jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Create index for efficient schwerpunkte queries
CREATE INDEX IF NOT EXISTS idx_therapists_schwerpunkte ON public.therapists USING gin (schwerpunkte);

-- Create reference table for UI category/keyword display
-- This is read-only reference data populated by the application
CREATE TABLE IF NOT EXISTS public.schwerpunkt_reference (
  category_id text PRIMARY KEY,
  category_label text NOT NULL,
  keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
  sort_order integer DEFAULT 0
);

-- Enable RLS on reference table (read-only for all, write for service_role)
ALTER TABLE public.schwerpunkt_reference ENABLE ROW LEVEL SECURITY;

-- Allow all to read reference data
CREATE POLICY "allow_read_schwerpunkt_reference" ON public.schwerpunkt_reference
  FOR SELECT USING (true);

-- Only service_role can write
CREATE POLICY "service_role_write_schwerpunkt_reference" ON public.schwerpunkt_reference
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed reference data
INSERT INTO public.schwerpunkt_reference (category_id, category_label, keywords, sort_order)
VALUES
  ('trauma', 'Trauma / PTBS', '["Trauma", "Bindungstrauma", "Entwicklungstrauma", "Komplexe PTBS", "Schocktrauma", "Akutes Trauma", "Missbrauch", "Vernachlässigung"]'::jsonb, 1),
  ('angst', 'Angst / Panik', '["Angst", "Angststörung", "Panikattacken", "Verlustangst", "Innere Unruhe"]'::jsonb, 2),
  ('depression', 'Depression / Erschöpfung', '["Depression", "Depressive Verstimmung", "Burnout", "Erschöpfung", "Aussichtslosigkeit", "Überforderung", "Emotionale Taubheit", "Stimmungsschwankungen"]'::jsonb, 3),
  ('beziehung', 'Beziehungsprobleme', '["Beziehungsprobleme", "Trennung", "Emotionale Abhängigkeit", "Bindungsangst", "Nähe-Distanz-Probleme", "Co-Abhängigkeit", "Einsamkeit", "Schwierigkeiten mit Grenzen setzen"]'::jsonb, 4),
  ('wut', 'Wut / Emotionsregulation', '["Wut", "Aggression", "Impulskontrolle", "Überwältigung"]'::jsonb, 5),
  ('psychosomatik', 'Psychosomatik / Körper', '["Psychosomatische Beschwerden", "Chronische Schmerzen", "Verspannungen", "Rückenschmerzen", "Kopfschmerzen / Migräne", "Schlafstörungen", "Erschöpfungssyndrom", "Verdauungsbeschwerden", "Dissoziative Symptome"]'::jsonb, 6),
  ('essstoerung', 'Essstörungen / Körperbild', '["Essstörungen", "Anorexie", "Bulimie", "Binge Eating", "Körperbild", "Emotionales Essen"]'::jsonb, 7),
  ('trauer', 'Trauer / Verlust', '["Trauer", "Verlust", "Lebenskrise"]'::jsonb, 8),
  ('selbstwert', 'Selbstwert / Scham', '["Geringes Selbstwertgefühl", "Selbstkritik / Innerer Kritiker", "Scham", "Schuldgefühle", "Perfektionismus", "People Pleasing"]'::jsonb, 9),
  ('zwang', 'Kontrolle / Zwang', '["Zwangsgedanken", "Kontrollthemen", "Hypochondrie"]'::jsonb, 10),
  ('neurodivergenz', 'ADHS / Autismus', '["ADHS", "Autismus / Autismus-Spektrum", "Hochsensibilität (HSP)"]'::jsonb, 11),
  ('sexualitaet', 'Sexualität', '["Sexuelle Probleme", "Sexuelles Trauma", "Lustlosigkeit", "Körperliche Blockaden bei Intimität"]'::jsonb, 12),
  ('krisen', 'Krisen', '["Krisenintervention", "Suizidalität", "Akute Belastungsreaktion", "Notfallbegleitung"]'::jsonb, 13),
  ('identitaet', 'Identität', '["Identitätsfragen", "Geschlechtsidentität", "LGBTQ+", "Migration / Expat-Themen", "Kulturelle Identität"]'::jsonb, 14),
  ('paare', 'Paare / Familie', '["Paartherapie", "Kommunikation in Beziehungen", "Familienkonflikte", "Elternschaft"]'::jsonb, 15),
  ('entwicklung', 'Persönliche Entwicklung', '["Selbstbewusstsein", "Persönlichkeitsentwicklung", "Karriere", "Berufliche Neuorientierung", "Lebensübergänge", "Sinnfragen", "Stress", "Work-Life-Balance"]'::jsonb, 16)
ON CONFLICT (category_id) DO UPDATE SET
  category_label = EXCLUDED.category_label,
  keywords = EXCLUDED.keywords,
  sort_order = EXCLUDED.sort_order;

-- Grant permissions
GRANT SELECT ON public.schwerpunkt_reference TO anon, authenticated, service_role;
GRANT ALL ON public.schwerpunkt_reference TO service_role;
