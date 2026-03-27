
CREATE TABLE public.calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  provider TEXT NOT NULL DEFAULT 'google',
  label TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  caldav_url TEXT,
  caldav_username TEXT,
  caldav_password TEXT,
  ics_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar accounts viewable by everyone" ON public.calendar_accounts FOR SELECT TO public USING (true);
CREATE POLICY "Calendar accounts insertable by authenticated" ON public.calendar_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Calendar accounts updatable by authenticated" ON public.calendar_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Calendar accounts deletable by authenticated" ON public.calendar_accounts FOR DELETE TO authenticated USING (true);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  account_id UUID REFERENCES public.calendar_accounts(id) ON DELETE CASCADE,
  external_id TEXT,
  provider TEXT NOT NULL DEFAULT 'google',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'confirmed',
  sync_status TEXT DEFAULT 'synced',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, external_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar events viewable by everyone" ON public.calendar_events FOR SELECT TO public USING (true);
CREATE POLICY "Calendar events insertable by authenticated" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Calendar events updatable by authenticated" ON public.calendar_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Calendar events deletable by authenticated" ON public.calendar_events FOR DELETE TO authenticated USING (true);
