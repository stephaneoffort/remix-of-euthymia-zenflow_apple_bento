ALTER TABLE public.google_sheets_connections
  RENAME COLUMN token_expires_at TO token_expiry;

ALTER TABLE public.google_sheets_connections
  DROP COLUMN IF EXISTS google_email,
  DROP COLUMN IF EXISTS scopes;