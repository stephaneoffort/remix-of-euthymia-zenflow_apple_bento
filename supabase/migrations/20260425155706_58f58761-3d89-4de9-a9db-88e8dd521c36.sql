-- ─────────────────────────────────────────────────────────────
-- Google Sheets : connexions OAuth par utilisateur
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.google_sheets_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.google_sheets_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Sheets connection"
  ON public.google_sheets_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Sheets connection"
  ON public.google_sheets_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Sheets connection"
  ON public.google_sheets_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Sheets connection"
  ON public.google_sheets_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_sheets_connections_updated_at
  BEFORE UPDATE ON public.google_sheets_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- Google Sheets : liens entre tâches et spreadsheets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.google_sheets_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  app_task_id TEXT NOT NULL,
  google_sheet_id TEXT NOT NULL,
  title TEXT,
  web_view_link TEXT,
  preview_values JSONB,
  preview_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, app_task_id, google_sheet_id)
);

ALTER TABLE public.google_sheets_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Sheets links"
  ON public.google_sheets_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Sheets links"
  ON public.google_sheets_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Sheets links"
  ON public.google_sheets_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Sheets links"
  ON public.google_sheets_links FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_sheets_links_updated_at
  BEFORE UPDATE ON public.google_sheets_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_google_sheets_links_task ON public.google_sheets_links(user_id, app_task_id);