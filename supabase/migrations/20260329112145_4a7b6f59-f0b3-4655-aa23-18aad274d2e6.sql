
-- Table for per-user integration preferences
CREATE TABLE public.member_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration)
);

-- RLS
ALTER TABLE public.member_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member_integrations_own" ON public.member_integrations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seed existing users with all 5 integrations disabled
INSERT INTO public.member_integrations (user_id, integration, is_enabled, is_connected)
SELECT u.id, i.integration, FALSE, FALSE
FROM auth.users u
CROSS JOIN (
  VALUES 
    ('google_drive'), ('zoom'), ('canva'), 
    ('google_meet'), ('gmail')
) AS i(integration)
ON CONFLICT DO NOTHING;
