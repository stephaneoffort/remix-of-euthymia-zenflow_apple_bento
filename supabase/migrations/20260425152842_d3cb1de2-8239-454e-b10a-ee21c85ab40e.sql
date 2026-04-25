-- Connexion OAuth Google Tasks
CREATE TABLE public.google_tasks_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  token_expiry timestamptz,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_tasks_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_tasks_connections_own"
  ON public.google_tasks_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_tasks_connections_service"
  ON public.google_tasks_connections FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_google_tasks_connections_updated_at
  BEFORE UPDATE ON public.google_tasks_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mapping app task <-> Google task
CREATE TABLE public.google_tasklist_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_task_id text NOT NULL,
  google_tasklist_id text NOT NULL,
  google_task_id text NOT NULL,
  direction text NOT NULL DEFAULT 'push' CHECK (direction IN ('push', 'import')),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, app_task_id, google_task_id)
);

CREATE INDEX idx_gtask_links_user ON public.google_tasklist_links(user_id);
CREATE INDEX idx_gtask_links_app_task ON public.google_tasklist_links(user_id, app_task_id);
CREATE INDEX idx_gtask_links_google_task ON public.google_tasklist_links(user_id, google_task_id);

ALTER TABLE public.google_tasklist_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_tasklist_links_own"
  ON public.google_tasklist_links FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "google_tasklist_links_service"
  ON public.google_tasklist_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);