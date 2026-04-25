-- Table de connexion OAuth Google pour Docs
CREATE TABLE public.google_docs_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.google_docs_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google docs connections"
  ON public.google_docs_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own google docs connections"
  ON public.google_docs_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own google docs connections"
  ON public.google_docs_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own google docs connections"
  ON public.google_docs_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER google_docs_connections_set_updated_at
  BEFORE UPDATE ON public.google_docs_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table de lien entre tâche app et document Google
CREATE TABLE public.google_docs_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  app_task_id TEXT NOT NULL,
  google_doc_id TEXT NOT NULL,
  title TEXT,
  web_view_link TEXT,
  preview_text TEXT,
  preview_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, app_task_id, google_doc_id)
);

CREATE INDEX idx_google_docs_links_task ON public.google_docs_links(app_task_id);
CREATE INDEX idx_google_docs_links_user ON public.google_docs_links(user_id);

ALTER TABLE public.google_docs_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google docs links"
  ON public.google_docs_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own google docs links"
  ON public.google_docs_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own google docs links"
  ON public.google_docs_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own google docs links"
  ON public.google_docs_links FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER google_docs_links_set_updated_at
  BEFORE UPDATE ON public.google_docs_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();