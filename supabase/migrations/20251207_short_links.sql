-- Short links table for URL shortening (primarily for SMS)
CREATE TABLE IF NOT EXISTS short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  -- Tracking metadata
  utm_source VARCHAR(50),
  utm_medium VARCHAR(50),
  utm_campaign VARCHAR(100),
  patient_id UUID REFERENCES people(id) ON DELETE SET NULL,
  -- Stats
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_clicked_at TIMESTAMPTZ
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(code);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_short_links_campaign ON short_links(utm_campaign) WHERE utm_campaign IS NOT NULL;

-- RLS: Allow public read for redirect, admin write
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Public can read (for redirect endpoint)
CREATE POLICY "short_links_public_read" ON short_links
  FOR SELECT USING (true);

-- Only service role can insert/update (server-side only)
CREATE POLICY "short_links_service_write" ON short_links
  FOR ALL USING (auth.role() = 'service_role');
