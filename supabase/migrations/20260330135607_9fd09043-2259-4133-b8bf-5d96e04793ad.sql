CREATE TABLE IF NOT EXISTS brevo_entity_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  campaign_id BIGINT,
  campaign_name TEXT,
  campaign_url TEXT,
  custom_url TEXT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, campaign_id)
);

ALTER TABLE brevo_entity_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brevo_entity_campaigns_own"
  ON brevo_entity_campaigns
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);