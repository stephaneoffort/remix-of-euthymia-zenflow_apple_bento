
CREATE TABLE IF NOT EXISTS google_chat_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  email TEXT NOT NULL,
  space_id TEXT,
  space_name TEXT,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS google_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  space_id TEXT,
  sender_name TEXT,
  sender_email TEXT,
  content TEXT NOT NULL,
  thread_id TEXT,
  is_mention BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE TABLE IF NOT EXISTS chat_bot_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  command TEXT NOT NULL,
  payload JSONB,
  result JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gchat_messages_entity ON google_chat_messages(user_id, is_mention);

ALTER TABLE google_chat_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gchat_connections_own" ON google_chat_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gchat_messages_own" ON google_chat_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_bot_commands_own" ON chat_bot_commands
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.google_chat_messages;
