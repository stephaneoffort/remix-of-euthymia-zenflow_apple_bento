-- Idempotent OAuth integrations migration
-- Tables created with IF NOT EXISTS (uses existing schema with token_expiry)

CREATE TABLE IF NOT EXISTS public.member_integrations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  integration   text NOT NULL,
  is_enabled    boolean DEFAULT false,
  is_connected  boolean DEFAULT false,
  enabled_at    timestamptz,
  connected_at  timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, integration)
);

CREATE TABLE IF NOT EXISTS public.dropbox_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text,
  account_id    text,
  token_expiry  timestamptz,
  email         text,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.miro_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text,
  token_expiry  timestamptz,
  email         text,
  display_name  text,
  team_id       text,
  team_name     text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zoom_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text,
  token_expiry  timestamptz,
  email         text,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drive_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  email         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.canva_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  email         text,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  email         text,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brevo_connections (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key       text NOT NULL,
  account_email text,
  account_name  text,
  plan          text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Enable RLS (idempotent)
ALTER TABLE public.member_integrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropbox_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miro_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_connections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_connections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canva_connections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brevo_connections    ENABLE ROW LEVEL SECURITY;

-- "own rows" policies — DROP IF EXISTS then CREATE for idempotence.
-- Existing *_own policies are preserved (they are separate policies with different names).
DROP POLICY IF EXISTS "own rows" ON public.member_integrations;
CREATE POLICY "own rows" ON public.member_integrations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.dropbox_connections;
CREATE POLICY "own rows" ON public.dropbox_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.miro_connections;
CREATE POLICY "own rows" ON public.miro_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.zoom_connections;
CREATE POLICY "own rows" ON public.zoom_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.drive_connections;
CREATE POLICY "own rows" ON public.drive_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.canva_connections;
CREATE POLICY "own rows" ON public.canva_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.gmail_connections;
CREATE POLICY "own rows" ON public.gmail_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own rows" ON public.brevo_connections;
CREATE POLICY "own rows" ON public.brevo_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);