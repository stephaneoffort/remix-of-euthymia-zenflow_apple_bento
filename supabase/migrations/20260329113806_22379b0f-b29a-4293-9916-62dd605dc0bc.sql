
CREATE TABLE brevo_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  plan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE brevo_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  brevo_contact_id BIGINT,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  list_ids INTEGER[],
  attributes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brevo_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  campaign_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  status TEXT,
  sent_count INTEGER DEFAULT 0,
  open_rate DECIMAL,
  click_rate DECIMAL,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brevo_contacts_entity ON brevo_contacts(entity_type, entity_id);
CREATE INDEX idx_brevo_campaigns_entity ON brevo_campaigns(entity_type, entity_id);

ALTER TABLE brevo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE brevo_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brevo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brevo_connections_own" ON brevo_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brevo_contacts_own" ON brevo_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brevo_campaigns_own" ON brevo_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO member_integrations (user_id, integration, is_enabled, is_connected)
SELECT id, 'brevo', FALSE, FALSE FROM auth.users
ON CONFLICT DO NOTHING;
