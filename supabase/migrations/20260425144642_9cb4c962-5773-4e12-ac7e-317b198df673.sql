-- Notion OAuth connections (one workspace per user)
CREATE TABLE public.notion_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  workspace_id text NOT NULL,
  workspace_name text,
  workspace_icon text,
  bot_id text,
  owner jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notion_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notion_connections_own"
  ON public.notion_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notion_connections_service"
  ON public.notion_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER notion_connections_updated_at
  BEFORE UPDATE ON public.notion_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notion page attachments (link to task/project/space)
CREATE TABLE public.notion_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  page_id text NOT NULL,
  page_url text NOT NULL,
  page_title text,
  page_icon text,
  parent_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notion_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notion_attachments_own"
  ON public.notion_attachments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notion_attachments_service"
  ON public.notion_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_notion_attachments_entity
  ON public.notion_attachments (entity_type, entity_id);
CREATE INDEX idx_notion_attachments_user
  ON public.notion_attachments (user_id);