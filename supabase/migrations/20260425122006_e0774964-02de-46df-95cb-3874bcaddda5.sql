-- Table de connexion OAuth Miro (1 par user)
CREATE TABLE public.miro_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamp with time zone NOT NULL,
  email text,
  display_name text,
  team_id text,
  team_name text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.miro_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miro_connections_own"
ON public.miro_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access miro connections"
ON public.miro_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Table des boards Miro attachés aux entités
CREATE TABLE public.miro_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  board_id text NOT NULL,
  board_name text NOT NULL,
  board_url text NOT NULL,
  thumbnail_url text,
  board_description text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.miro_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miro_attachments_own"
ON public.miro_attachments
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access miro attachments"
ON public.miro_attachments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_miro_attachments_entity ON public.miro_attachments(entity_type, entity_id);
CREATE INDEX idx_miro_attachments_user ON public.miro_attachments(user_id);