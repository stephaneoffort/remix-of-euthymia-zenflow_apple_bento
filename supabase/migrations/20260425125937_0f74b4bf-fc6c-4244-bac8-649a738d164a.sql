-- Dropbox connections (per-user OAuth)
CREATE TABLE public.dropbox_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamp with time zone NOT NULL,
  account_id text,
  email text,
  display_name text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.dropbox_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dropbox_connections_own" ON public.dropbox_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access dropbox connections" ON public.dropbox_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Dropbox attachments linked to entities (tasks, projects, etc.)
CREATE TABLE public.dropbox_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  file_id text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text,
  mime_type text,
  file_size bigint,
  is_folder boolean DEFAULT false,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.dropbox_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dropbox_attachments_own" ON public.dropbox_attachments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access dropbox attachments" ON public.dropbox_attachments
  FOR ALL TO service_role USING (true) WITH CHECK (true);