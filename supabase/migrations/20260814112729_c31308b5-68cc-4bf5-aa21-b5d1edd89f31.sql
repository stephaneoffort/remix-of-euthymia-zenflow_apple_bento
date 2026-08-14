-- 1. One-time OAuth state tokens (service-role only)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  code_verifier text,
  redirect_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role (bypasses RLS) may use this table

CREATE INDEX IF NOT EXISTS oauth_states_expires_at_idx ON public.oauth_states (expires_at);

-- 2. app_settings: restrict reads to explicitly public keys
DROP POLICY IF EXISTS "App settings viewable by authenticated" ON public.app_settings;
CREATE POLICY "App settings public keys viewable by authenticated"
ON public.app_settings
FOR SELECT
TO authenticated
USING (key IN ('theme_palette'));

-- 3. Revoke EXECUTE on SECURITY DEFINER functions not used by RLS or the client
REVOKE ALL ON FUNCTION public.can_access_space(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_space_manager(text, text) FROM PUBLIC, anon, authenticated;