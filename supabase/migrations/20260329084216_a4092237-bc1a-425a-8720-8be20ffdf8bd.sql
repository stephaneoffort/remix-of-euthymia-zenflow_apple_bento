
CREATE TABLE public.canva_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

ALTER TABLE public.canva_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canva connections" ON public.canva_connections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own canva connections" ON public.canva_connections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own canva connections" ON public.canva_connections FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own canva connections" ON public.canva_connections FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role full access canva connections" ON public.canva_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.canva_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  design_id TEXT NOT NULL,
  design_name TEXT NOT NULL,
  design_url TEXT NOT NULL,
  thumbnail_url TEXT,
  design_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.canva_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canva attachments" ON public.canva_attachments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own canva attachments" ON public.canva_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own canva attachments" ON public.canva_attachments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role full access canva attachments" ON public.canva_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_canva_attachments_entity ON public.canva_attachments(entity_type, entity_id);
