-- Table des comptes email
CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('gmail', 'imap')),
  email_address text NOT NULL,
  display_name text,
  label text,
  color text DEFAULT '#3b82f6',
  -- IMAP/SMTP fields (null pour gmail)
  imap_host text,
  imap_port integer,
  imap_secure boolean DEFAULT true,
  imap_username text,
  imap_password text, -- mot de passe d'application stocké en clair (RLS protège)
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean DEFAULT true,
  smtp_username text,
  smtp_password text,
  -- État
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_error text,
  unread_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_accounts_user ON public.email_accounts(user_id);
CREATE INDEX idx_email_accounts_active ON public.email_accounts(user_id, is_active);

-- Table cache des messages
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL, -- UID IMAP ou messageId Gmail
  thread_id text,
  folder text NOT NULL DEFAULT 'INBOX',
  from_address text NOT NULL,
  from_name text,
  to_addresses text[] DEFAULT '{}',
  cc_addresses text[] DEFAULT '{}',
  bcc_addresses text[] DEFAULT '{}',
  subject text,
  preview text,
  body_text text,
  body_html text,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id, folder)
);

CREATE INDEX idx_email_messages_account ON public.email_messages(account_id, received_at DESC);
CREATE INDEX idx_email_messages_user_unread ON public.email_messages(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_email_messages_folder ON public.email_messages(account_id, folder, received_at DESC);

-- Trigger updated_at
CREATE TRIGGER update_email_accounts_updated_at
BEFORE UPDATE ON public.email_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Policies email_accounts
CREATE POLICY "Users view own email accounts"
ON public.email_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own email accounts"
ON public.email_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own email accounts"
ON public.email_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own email accounts"
ON public.email_accounts FOR DELETE
USING (auth.uid() = user_id);

-- Policies email_messages
CREATE POLICY "Users view own emails"
ON public.email_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own emails"
ON public.email_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own emails"
ON public.email_messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own emails"
ON public.email_messages FOR DELETE
USING (auth.uid() = user_id);