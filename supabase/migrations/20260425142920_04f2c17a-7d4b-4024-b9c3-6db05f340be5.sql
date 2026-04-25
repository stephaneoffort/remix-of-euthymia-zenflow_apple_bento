-- Table de connexion n8n (API key + URL d'instance)
CREATE TABLE IF NOT EXISTS public.n8n_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_url text NOT NULL,
  api_key text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_n8n_connections_user ON public.n8n_connections(user_id);

ALTER TABLE public.n8n_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "n8n_connections_own" ON public.n8n_connections;
CREATE POLICY "n8n_connections_own"
  ON public.n8n_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "n8n_connections_service" ON public.n8n_connections;
CREATE POLICY "n8n_connections_service"
  ON public.n8n_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_n8n_connections_updated_at ON public.n8n_connections;
CREATE TRIGGER trg_n8n_connections_updated_at
  BEFORE UPDATE ON public.n8n_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();