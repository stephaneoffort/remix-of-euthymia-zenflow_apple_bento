ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS oauth_access_token text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token text,
  ADD COLUMN IF NOT EXISTS oauth_token_expiry timestamp with time zone,
  ADD COLUMN IF NOT EXISTS oauth_external_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_user_email_unique
  ON public.email_accounts (user_id, lower(email_address));