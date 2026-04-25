-- Table de connexion OAuth Figma (par utilisateur)
CREATE TABLE public.figma_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  figma_user_id TEXT,
  figma_handle TEXT,
  figma_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.figma_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own figma connection"
  ON public.figma_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own figma connection"
  ON public.figma_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own figma connection"
  ON public.figma_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own figma connection"
  ON public.figma_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_figma_connections_updated_at
  BEFORE UPDATE ON public.figma_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table de liaison entre tâches et fichiers Figma
CREATE TABLE public.figma_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_key TEXT NOT NULL,
  node_id TEXT,
  file_name TEXT,
  thumbnail_url TEXT,
  preview_image_url TEXT,
  last_modified TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_figma_links_task_id ON public.figma_links(task_id);
CREATE INDEX idx_figma_links_user_id ON public.figma_links(user_id);

ALTER TABLE public.figma_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own figma links"
  ON public.figma_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own figma links"
  ON public.figma_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own figma links"
  ON public.figma_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own figma links"
  ON public.figma_links FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_figma_links_updated_at
  BEFORE UPDATE ON public.figma_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();