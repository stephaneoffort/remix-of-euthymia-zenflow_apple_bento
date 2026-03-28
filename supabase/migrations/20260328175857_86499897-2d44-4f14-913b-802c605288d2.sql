
-- Drop old permissive policies on calendar_accounts
DROP POLICY IF EXISTS "Calendar accounts viewable by everyone" ON public.calendar_accounts;
DROP POLICY IF EXISTS "Calendar accounts insertable by authenticated" ON public.calendar_accounts;
DROP POLICY IF EXISTS "Calendar accounts updatable by authenticated" ON public.calendar_accounts;
DROP POLICY IF EXISTS "Calendar accounts deletable by authenticated" ON public.calendar_accounts;

-- New per-user policies for calendar_accounts
CREATE POLICY "Users can view own calendar accounts"
  ON public.calendar_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendar accounts"
  ON public.calendar_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendar accounts"
  ON public.calendar_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar accounts"
  ON public.calendar_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Drop old permissive policies on calendar_events
DROP POLICY IF EXISTS "Calendar events viewable by everyone" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events insertable by authenticated" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events updatable by authenticated" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events deletable by authenticated" ON public.calendar_events;

-- New per-user policies for calendar_events
CREATE POLICY "Users can view own calendar events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendar events"
  ON public.calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendar events"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar events"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
