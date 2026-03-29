
CREATE TABLE public.zoom_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  zoom_user_id TEXT,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE public.zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  zoom_meeting_id BIGINT NOT NULL,
  topic TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  duration INTEGER,
  join_url TEXT NOT NULL,
  start_url TEXT NOT NULL,
  password TEXT,
  status TEXT DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zoom_meetings_entity ON public.zoom_meetings(entity_type, entity_id);
CREATE INDEX idx_zoom_meetings_user ON public.zoom_meetings(user_id);

ALTER TABLE public.zoom_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoom_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access zoom connections" ON public.zoom_connections FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage own zoom connections" ON public.zoom_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access zoom meetings" ON public.zoom_meetings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage own zoom meetings" ON public.zoom_meetings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
