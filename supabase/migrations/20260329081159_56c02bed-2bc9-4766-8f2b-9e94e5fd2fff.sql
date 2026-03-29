
-- Drive connections table
CREATE TABLE public.drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drive_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drive connections" ON public.drive_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own drive connections" ON public.drive_connections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own drive connections" ON public.drive_connections
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own drive connections" ON public.drive_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Drive attachments table
CREATE TABLE public.drive_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  thumbnail_url TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.drive_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drive attachments" ON public.drive_attachments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own drive attachments" ON public.drive_attachments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own drive attachments" ON public.drive_attachments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_drive_attachments_entity ON public.drive_attachments(entity_type, entity_id);
