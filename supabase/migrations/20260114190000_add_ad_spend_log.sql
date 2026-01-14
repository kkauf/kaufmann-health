-- Ad spend logging for CAC/CPL calculations
-- Populated nightly via cron from Google Ads API (future: Meta, Bing)

CREATE TABLE IF NOT EXISTS ad_spend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  spend_eur numeric(10,2) NOT NULL,
  source text NOT NULL DEFAULT 'google_ads',
  campaign_name text,
  clicks integer,
  impressions integer,
  conversions numeric(10,2),
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(date, source, campaign_name)
);

CREATE INDEX idx_ad_spend_log_date ON ad_spend_log(date);
CREATE INDEX idx_ad_spend_log_source ON ad_spend_log(source);

ALTER TABLE ad_spend_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ad_spend_log"
  ON ad_spend_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE ad_spend_log IS 'Daily ad spend by source/campaign for CAC/CPL calculations';
