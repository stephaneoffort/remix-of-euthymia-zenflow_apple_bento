-- Miro connections (one per user)
CREATE TABLE IF NOT EXISTS public.miro_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  miro_user_id text,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT miro_connections_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_miro_connections_user_id ON public.miro_connections(user_id);

ALTER TABLE public.miro_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miro_connections_select_own" ON public.miro_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "miro_connections_insert_own" ON public.miro_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "miro_connections_update_own" ON public.miro_connections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "miro_connections_delete_own" ON public.miro_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "miro_connections_service_all" ON public.miro_connections
  USING (true) WITH CHECK (true);

-- Miro board attachments (boards linked to tasks/projects/events)
CREATE TABLE IF NOT EXISTS public.miro_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  board_id text NOT NULL,
  board_name text NOT NULL,
  board_url text NOT NULL,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miro_attachments_user_id ON public.miro_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_miro_attachments_entity ON public.miro_attachments(entity_type, entity_id);

ALTER TABLE public.miro_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "miro_attachments_select_own" ON public.miro_attachments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "miro_attachments_insert_own" ON public.miro_attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "miro_attachments_delete_own" ON public.miro_attachments
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "miro_attachments_service_all" ON public.miro_attachments
  USING (true) WITH CHECK (true);

-- Add 'miro' to member_integrations allowed values (if using enum/check constraint)
-- Miro will be stored as a new row in member_integrations with integration = 'miro'
